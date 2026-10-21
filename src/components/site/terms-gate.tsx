"use client";

// Persetujuan S&K saat klaim: teks S&K event tampil dalam kotak gulir, dan centang persetujuan baru aktif
// setelah peserta menggulir sampai bawah. Murni tampilan — server tetap hanya memeriksa `agree: true`.
import { useCallback, useEffect, useRef, useState } from "react";

export function TermsGate({ html, agreed, onAgree }: { html: string; agreed: boolean; onAgree: (v: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(false);

  const check = useCallback(() => {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true);
  }, []);

  // Teks pendek yang tidak perlu digulir langsung dianggap terbaca.
  useEffect(() => {
    check();
  }, [check, html]);

  return (
    <section aria-labelledby="sk-title" className="rounded-xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 id="sk-title" className="text-sm font-bold uppercase tracking-wide">
          Syarat &amp; Ketentuan Klaim Tiket
        </h3>
        <span className={`shrink-0 text-xs font-semibold ${read ? "text-ok" : "text-muted"}`}>{read ? "✓ Sudah dibaca" : "Gulir sampai bawah ↓"}</span>
      </div>
      <div
        ref={box}
        onScroll={check}
        tabIndex={0}
        aria-label="Isi syarat dan ketentuan"
        className="rich-text max-h-72 overflow-y-auto px-4 py-3 text-sm"
        dangerouslySetInnerHTML={{ __html: html || "<p>-</p>" }}
      />
      <label className={`flex items-start gap-3 border-t border-line px-4 py-3 text-sm ${read ? "" : "opacity-60"}`}>
        <input
          type="checkbox"
          checked={agreed}
          disabled={!read}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-cimory-blue disabled:cursor-not-allowed"
        />
        <span>
          Saya telah membaca, memahami, dan menyetujui Syarat &amp; Ketentuan di atas, serta memahami bahwa tiket atas nama saya tidak dapat
          dipindahtangankan.
          {!read && <span className="mt-1 block text-xs text-muted">Gulir isi S&amp;K sampai bawah untuk mengaktifkan centang.</span>}
        </span>
      </label>
    </section>
  );
}
