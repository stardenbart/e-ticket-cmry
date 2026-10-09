import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCategories, getEventById, categoryStatus } from "@/lib/events";
import { sanitizeRich } from "@/lib/admin/events";
import { fmtDate, fmtDateTime, fmtNumber, fmtTime } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { QuotaBar } from "@/components/admin/kit";

export const metadata: Metadata = { title: "Preview Event" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { UPCOMING: ["Segera dibuka", "blue"], OPEN: ["Sedang dibuka", "green"], SOLD_OUT: ["Habis", "red"], CLOSED: ["Ditutup", "slate"] } as const;

/** Pratinjau halaman publik event (read-only), termasuk untuk Draft. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const e = await getEventById(id);
  if (!e) notFound();
  const cats = await getCategories(id);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-warn ring-1 ring-amber-200">
        <span>
          <b>Mode preview</b> — tampilan halaman publik {e.status === "DRAFT" ? "(event masih Draft, belum tampil untuk umum)" : ""}. Tombol klaim dinonaktifkan.
        </span>
        <Link href={`/admin/events/${id}`} className="font-semibold underline">
          ← Kembali ke editor
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl bg-slate-200">
        {e.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.banner_url} alt={e.name} className="aspect-[2/1] w-full object-cover" />
        ) : (
          <div className="bg-cimory-gradient grid aspect-[3/1] place-items-center text-white/80">Banner belum diunggah</div>
        )}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cimory-red-dark">{e.event_type}</p>
            <h1 className="mt-1 text-3xl font-bold">{e.name}</h1>
            <p className="mt-1 text-muted">oleh {e.organizer || "—"}</p>
          </div>
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Tanggal</p>
              <p className="font-semibold">{fmtDate(e.start_at, e.timezone)}</p>
              <p className="text-sm">
                {fmtTime(e.start_at, e.timezone)} – {fmtTime(e.end_at, e.timezone)}
                {e.gate_open_at && <> · gate dibuka {fmtTime(e.gate_open_at, e.timezone)}</>}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Lokasi</p>
              <p className="font-semibold">{e.venue || "—"}</p>
              <p className="text-sm">
                {e.address}
                {e.city && `, ${e.city}`}
              </p>
            </div>
            {e.lat != null && e.lng != null && (
              <iframe
                title="Peta lokasi"
                className="h-56 w-full rounded-xl border border-line sm:col-span-2"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${e.lng - 0.01},${e.lat - 0.006},${e.lng + 0.01},${e.lat + 0.006}&layer=mapnik&marker=${e.lat},${e.lng}`}
              />
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">Deskripsi</h2>
            <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRich(e.description) || "<p>—</p>" }} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">Syarat & Ketentuan</h2>
            <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRich(e.terms) || "<p>—</p>" }} />
          </Card>
          {e.gallery.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {e.gallery.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={g} src={g} alt="" className="aspect-video w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-lg font-bold">Kategori tiket</h2>
          {cats.length === 0 && <Card className="p-4 text-sm text-muted">Belum ada kategori.</Card>}
          {cats.map((c) => {
            const s = categoryStatus(c, c.remaining);
            const [label, tone] = STATUS_LABEL[s];
            return (
              <Card key={c.id} className="p-4" style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{c.name}</h3>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                <p className="mt-2 text-sm">
                  Buka {fmtDateTime(c.open_at, e.timezone)}
                  <br />
                  Tutup {fmtDateTime(c.close_at, e.timezone)}
                </p>
                <QuotaBar claimed={c.quota - c.remaining} quota={c.quota} className="mt-3" />
                <p className="mt-1 text-xs text-muted">
                  Sisa {fmtNumber(c.remaining)} dari {fmtNumber(c.quota)}
                </p>
                <button disabled className="mt-3 w-full rounded-xl bg-cimory-blue py-2.5 font-semibold text-white opacity-50">
                  {s === "UPCOMING" ? "Segera dibuka" : s === "OPEN" ? "Masuk Antrean" : label}
                </button>
              </Card>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
