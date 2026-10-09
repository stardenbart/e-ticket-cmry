import { sql } from "@/lib/db";
import { getCategories, type EventRow } from "@/lib/events";

export type AltCategory = { id: string; name: string; description: string; remaining: number; quota: number; color: string; openAt: string; closeAt: string };

/** Kategori + event-nya + kategori alternatif (masih tersedia) untuk halaman antrean/konfirmasi. */
export async function loadCategoryContext(categoryId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) return null;
  const [row] = await sql<{ event_id: string }[]>`SELECT event_id FROM ticket_categories WHERE id = ${categoryId}`;
  if (!row) return null;
  const [event] = await sql<EventRow[]>`SELECT * FROM events WHERE id = ${row.event_id} AND status <> 'DRAFT'`;
  if (!event) return null;
  const cats = await getCategories(event.id);
  const cat = cats.find((c) => c.id === categoryId)!;
  const now = Date.now();
  const alternatives: AltCategory[] = cats
    .filter((c) => c.id !== categoryId && !c.is_closed && c.close_at.getTime() > now && c.remaining > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      remaining: c.remaining,
      quota: c.quota,
      color: c.color,
      openAt: c.open_at.toISOString(),
      closeAt: c.close_at.toISOString(),
    }));
  return { event, cat, alternatives };
}
