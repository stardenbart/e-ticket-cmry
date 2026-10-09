import { sql } from "@/lib/db";
import { json, route, ApiError } from "@/lib/http";
import { serverNowMs } from "@/lib/redis";
import { publicKeys } from "@/lib/qr";
import { requireEventAccess, requireScannerUser } from "@/lib/scanner/access";

export const dynamic = "force-dynamic";

/**
 * GET /api/scanner/events/:id/manifest?since=ISO
 * Manifest tiket event untuk validasi offline. Dengan `since`, hanya tiket yang berubah (delta).
 * Tiket CANCELLED/REVOKED ikut dikirim agar QR basi ditolak dengan alasan yang benar.
 * Tidak memuat nomor identitas lengkap — hanya jenis & 4 digit terakhir.
 */
export const GET = route<{ id: string }>(async (req, ctx) => {
  const u = await requireScannerUser();
  const { id } = await ctx.params;
  const e = await requireEventAccess(u, id);
  const sinceRaw = req.nextUrl.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) throw new ApiError(400, "VALIDATION", "Parameter since tidak valid.");

  const serverNow = await serverNowMs();
  const tickets = await sql<
    {
      id: string;
      version: number;
      status: string;
      holder_name: string;
      category_name: string;
      id_type: string;
      id_last4: string | null;
      checked_in_at: Date | null;
      checked_in_gate: string | null;
    }[]
  >`
    SELECT t.id, t.version, t.status, t.holder_name, c.name AS category_name, t.id_type, t.id_last4, t.checked_in_at, t.checked_in_gate
    FROM tickets t JOIN ticket_categories c ON c.id = t.category_id
    WHERE t.event_id = ${e.id} ${since ? sql`AND t.updated_at >= ${since}` : sql``}`;

  return json(
    {
      serverNow,
      full: !since,
      publicKeys: publicKeys(),
      event: {
        id: e.id,
        name: e.name,
        venue: e.venue,
        gates: e.gates,
        require_id_match: e.require_id_match,
        timezone: e.timezone,
        start_at: e.start_at,
        end_at: e.end_at,
        valid_until: e.valid_until,
      },
      tickets,
    },
    { headers: { "cache-control": "no-store" } },
  );
});
