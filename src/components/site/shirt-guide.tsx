// Gambar desain/mock-up baju & chart ukuran yang diunggah admin per event.
// Dipakai di halaman event dan di form klaim (di atas pilihan ukuran baju). Klik gambar → buka ukuran penuh.

export function ShirtGuide({ design, chart, compact = false }: { design: string | null; chart: string | null; compact?: boolean }) {
  const items = [
    design && { src: design, label: "Desain baju" },
    chart && { src: chart, label: "Chart ukuran baju" },
  ].filter(Boolean) as { src: string; label: string }[];
  if (!items.length) return null;
  return (
    <div className={`grid gap-3 ${items.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {items.map((it) => (
        <figure key={it.label} className="overflow-hidden rounded-xl border border-line bg-white/5">
          <a href={it.src} target="_blank" rel="noopener" title={`${it.label} — buka ukuran penuh`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.src} alt={it.label} loading="lazy" decoding="async" className={`w-full bg-white object-contain ${compact ? "max-h-64" : "max-h-[28rem]"}`} />
          </a>
          <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-muted">
            <span>{it.label}</span>
            <span aria-hidden>Ketuk untuk perbesar ↗</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
