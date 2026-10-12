"use client";

import { useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Scan lewat foto: membuka aplikasi kamera bawaan HP (<input capture>), lalu QR dibaca dari foto
 * dengan jsQR. Berbeda dengan kamera live (getUserMedia), cara ini diizinkan browser di http://,
 * jadi scanner tetap jalan tanpa HTTPS.
 */
export function PhotoScanner({ onDetect, disabled }: { onDetect: (text: string) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "reading" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function decode(file: File) {
    setState({ kind: "reading" });
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const g = canvas.getContext("2d", { willReadFrequently: true })!;
      // Coba beberapa ukuran: foto HP besar (12 MP) lebih cepat & sering lebih akurat setelah diperkecil.
      for (const max of [1280, 1800, 900]) {
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const img = g.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        if (code?.data) {
          bitmap.close?.();
          setState({ kind: "idle" });
          onDetect(code.data);
          return;
        }
      }
      bitmap.close?.();
      setState({ kind: "error", message: "QR tidak terbaca. Foto lebih dekat, pastikan fokus dan tidak silau, lalu coba lagi." });
    } catch {
      setState({ kind: "error", message: "Foto tidak dapat dibaca. Coba ambil foto lagi." });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-center text-white ring-1 ring-white/10">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Foto QR tiket"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) decode(f);
        }}
      />
      <button
        type="button"
        disabled={disabled || state.kind === "reading"}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 text-xl font-bold transition active:scale-[0.99] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {state.kind === "reading" ? "Membaca QR…" : "Foto QR Tiket"}
      </button>
      <p className="mt-3 text-sm text-white/70">Kamera HP akan terbuka. Ambil foto QR dari jarak ±20 cm, lalu tekan OK/Gunakan foto.</p>
      {state.kind === "error" && (
        <p role="alert" className="mt-3 rounded-xl bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-200">
          {state.message}
        </p>
      )}
    </div>
  );
}
