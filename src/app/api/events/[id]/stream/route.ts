import { sql } from "@/lib/db";
import { getRemaining } from "@/lib/quota";
import { serverNowMs } from "@/lib/redis";
import { categoryStatus, type CategoryRow } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * SSE sisa kuota per kategori. Dikirim tiap ~1,5 detik dari cache Redis (diperbarui setelah commit).
 * Hanya informasi tampilan — bukan penentu hasil klaim.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const load = () =>
    sql<Pick<CategoryRow, "id" | "quota" | "claimed" | "open_at" | "close_at" | "is_closed">[]>`
      SELECT c.id, c.quota, c.claimed, c.open_at, c.close_at, c.is_closed
      FROM ticket_categories c JOIN events e ON e.id = c.event_id
      WHERE c.event_id = ${id} AND e.status <> 'DRAFT'`;
  let cats = await load();
  if (!cats.length) return new Response("Not found", { status: 404 });

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          // Metadata kategori (jam buka/tutup, ditutup admin) dimuat ulang tiap ~15 detik.
          if (++ticks % 10 === 0) cats = await load();
          const [rem, now] = await Promise.all([getRemaining(cats), serverNowMs()]);
          const data = cats.map((c) => ({
            id: c.id,
            quota: c.quota,
            remaining: rem[c.id] ?? 0,
            status: categoryStatus(c, rem[c.id] ?? 0, now),
          }));
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ now, categories: data })}\n\n`));
        } catch {
          // lewati satu tick; klien akan tetap terhubung
        }
      };
      controller.enqueue(enc.encode("retry: 3000\n\n"));
      await push();
      timer = setInterval(push, 1500);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
