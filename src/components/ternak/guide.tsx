"use client";

// Panduan "Grow your Cow, Grow your Country" (dibuka saat memberi nama sapi & dari tombol Panduan).
type Catalog = {
  feeds: Record<string, { name: string; grade: string; price: number; kg: number; emoji: string; desc: string }>;
  medicine: { name: string; price: number; emoji: string; desc: string };
  outfits: Record<string, { name: string; price: number; aff: number; emoji: string }>;
  milk: readonly { ml: number; grade: string; price: number }[];
  schedule: string[];
};

export function GuideContent({ catalog }: { catalog: Catalog }) {
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="font-hud mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">{children}</h3>;
  return (
    <div className="text-sm leading-relaxed text-[#e6ecff]">
      <p>
        Main games → kumpulkan <b>poin</b> → poin jadi <b>🪙 Moo-coins</b> → rawat sapimu sampai jadi sapi paling bahagia, paling berat, dan penghasil susu terbaik se-Mooniverse!
      </p>
      <H>Sumber Moo-coins</H>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>TTS (sekali): modal awal 150 + 3 × skor, bonus kalau sempurna & cepat.</li>
        <li>Moordle (harian): tertebak di percobaan ke-1 = 120 koin … ke-6 = 30 koin, plus bonus cepat.</li>
        <li>Flappy, Dino, Ular, Balap: setiap poin ditukar koin dengan kurs per game (Flappy paling tinggi, Balap paling rendah), dengan batas poin harian per game.</li>
        <li>Panen susu tiap malam dijual otomatis jadi koin.</li>
      </ul>
      <H>Jadwal harian (WIB)</H>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {catalog.schedule.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="mt-1 text-white/70">Lewat jadwal makan = sapi kelaparan: berat −2 kg dan afeksi turun.</p>
      <H>Pakan</H>
      <ul className="mt-1 space-y-1">
        {Object.values(catalog.feeds).map((f) => (
          <li key={f.name}>
            {f.emoji} <b>{f.name}</b> ({f.grade}) — 🪙 {f.price}, +{f.kg} kg. {f.desc}
          </li>
        ))}
      </ul>
      <H>Kebersihan & kesehatan</H>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Setiap makan, sapi pup 💩. Makin lama dibiarkan, makin mudah sakit — bersihkan gratis kapan saja.</li>
        <li>Sapi sakit 🤒 tidak mau makan, tidak menghasilkan susu, dan beratnya turun lebih cepat (−4 kg per jadwal).</li>
        <li>
          {catalog.medicine.emoji} <b>{catalog.medicine.name}</b> — 🪙 {catalog.medicine.price}. {catalog.medicine.desc}
        </li>
      </ul>
      <H>Afeksi (1–5 ♥)</H>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Naik: makan tepat waktu, kandang dibersihkan, dielus sekali sehari, main game hari itu, baju baru.</li>
        <li>Turun: kelaparan, sakit, kandang penuh kotoran, dan rindu (−1 tiap hari).</li>
      </ul>
      <H>Susu</H>
      <p className="mt-1">Makin banyak hati, makin tinggi grade susu. Pedet maksimal 250 ml, Remaja 750 ml, Dewasa (≥ 300 kg) bisa sampai 950 ml.</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs sm:grid-cols-6">
        {catalog.milk.map((m) => (
          <div key={m.ml} className={`rounded-lg border p-1.5 ${m.grade === "S" ? "border-[#ff2e9f] text-[#ffb3dc]" : "border-white/15"}`}>
            <b className="block text-base">{m.grade}</b>
            {m.ml} ml
            <span className="block text-white/60">🪙 {m.price}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-white/80">
        ✨ <b>Grade S (950 ml)</b> sangat langka: sapi Dewasa, 5 ♥, sehat, dan makan Konsentrat Supernova dua kali hari itu. Tetap adil — setelah 7 hari memenuhi syarat tanpa S, panen berikutnya pasti S.
      </p>
      <H>Butik Sapi</H>
      <p className="mt-1">
        {Object.values(catalog.outfits)
          .map((o) => `${o.emoji} ${o.name} (🪙 ${o.price.toLocaleString("id-ID")}, +${o.aff} afeksi)`)
          .join(" · ")}
        . Mahal — jangan sampai tidak bisa beli obat!
      </p>
      <H>Juara</H>
      <p className="mt-1">Peringkat: jumlah hati → berat sapi → total susu → siapa yang lebih dulu mencapainya. Setelah periode games berakhir, kondisi sapi dibekukan dan 3 juara diumumkan di hari H acara.</p>
    </div>
  );
}

export function FarmGuide({ catalog, onClose }: { catalog: Catalog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,2,18,.85)] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label="Panduan beternak" className="relative max-h-[88vh] w-full max-w-lg overflow-auto rounded-2xl border-2 border-[#19e6ff] bg-[#150b35] p-5 shadow-[0_0_24px_rgba(25,230,255,.4)]">
        <button type="button" aria-label="Tutup" onClick={onClose} className="absolute right-3 top-2 text-2xl text-white">
          ×
        </button>
        <h2 className="mv-title text-xl">Panduan Peternak</h2>
        <GuideContent catalog={catalog} />
        <button type="button" onClick={onClose} className="mt-4 block w-full rounded-[10px] bg-[#ff2e9f] p-3 font-extrabold text-white shadow-[0_0_14px_rgba(255,46,159,.6)]">
          Siap beternak!
        </button>
      </div>
    </div>
  );
}
