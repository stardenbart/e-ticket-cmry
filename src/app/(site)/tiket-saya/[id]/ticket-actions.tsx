"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";

type WakeLockSentinel = { release: () => Promise<void> };

export function TicketActions(props: {
  ticketId: string;
  usable: boolean;
  status: string;
  canCancel: boolean;
  deadlineText: string;
  holderName: string;
  eventName: string;
  emailStatus: string;
  email: string;
}) {
  const router = useRouter();
  const [bright, setBright] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "blue"; text: string } | null>(null);
  const [busy, setBusy] = useState<"resend" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const qrSrc = `/api/tickets/${props.ticketId}?format=qr`;

  // Mode layar terang: cegah layar mati selama QR ditampilkan.
  useEffect(() => {
    if (!bright) return;
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBright(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [bright]);

  async function resend() {
    setBusy("resend");
    setMsg(null);
    try {
      const r = await api<{ message: string }>(`/api/tickets/${props.ticketId}`, { json: { action: "resend" } });
      setMsg({ tone: "green", text: `${r.message} Cek inbox ${props.email} (dan folder spam).` });
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof ClientApiError ? e.message : "Gagal mengirim ulang email." });
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setMsg(null);
    try {
      const r = await api<{ message: string }>(`/api/tickets/${props.ticketId}`, { json: { action: "cancel" } });
      setConfirmCancel(false);
      setMsg({ tone: "blue", text: r.message });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof ClientApiError ? e.message : "Gagal membatalkan tiket." });
      setConfirmCancel(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 p-5">
      {props.usable ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setBright(true)}
            className="mv-paper group relative rounded-2xl bg-white p-4 ring-2 ring-[#ff2bd6] transition hover:shadow-[0_0_30px_rgba(34,229,255,0.35)]"
            aria-label="Tampilkan QR layar penuh (mode terang)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR tiket" className="size-60" />
            <span className="absolute inset-x-3 bottom-3 rounded-lg bg-cimory-blue/90 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Ketuk untuk layar penuh
            </span>
          </button>
          <Button variant="secondary" onClick={() => setBright(true)} className="w-full">
            ☀ Mode layar terang
          </Button>
          {props.status === "CHECKED_IN" && <p className="text-center text-sm text-muted">Tiket ini sudah dipakai check-in.</p>}
        </div>
      ) : (
        <div className="grid place-items-center rounded-2xl bg-slate-100 p-8 text-center text-sm text-muted">
          <p className="text-3xl" aria-hidden>🚫</p>
          <p className="mt-2 font-semibold text-ink">QR tidak tersedia</p>
          <p>{props.status === "CANCELLED" ? "Tiket ini sudah dibatalkan." : props.status === "REVOKED" ? "Tiket ini sudah dicabut." : "Acara sudah selesai."}</p>
        </div>
      )}

      {props.status === "ACTIVE" && props.usable && (
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={`/api/tickets/${props.ticketId}?format=pdf`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cimory-blue px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-cimory-blue-dark active:scale-[0.98]"
          >
            ⬇ Unduh PDF
          </a>
          <Button variant="secondary" onClick={resend} disabled={busy !== null}>
            {busy === "resend" && <Spinner />} ✉ Kirim ulang email
          </Button>
        </div>
      )}
      {props.emailStatus === "FAILED" && props.status === "ACTIVE" && (
        <Alert tone="amber">Email tiket sebelumnya gagal terkirim. Coba kirim ulang, atau gunakan QR di halaman ini.</Alert>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {props.status === "ACTIVE" && (
        <div className="rounded-xl bg-cimory-light p-4 text-sm">
          {props.canCancel ? (
            <>
              <p className="text-slate-700">
                Tidak bisa hadir? Batalkan sebelum <b>{props.deadlineText}</b> agar slot bisa dipakai orang lain.
              </p>
              <button type="button" onClick={() => setConfirmCancel(true)} className="mt-2 font-semibold text-cimory-red-dark underline">
                Batalkan tiket
              </button>
            </>
          ) : (
            <p className="text-muted">Batas pembatalan ({props.deadlineText}) sudah lewat.</p>
          )}
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-4" onClick={() => setConfirmCancel(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md animate-pop rounded-t-3xl border border-[#22e5ff]/40 bg-[#0a0b2e] p-6 shadow-2xl sm:rounded-[18px_48px_18px_48px]" onClick={(e) => e.stopPropagation()}>
            <h2 id="cancel-title" className="text-xl font-bold">Batalkan tiket ini?</h2>
            <p className="mt-2 text-muted">
              Tiket {props.eventName} atas nama {props.holderName} akan dibatalkan dan QR langsung tidak berlaku. Slot dikembalikan ke kuota dan tidak bisa dikembalikan ke Anda.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)} className="flex-1" autoFocus>
                Tidak jadi
              </Button>
              <Button variant="danger" onClick={cancel} disabled={busy !== null} className="flex-1">
                {busy === "cancel" && <Spinner />} Ya, batalkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {bright && (
        <div role="dialog" aria-modal="true" aria-label="QR tiket layar penuh" className="mv-paper fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-white p-6" onClick={() => setBright(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="QR tiket" className="aspect-square w-full max-w-[min(90vw,70vh)]" />
          <div className="text-center">
            <p className="text-xl font-bold text-ink">{props.holderName}</p>
            <p className="text-muted">{props.eventName}</p>
          </div>
          <p className="rounded-full bg-[#fef3c7] px-4 py-2 text-sm font-semibold text-[#92400e] ring-1 ring-[#fcd34d]">☀ Naikkan kecerahan layar ke maksimum</p>
          <button type="button" className="min-h-11 rounded-full px-5 py-2 font-semibold text-[#1b3a6f] hover:bg-slate-100" onClick={() => setBright(false)}>
            Tutup
          </button>
        </div>
      )}
    </div>
  );
}
