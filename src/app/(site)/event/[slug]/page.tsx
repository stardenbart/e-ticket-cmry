import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events";
import { fmtDate, fmtTime, TZ_LABEL } from "@/lib/format";
import { safeRichText } from "@/lib/site/sanitize";
import { HtmlTabs } from "@/components/site/tabs";
import { CategoryPanel } from "@/components/site/category-panel";
import { CalIcon, PinIcon } from "@/components/site/event-card";
import { loadCategoryPanel } from "@/components/site/event-panel-data";
import { BrushTagline, LightStick, LineCow, MvImg } from "@/components/site/ornaments";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  return { title: e?.name ?? "Event tidak ditemukan" };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) notFound();
  const { panel } = await loadCategoryPanel(e);
  const mapSrc =
    e.lat != null && e.lng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${e.lng - 0.008},${e.lat - 0.005},${e.lng + 0.008},${e.lat + 0.005}&layer=mapnik&marker=${e.lat},${e.lng}`
      : null;
  const mapLink = e.lat != null && e.lng != null ? `https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=16/${e.lat}/${e.lng}` : null;

  return (
    <div className="pb-28 lg:pb-0">
      <div className="relative pt-16 sm:pt-20">
        {/* Tekstur panggung LED & laser di belakang banner */}
        <div aria-hidden className="mv-texture mv-texture-stage left-1/2 top-4 h-[120%] w-[min(1400px,140vw)] -translate-x-1/2 opacity-60" />
        <div aria-hidden className="mv-texture mv-texture-lasers mv-texture-top left-1/2 -top-20 h-80 w-[min(1400px,140vw)] -translate-x-1/2 opacity-70" />
        <LineCow side="left" className="absolute -left-4 top-24 hidden w-48 opacity-80 xl:block" />
        <LineCow side="right" className="absolute -right-6 top-56 hidden w-52 opacity-80 [animation-delay:-3s] xl:block" />
        <div className="relative mx-auto max-w-6xl px-4">
          <LightStick color="magenta" className="absolute -left-10 -top-6 z-10 hidden w-36 md:block" />
          <LightStick color="cyan" className="absolute -right-10 -bottom-6 z-10 hidden w-40 md:block" />
          <div className="mv-halo">
          <div className="mv-frame relative aspect-[2/1] p-[3px] [--cut:28px]">
            {e.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.banner_url} alt={`Banner ${e.name}`} className="size-full animate-fade-up object-cover [clip-path:polygon(26px_0,100%_0,100%_calc(100%-26px),calc(100%-26px)_100%,0_100%,0_26px)]" />
            ) : (
              <div className="size-full bg-cimory-gradient" />
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/" className="hover:text-cimory-blue">Beranda</Link> /{" "}
            <span className="text-ink">{e.name}</span>
          </nav>
          <div className="space-y-3">
            <span className="font-hud inline-flex items-center gap-1.5 rounded-full border border-[#9afcff]/40 bg-[#062a52]/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#9afcff]">✦ {e.event_type}</span>
            <h1 className="text-3xl leading-[1.15] sm:text-5xl">{e.name}</h1>
            <BrushTagline className="text-xl sm:text-3xl">Good Food Good Mood</BrushTagline>
            {e.organizer && <p className="text-sm text-muted">Diselenggarakan oleh <span className="font-semibold text-ink">{e.organizer}</span></p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={<CalIcon />} title="Tanggal & waktu">
              <p className="font-semibold">{fmtDate(e.start_at, e.timezone)}</p>
              <p className="text-sm text-muted">
                {fmtTime(e.start_at, e.timezone)} – {fmtTime(e.end_at, e.timezone)}
                {e.gate_open_at && <> · Gate dibuka {fmtTime(e.gate_open_at, e.timezone)}</>}
              </p>
              <p className="mt-1 text-xs text-muted">Zona waktu {TZ_LABEL[e.timezone]}</p>
            </InfoCard>
            <InfoCard icon={<PinIcon />} title="Lokasi">
              <p className="font-semibold">{e.venue}</p>
              <p className="text-sm text-muted">{[e.address, e.city].filter(Boolean).join(", ")}</p>
              {mapLink && (
                <a href={mapLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-cimory-blue hover:underline">
                  Buka peta ↗
                </a>
              )}
            </InfoCard>
          </div>

          {mapSrc && (
            <iframe
              title={`Peta lokasi ${e.venue}`}
              src={mapSrc}
              loading="lazy"
              className="h-56 w-full rounded-md border border-[#9afcff]/50 bg-slate-100 shadow-[0_0_20px_rgba(154,252,255,0.2)] sm:h-72"
              referrerPolicy="no-referrer"
            />
          )}

          <div className="rounded-2xl border border-line bg-white p-4 sm:p-6">
            <HtmlTabs
              tabs={[
                { label: "Deskripsi", html: safeRichText(e.description) },
                { label: "Syarat & Ketentuan", html: safeRichText(e.terms) },
              ]}
            />
          </div>

          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-warn ring-1 ring-amber-200">
            <p className="font-semibold">Tiket atas nama sendiri</p>
            <p className="mt-0.5 text-amber-900">
              Nama di tiket diambil dari profil Anda dan dicocokkan dengan identitas fisik (KTP/SIM/Paspor) di gate. Tiket tidak dapat dipindahtangankan.
            </p>
          </div>
        </div>

        <aside id="tiket" aria-label="Kategori tiket" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <h2 className="mv-title mb-4 hidden text-xl lg:block">Pilih Kategori Tiket</h2>
          <div className="relative">
            <MvImg name="headBig" className="mv-peek pointer-events-none absolute -right-3 -top-16 hidden w-28 lg:block" />
            <CategoryPanel {...panel} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9afcff] to-[#f714f7] text-[#062a52]">{icon}</span>
      <div className="min-w-0">
        <p className="font-hud text-xs font-bold uppercase tracking-[0.16em] text-[#9afcff]">{title}</p>
        {children}
      </div>
    </div>
  );
}
