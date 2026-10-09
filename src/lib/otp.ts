import { sql } from "./db";
import { encrypt, otpHash, randomOtp } from "./crypto";
import { ApiError } from "./http";
import { cooldown, rateLimit } from "./rate-limit";
import { enqueue } from "./outbox";

export type OtpPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD" | "LOGIN_2FA";

const OTP_TTL_SEC = 5 * 60;
const MAX_ATTEMPTS = 5;

/**
 * Terbitkan OTP baru (yang lama hangus) dan antrekan email-nya.
 * Kode plaintext hanya ada terenkripsi di outbox dan dihapus worker setelah terkirim.
 */
export async function issueOtp(opts: { userId: string; email: string; name: string; purpose: OtpPurpose; ip: string; enforceCooldown?: boolean }) {
  const emailKey = opts.email.toLowerCase();
  if (opts.enforceCooldown !== false) {
    await cooldown(`otp:${opts.purpose}:${emailKey}`, 60, "Tunggu 60 detik sebelum meminta kode baru.");
  }
  await rateLimit(`otp:email:${emailKey}`, 5, 3600, "Batas permintaan kode untuk email ini tercapai. Coba lagi dalam 1 jam.");
  await rateLimit(`otp:ip:${opts.ip}`, 5 * 4, 3600, "Terlalu banyak permintaan kode dari jaringan Anda. Coba lagi nanti.");

  const code = randomOtp();
  await sql.begin(async (tx) => {
    await tx`UPDATE otp_codes SET consumed_at = now() WHERE user_id = ${opts.userId} AND purpose = ${opts.purpose} AND consumed_at IS NULL`;
    await tx`
      INSERT INTO otp_codes (user_id, purpose, code_hash, expires_at)
      VALUES (${opts.userId}, ${opts.purpose}, ${otpHash(opts.userId, opts.purpose, code)}, now() + make_interval(secs => ${OTP_TTL_SEC}))`;
    await enqueue("OTP_EMAIL", { to: opts.email, name: opts.name, purpose: opts.purpose, code_enc: encrypt(code) }, tx);
  });
}

/** Verifikasi OTP. Maks 5 kali salah; setelah itu kode hangus. */
export async function verifyOtp(userId: string, purpose: OtpPurpose, code: string) {
  const result = await sql.begin(async (tx) => {
    const [otp] = await tx<{ id: string; code_hash: string; expires_at: Date; attempts: number }[]>`
      SELECT id, code_hash, expires_at, attempts FROM otp_codes
      WHERE user_id = ${userId} AND purpose = ${purpose} AND consumed_at IS NULL
      FOR UPDATE`;
    if (!otp) return { ok: false as const, code: "OTP_NOT_FOUND", message: "Kode tidak ditemukan atau sudah hangus. Minta kode baru." };
    if (otp.expires_at.getTime() < Date.now()) {
      await tx`UPDATE otp_codes SET consumed_at = now() WHERE id = ${otp.id}`;
      return { ok: false as const, code: "OTP_EXPIRED", message: "Kode sudah kedaluwarsa. Minta kode baru." };
    }
    if (otp.code_hash !== otpHash(userId, purpose, code)) {
      const attempts = otp.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await tx`UPDATE otp_codes SET attempts = ${attempts}, consumed_at = now() WHERE id = ${otp.id}`;
        return { ok: false as const, code: "OTP_LOCKED", message: "Kode salah 5 kali dan sudah hangus. Minta kode baru." };
      }
      await tx`UPDATE otp_codes SET attempts = ${attempts} WHERE id = ${otp.id}`;
      return { ok: false as const, code: "OTP_INVALID", message: `Kode salah. Sisa ${MAX_ATTEMPTS - attempts} percobaan.` };
    }
    await tx`UPDATE otp_codes SET consumed_at = now() WHERE id = ${otp.id}`;
    return { ok: true as const };
  });
  if (!result.ok) throw new ApiError(400, result.code, result.message);
}
