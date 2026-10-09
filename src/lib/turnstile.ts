import { env } from "./env";
import { ApiError } from "./http";

/** Verifikasi token Cloudflare Turnstile di server. */
export async function verifyTurnstile(token: string | undefined, ip?: string) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return; // dinonaktifkan (hanya untuk lingkungan lokal)
  if (!token) throw new ApiError(400, "CAPTCHA_REQUIRED", "Selesaikan verifikasi captcha terlebih dulu.");
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = (await r.json()) as { success: boolean };
    if (!data.success) throw new ApiError(400, "CAPTCHA_FAILED", "Verifikasi captcha gagal. Muat ulang dan coba lagi.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(503, "CAPTCHA_UNAVAILABLE", "Layanan captcha tidak dapat dihubungi. Coba lagi.");
  }
}
