import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { claimTicket } from "@/lib/claim";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  categoryId: z.string().uuid(),
  admissionToken: z.string().min(10).max(1000),
  idempotencyKey: z.string().uuid("Kunci permintaan tidak valid."),
  agree: z.literal(true, { message: "Setujui Syarat & Ketentuan terlebih dulu." }),
});

const STATUS: Record<string, number> = {
  SUCCESS: 201,
  SOLD_OUT: 409,
  CLOSED: 409,
  ALREADY_HAS_TICKET: 409,
  IDENTITY_ALREADY_USED: 409,
  PROFILE_INCOMPLETE: 403,
};

/** POST /api/claim — satu-satunya jalur penerbitan tiket. Hasil: SUCCESS | SOLD_OUT | CLOSED | ALREADY_HAS_TICKET | IDENTITY_ALREADY_USED. */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`claim:${u.id}`, 30, 60);
  const d = await body(req, schema);
  const r = await claimTicket({ userId: u.id, categoryId: d.categoryId, admissionToken: d.admissionToken, idempotencyKey: d.idempotencyKey });
  return json(r, { status: STATUS[r.code] ?? 200 });
});
