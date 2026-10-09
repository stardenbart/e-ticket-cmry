import { json, route } from "@/lib/http";
import { listScannerEvents, requireScannerUser } from "@/lib/scanner/access";

export const dynamic = "force-dynamic";

/** GET /api/scanner/events — event yang ditugaskan ke staf (admin: semua event aktif). */
export const GET = route(async () => {
  const u = await requireScannerUser();
  const events = await listScannerEvents(u);
  return json(
    {
      user: { id: u.id, name: u.full_name, email: u.email, role: u.role },
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        venue: e.venue,
        gates: e.gates,
        timezone: e.timezone,
        start_at: e.start_at,
        end_at: e.end_at,
        valid_until: e.valid_until,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
