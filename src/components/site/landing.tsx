// Bagian landing page event utama (beranda): tentang acara + panel tiket, sorotan, cara kerja.
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import type { EventRow } from "@/lib/events";
import { fmtDate, fmtTime } from "@/lib/format";
import { CalIcon, PinIcon } from "./event-card";
import { CategoryPanel } from "./category-panel";
import { MascotVideo } from "./mascot-video";
import type { loadCategoryPanel } from "./event-panel-data";
import { FrameTitle, MvImg } from "./ornaments";

/** Ringkasan deskripsi (teks polos) untuk landing page. */
export function excerpt(html: string, max = 260) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max
    ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…`
    : text;
}

export type PanelProps = Awaited<ReturnType<typeof loadCategoryPanel>>["panel"];

/** Tentang acara + panel kategori tiket langsung di beranda. */
export function About({ e, panel }: { e: EventRow; panel: PanelProps }) {
  return (
    <section
      id="acara"
      aria-labelledby="acara-title"
      className="relative scroll-mt-24 overflow-hidden pt-20 sm:pt-24"
    >
      <div className="relative mx-auto max-w-6xl px-4">
        <FrameTitle sub="Rayakan keseruan-Moo bersama CMD Plant Sentul">
          <span id="acara-title">Tentang Acara</span>
        </FrameTitle>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_400px]">
          <div className="mv-reveal min-w-0 space-y-6">
            <div className="mv-card relative overflow-hidden p-6 sm:p-8">
              <p className="font-hud text-sm font-bold uppercase tracking-[0.2em] text-[#9afcff]">
                ✦ {e.event_type} · by Cimory
              </p>
              <h3 className="mv-neon mt-3 pr-16 text-xl leading-snug sm:text-2xl">
                {e.name}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[#e3edfa]">
                {excerpt(e.description)}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Info icon={<CalIcon />} title="Tanggal & waktu">
                  <p className="font-semibold text-white">
                    {fmtDate(e.start_at, e.timezone)}
                  </p>
                  <p className="text-sm text-[#d3e2f5]">
                    {fmtTime(e.start_at, e.timezone)} –{" "}
                    {fmtTime(e.end_at, e.timezone)}
                  </p>
                </Info>
                <Info icon={<PinIcon />} title="Lokasi">
                  <p className="font-semibold text-white">{e.venue}</p>
                  <p className="text-sm text-[#d3e2f5]">{e.city}</p>
                </Info>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/event/${e.slug}`}
                  className="font-hud inline-flex h-11 items-center rounded-full border-2 border-[#9afcff] px-6 text-base font-bold uppercase tracking-[0.12em] text-[#9afcff] shadow-[0_0_14px_rgba(154,252,255,0.35)] transition hover:bg-[#9afcff]/10"
                >
                  Detail lengkap & S&K
                </Link>
              </div>
            </div>
          </div>

          <aside
            id="tiket"
            aria-label="Kategori tiket"
            className="mv-reveal relative scroll-mt-24"
          >
            <h3 className="mv-title mb-4 hidden text-xl lg:block">
              Pilih Kategori Tiket
            </h3>
            <CategoryPanel {...panel} />
          </aside>
        </div>
      </div>
    </section>
  );
}

