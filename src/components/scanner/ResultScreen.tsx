"use client";

import { useEffect, useState } from "react";
import { idTypeLabel, type ManifestTicket } from "@/lib/scanner/validate";

export type Overlay =
  | { kind: "verify"; ticket: ManifestTicket; version: number; method: "QR" | "MANUAL"; scannedAt: string; requireId: boolean }
  | { kind: "red"; title: string; reason: string; ticket?: ManifestTicket; method: "QR" | "MANUAL" }
  | { kind: "admitted"; ticket: ManifestTicket; offline: boolean }
  | { kind: "rejected"; ticket?: ManifestTicket; reason: string; offline: boolean };

const REJECT_REASONS = ["Nama tidak cocok", "4 digit identitas tidak cocok", "Tidak membawa identitas asli", "Identitas palsu / rusak", "Lainnya"];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m7 12.5 3.2 3.2L17 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 8.5 7 7m0-7-7 7" strokeLinecap="round" />
    </svg>
  );
}
function IdIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5.5 16c.6-1.5 1.8-2.3 3-2.3s2.4.8 3 2.3M14 10h4.5M14 13.5h3" strokeLinecap="round" />
    </svg>
  );
}

function TicketFacts({ t, showId }: { t: ManifestTicket; showId: boolean }) {
  return (
    <dl className="mt-6 w-full max-w-md space-y-3 rounded-2xl bg-white/15 p-5 text-left">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider opacity-80">Nama pemegang</dt>
        <dd className="text-3xl font-extrabold leading-tight break-words">{t.holder_name}</dd>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider opacity-80">Kategori</dt>
          <dd className="text-xl font-bold">{t.category_name}</dd>
        </div>
        {showId && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider opacity-80">Identitas</dt>
            <dd className="text-xl font-bold">
              {idTypeLabel(t.id_type)} ••••<span className="font-mono text-3xl tracking-widest">{t.id_last4 ?? "----"}</span>
            </dd>
          </div>
        )}
      </div>
    </dl>
  );
}

export function ResultScreen({
  overlay,
  busy,
  onAdmit,
  onReject,
  onClose,
}: {
  overlay: Overlay;
  busy: boolean;
  onAdmit: () => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);

  useEffect(() => {
    setRejecting(false);
    setReason(REJECT_REASONS[0]);
  }, [overlay]);

  // Hasil "diizinkan masuk" tertutup otomatis agar antrean gate tetap jalan.
  useEffect(() => {
    if (overlay.kind !== "admitted") return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [overlay, onClose]);

  const base = "fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-5 pb-8 pt-10 text-center text-white animate-pop";

  if (overlay.kind === "verify") {
    return (
      <div className={`${base} bg-green-700`} role="dialog" aria-modal="true" aria-labelledby="res-title">
        <IdIcon />
        <p className="mt-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold uppercase tracking-wider">
          QR valid{overlay.method === "MANUAL" ? " · pencarian manual" : ""}
        </p>
        <h2 id="res-title" className="mt-3 text-3xl font-extrabold">
          Perlu cek identitas
        </h2>
        <p className="mt-1 max-w-sm text-white/90">Cocokkan nama{overlay.requireId ? " dan 4 digit terakhir" : ""} dengan kartu identitas fisik.</p>
        <TicketFacts t={overlay.ticket} showId={overlay.requireId} />
        {!rejecting ? (
          <div className="mt-8 grid w-full max-w-md gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onAdmit}
              className="min-h-16 rounded-2xl bg-white text-xl font-extrabold text-green-800 shadow-lg active:scale-[0.98] disabled:opacity-60"
            >
              ✓ Cocok, izinkan masuk
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="min-h-14 rounded-2xl border-2 border-white/80 text-lg font-bold active:scale-[0.98] disabled:opacity-60"
            >
              ✕ Tidak cocok, tolak
            </button>
            <button type="button" onClick={onClose} disabled={busy} className="mt-1 text-sm font-semibold text-white/80 underline">
              Batal (tanpa keputusan)
            </button>
          </div>
        ) : (
          <div className="mt-6 w-full max-w-md rounded-2xl bg-white p-4 text-left text-ink">
            <p className="font-bold">Alasan penolakan</p>
            <div className="mt-3 grid gap-2">
              {REJECT_REASONS.map((r) => (
                <label key={r} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-5" />
                  <span className="font-medium">{r}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRejecting(false)} className="min-h-12 rounded-xl border border-line font-semibold">
                Kembali
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReject(reason)}
                className="min-h-12 rounded-xl bg-cimory-red text-lg font-bold text-white disabled:opacity-60"
              >
                Tolak masuk
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (overlay.kind === "admitted") {
    return (
      <button type="button" onClick={onClose} className={`${base} justify-center bg-green-700`} aria-live="assertive">
        <CheckIcon />
        <h2 className="mt-4 text-4xl font-extrabold">Silakan masuk</h2>
        <p className="mt-2 text-2xl font-bold">{overlay.ticket.holder_name}</p>
        <p className="text-lg text-white/90">{overlay.ticket.category_name}</p>
        {overlay.offline && (
          <p className="mt-4 rounded-full bg-amber-400 px-4 py-1.5 font-bold text-amber-950">⚠ Offline — tersimpan, akan disinkron</p>
        )}
        <p className="mt-8 text-sm text-white/80">Ketuk untuk scan berikutnya</p>
      </button>
    );
  }

  const ticket = overlay.ticket;
  const title = overlay.kind === "red" ? overlay.title : "Masuk ditolak";
  return (
    <div className={`${base} bg-red-700`} role="alertdialog" aria-modal="true" aria-labelledby="res-title">
      <XIcon />
      <h2 id="res-title" className="mt-3 text-4xl font-extrabold">
        {title}
      </h2>
      <p className="mt-3 max-w-md rounded-2xl bg-white/15 px-4 py-3 text-xl font-bold">{overlay.reason}</p>
      {overlay.kind === "rejected" && overlay.offline && (
        <p className="mt-3 rounded-full bg-amber-400 px-4 py-1.5 font-bold text-amber-950">⚠ Offline — tersimpan, akan disinkron</p>
      )}
      {ticket && (
        <div className="mt-2 w-full max-w-md text-left">
          <TicketFacts t={ticket} showId={false} />
        </div>
      )}
      <button type="button" onClick={onClose} className="mt-8 min-h-16 w-full max-w-md rounded-2xl bg-white text-xl font-extrabold text-red-800 shadow-lg">
        Scan berikutnya
      </button>
    </div>
  );
}
