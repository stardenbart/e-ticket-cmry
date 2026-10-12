// Data panel kategori tiket (dipakai halaman detail event dan landing page beranda).
import { sql } from "@/lib/db";
import { currentUser, profileComplete } from "@/lib/auth";
import { eventStatus, getCategories, type EventRow } from "@/lib/events";
import { activeQueueCategory } from "@/lib/queue";

export async function loadCategoryPanel(e: EventRow) {
  const [cats, user] = await Promise.all([getCategories(e.id), currentUser()]);

  let ticketId: string | null = null;
  let queueCategoryId: string | null = null;
  if (user) {
    const [t] = await sql<{ id: string }[]>`
      SELECT id FROM tickets WHERE event_id = ${e.id} AND user_id = ${user.id} AND status IN ('ACTIVE','CHECKED_IN')`;
    ticketId = t?.id ?? null;
    queueCategoryId = await activeQueueCategory(e.id, user.id).catch(() => null);
  }

  const st = eventStatus(e, cats);
  const eventState: "ACTIVE" | "CANCELLED" | "FINISHED" = st === "CANCELLED" ? "CANCELLED" : st === "FINISHED" ? "FINISHED" : "ACTIVE";

  return {
    cats,
    panel: {
      eventId: e.id,
      slug: e.slug,
      timezone: e.timezone,
      eventState,
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        quota: c.quota,
        remaining: c.remaining,
        openAt: c.open_at.toISOString(),
        closeAt: c.close_at.toISOString(),
        isClosed: c.is_closed,
        color: c.color,
      })),
      user: { loggedIn: !!user, profileComplete: !!user && profileComplete(user), ticketId, queueCategoryId },
    },
  };
}