function Info({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#9afcff]/25 bg-[#020a17]/60 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9afcff] to-[#f714f7] text-[#062a52]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-hud text-xs font-bold uppercase tracking-[0.16em] text-[#9afcff]">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

const HIGHLIGHTS: {
  icon: "boltNeon" | "crownNeon" | "heart" | "m";
  title: string;
  text: string;
}[] = [
  {
    icon: "boltNeon",
    title: "Konser Neon",
    text: "Panggung MOO dengan laser, layar LED, dan band live sepanjang malam.",
  },
  {
    icon: "heart",
    title: "Good Food Good Mood",
    text: "Area kuliner dan sampling produk Cimory untuk seluruh karyawan.",
  },
  {
    icon: "crownNeon",
    title: "Photo Spot",
    text: "Menara MOO, blimp neon, dan maskot MOO siap jadi latar foto.",
  },
  {
    icon: "m",
    title: "Kaos Acara",
    text: "Setiap pemegang tiket mendapat kaos sesuai ukuran yang dipilih saat klaim.",
  },
];

/** Sorotan acara: kartu neon dengan ikon dari visual stock. */
export function Highlights() {
  return (
    <section
      aria-labelledby="sorotan"
      className="relative mx-auto max-w-6xl px-4 pt-24"
    >
      <FrameTitle icon="boltNeon">
        <span id="sorotan">Sorotan Acara</span>
      </FrameTitle>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {HIGHLIGHTS.map((h, i) => (
          <li
            key={h.title}
            className="mv-card mv-reveal relative overflow-hidden p-6 text-center"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <MvImg name={h.icon} className="mx-auto h-14 w-auto" />
            <h3 className="mv-neon mt-4 text-base">{h.title}</h3>
            <p className="mt-2 text-sm text-[#d3e2f5]">{h.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  [
    "Daftar dengan NIK",
    "Buat akun memakai NIK karyawan (CMD: 04.xxxx · OS: A1.xx.xxxx), nama sesuai Kartu Karyawan, email, dan password.",
  ],
  [
    "Masuk Antrean",
    "Antrean dibuka 10 menit sebelum pemesanan. Urutan diacak saat dibuka agar adil bagi semua.",
  ],
  [
    "Klaim Tiket",
    "Saat giliran tiba, isi ulang nama, NIK, dan ukuran baju. Sistem mencocokkan dengan daftar karyawan.",
  ],
  [
    "Datang ke Gate",
    "QR dikirim ke email dan tersedia di Tiket Saya. Bawa Kartu Karyawan untuk dicocokkan.",
  ],
];

/** Cara kerja: ikon kepala sapi sebagai pemandu + timeline neon. Tombol daftar hanya untuk yang belum login. */
export async function HowItWorks() {
  const user = await currentUser();
  return (
    <section className="relative pt-24" aria-labelledby="cara-kerja">
      <div className="relative mx-auto max-w-6xl space-y-12 px-4">
        <FrameTitle
          sub="Empat langkah dari daftar sampai masuk venue."
          icon="crownNeon"
        >
          <span id="cara-kerja">Cara Kerja</span>
        </FrameTitle>
        <div className="grid items-center gap-10 lg:grid-cols-[320px_1fr]">
          <div className="mv-reveal relative mx-auto w-full max-w-[260px] text-center lg:max-w-none">
            <MascotVideo alt="Maskot MOO berkacamata VR menari" className="mx-auto w-full max-w-[300px]" />
            <p className="font-hud mt-3 text-lg font-bold uppercase tracking-[0.14em] text-[#9afcff]">
              1 NIK · 1 Tiket
            </p>
          </div>
          <ol className="relative space-y-6 pl-16 sm:pl-28">
            <span
              aria-hidden
              className="mv-timeline-line absolute bottom-0 left-12 top-0 w-0.5 sm:left-20"
            />
            {STEPS.map(([t, d], i) => (
              <li
                key={t}
                className="mv-reveal relative"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <span
                  aria-hidden
                  className="font-digits absolute -left-16 top-4 w-9 text-right text-3xl font-black text-[#9afcff] mv-glow-cyan sm:-left-28 sm:w-[68px] sm:text-5xl"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className="absolute -left-4 top-10 h-0.5 w-4 bg-[#f714f7] shadow-[0_0_8px_#f714f7] sm:-left-8 sm:w-8"
                />
                <span
                  aria-hidden
                  className="absolute -left-[19px] top-[36px] size-2.5 rotate-45 bg-[#f714f7] shadow-[0_0_10px_#f714f7] sm:-left-[35px]"
                />
                <div className="mv-frame mv-frame-sm px-6 py-5 sm:px-8">
                  <h3 className="mv-title text-sm tracking-[0.1em] sm:text-lg">
                    {t}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#e3edfa] sm:text-base">
                    {d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {!user && (
          <p className="flex justify-center">
            <Link
              href="/daftar"
              className="font-hud inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#0827b5)] px-7 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(247,20,247,0.45)] ring-1 ring-white/30 transition hover:brightness-110"
            >
              Daftar dengan NIK
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
