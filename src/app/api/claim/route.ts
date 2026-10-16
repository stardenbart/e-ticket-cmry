import { z } from "zod";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { claimTicket } from "@/lib/claim";
import { rateLimit } from "@/lib/rate-limit";
import { checkEligibility } from "@/lib/employees";
import { SHIRT_SIZES, validatePhone } from "@/lib/employee-shared";
import { sql } from "@/lib/db";

const schema = z.object({
  categoryId: z.string().uuid(),
  admissionToken: z.string().min(10).max(1000),
  idempotencyKey: z.string().uuid("Kunci permintaan tidak valid."),
  agree: z.literal(true, { message: "Setujui Syarat & Ketentuan terlebih dulu." }),
  // Biodata diisi ulang saat pemesanan dan dicek ke daftar karyawan eligible.
  nik: z.string().trim().min(1, "NIK wajib diisi.").max(24),
  fullName: z.string().trim().min(1, "Nama wajib diisi sesuai Kartu Karyawan.").max(150),
  phone: z.string().trim().max(20).default(""),
  shirtSize: z.enum(SHIRT_SIZES, { message: "Pilih ukuran baju." }),
});

const STATUS: Record<string, number> = {
  SUCCESS: 201,
  SOLD_OUT: 409,
  CLOSED: 409,
  ALREADY_HAS_TICKET: 409,
  IDENTITY_ALREADY_USED: 409,
  PROFILE_INCOMPLETE: 403,
  NIK_MISMATCH: 400,
};

/**
 * POST /api/claim — satu-satunya jalur penerbitan tiket.
 * Biodata dicek ke daftar karyawan SEBELUM admission token dipakai, jadi salah ketik tidak menghanguskan giliran.
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`claim:${u.id}`, 30, 60);
  const d = await body(req, schema);

  const elig = await checkEligibility(d.nik, d.fullName);
  if (!elig.ok) {
    throw new ApiError(elig.code === "NOT_ELIGIBLE" ? 403 : 400, elig.code, elig.message, { fields: [{ path: elig.field, message: elig.message }] });
  }
  if (u.nik !== elig.employee.nik) {
    const message = u.nik
      ? "NIK yang diisi bukan milik akun Anda. Isi NIK karyawan atau NIK KTP Anda sendiri."
      : "Akun Anda belum tertaut ke NIK karyawan. Tautkan dulu di halaman Profil.";
    throw new ApiError(400, u.nik ? "NIK_MISMATCH" : "PROFILE_INCOMPLETE", message, { fields: [{ path: "nik", message }] });
  }

  const ph = validatePhone(d.phone);
  if (!ph.ok) throw new ApiError(400, "INVALID_PHONE", ph.message, { fields: [{ path: "phone", message: ph.message }] });
  if (ph.phone !== u.phone) await sql`UPDATE users SET phone = ${ph.phone} WHERE id = ${u.id}`;

  const r = await claimTicket({
    userId: u.id,
    categoryId: d.categoryId,
    admissionToken: d.admissionToken,
    idempotencyKey: d.idempotencyKey,
    biodata: { nik: elig.employee.nik, name: elig.employee.name, dept: elig.employee.dept, shirtSize: d.shirtSize },
  });
  return json(r, { status: STATUS[r.code] ?? 200 });
});
