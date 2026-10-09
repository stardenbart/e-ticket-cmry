"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, ButtonLink, Card, Spinner } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtNumber } from "@/lib/format";
import type { AltCategory } from "@/lib/site/category-context";
import { FlipCountdown } from "@/components/site/countdown";
import { AltCategories } from "@/components/site/alt-categories";
import { humanDuration } from "@/components/site/use-server-now";
import { MvImg } from "@/components/site/ornaments";

type QS =
  | { state: "NOT_IN_QUEUE" }
  | { state: "WAITING_PRE"; opensAt: number; serverNow: number }
  | { state: "WAITING"; position: number; etaSec: number; total: number; serverNow: number }
  | { state: "ADMITTED"; token: string; expiresAt: number; serverNow: number }
  | { state: "EXPIRED" }
  | { state: "SOLD_OUT" }
  | { state: "CLOSED" }
  | { state: "HAS_TICKET"; ticketId: string };

const CALM = [
  "Tetap di halaman ini — posisi Anda aman selama tab ini terbuka.",
  "Antrean berjalan otomatis. Tidak perlu me-refresh halaman.",
  "Semua orang diproses berurutan sesuai antrean di server.",
  "Siapkan diri: setelah giliran tiba, Anda punya 5 menit untuk klaim.",
];

export function WaitingRoom(props: { categoryId: string; categoryName: string; slug: string; openAt: string; batch: number; intervalSec: number; alternatives: AltCategory[] }) {
  const { categoryId, slug } = props;
  const router = useRouter();
  const [qs, setQs] = useState<QS | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [maxPos, setMaxPos] = useState(0);
  const [calm, setCalm] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rejoinToken, setRejoinToken] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  const poll = useCallback(async () => {
    if (stopped.current) return;
    try {
      const s = await api<QS>(`/api/queue?categoryId=${categoryId}`, { cache: "no-store" });
      setNetError(null);
      setQs(s);
      if (s.state === "WAITING") setMaxPos((m) => Math.max(m, s.position));
      if (s.state === "ADMITTED") {
        stopped.current = true;
        try {
          sessionStorage.setItem(`adm:${categoryId}`, JSON.stringify({ token: s.token, expiresAt: s.expiresAt, serverNow: s.serverNow, at: Date.now() }));
        } catch {}
        router.replace(`/konfirmasi/${categoryId}`);
        return;
      }
      if (s.state === "HAS_TICKET") {
        stopped.current = true;
        router.replace(`/tiket-saya/${s.ticketId}`);
        return;
      }
      if (s.state === "SOLD_OUT" || s.state === "CLOSED" || s.state === "NOT_IN_QUEUE" || s.state === "EXPIRED") {
        // Status final: berhenti poll sampai pengguna mengambil aksi.
        return;
      }
    } catch (e) {
      setNetError(e instanceof ClientApiError ? e.message : "Koneksi bermasalah.");
      if (e instanceof ClientApiError && e.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/antrean/${categoryId}`)}`);
        return;
      }
    }
    const jitter = Math.random() * 800;
    timer.current = setTimeout(poll, 2500 + jitter);
  }, [categoryId, router]);

  useEffect(() => {
    stopped.current = false;
    poll();
    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  useEffect(() => {
    const id = setInterval(() => setCalm((c) => (c + 1) % CALM.length), 6000);
    return () => clearInterval(id);
  }, []);

  // Peringatan saat menutup tab selama menunggu.
  useEffect(() => {
    const waiting = qs?.state === "WAITING" || qs?.state === "WAITING_PRE";
    if (!waiting) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [qs?.state]);

  async function leave() {
    if (!confirm("Keluar dari antrean? Posisi Anda akan hilang.")) return;
    setBusy(true);
    stopped.current = true;
    await api("/api/queue", { json: { action: "leave", categoryId } }).catch(() => {});
    router.push(`/event/${slug}`);
  }

  async function rejoin() {
    setBusy(true);
    try {
      const s = await api<QS>("/api/queue", { json: { action: "rejoin", categoryId, turnstileToken: rejoinToken ?? undefined } });
      setQs(s);
      setMaxPos(0);
      stopped.current = false;
      poll();
    } catch (e) {
      setNetError(e instanceof ClientApiError ? e.message : "Gagal masuk antrean lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (!qs)
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Spinner className="size-8 text-cimory-blue" />
        <p className="font-semibold">Memeriksa posisi antrean…</p>
      </Card>
    );

  return (
    <div className="space-y-4">
      {netError && <Alert tone="amber">{netError} Kami akan mencoba lagi otomatis.</Alert>}

      {qs.state === "WAITING_PRE" && (
        <Card className="overflow-hidden">
          <div className="bg-cimory-gradient relative p-6 text-center text-white">
            <MvImg name="cowChill" alt="" className="mv-float mx-auto mb-2 h-24 w-auto" />
            <p className="font-hud text-sm font-bold uppercase tracking-[0.2em] text-[#22e5ff]">Anda sudah di antrean</p>
            <p className="mv-title mt-1 text-2xl font-extrabold">Penjualan Dibuka Dalam</p>
          </div>
          <div className="space-y-4 p-6 text-center">
            <FlipCountdown target={qs.opensAt} size="lg" className="justify-center" />
            <p className="text-sm text-slate-700">
              Semua yang masuk sebelum jam buka akan <b>diacak urutannya</b> tepat saat dibuka — jadi tidak perlu berlomba refresh di detik terakhir.
            </p>
            <DontClose />
          </div>
        </Card>
      )}

      {qs.state === "WAITING" && (
        <Card className="overflow-hidden">
          <div className="bg-cimory-gradient relative overflow-hidden p-6 text-center text-white">
            <MvImg name="cowRock" alt="" className="mv-float pointer-events-none absolute -left-3 bottom-0 hidden h-24 w-auto opacity-90 sm:block" />
            <MvImg name="cowChill" alt="" className="mv-float-slow pointer-events-none absolute -right-3 bottom-0 hidden h-24 w-auto opacity-90 sm:block" />
            <p className="font-hud text-sm font-bold uppercase tracking-[0.2em] text-[#22e5ff]">Posisi Anda di antrean</p>
            <p key={qs.position} className="font-display mv-glow mt-2 animate-pop text-7xl font-black tabular-nums" aria-live="polite">
              {fmtNumber(qs.position)}
            </p>
            <p className="mt-1 text-white/85">dari {fmtNumber(qs.total)} orang yang mengantre</p>
          </div>
          <div className="space-y-5 p-6">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold">Progres antrean</span>
                <span className="text-muted">± {humanDuration(qs.etaSec * 1000)} lagi</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-[#22e5ff]/25" role="progressbar" aria-label="Progres antrean" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress(qs.position, maxPos)}>
                <div className="progress-stripes h-full rounded-full bg-[#ff2bd6] bg-blend-overlay transition-[width] duration-700" style={{ width: `${progress(qs.position, maxPos)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                Sistem meloloskan {props.batch} orang setiap {props.intervalSec} detik.
              </p>
            </div>
            <p key={calm} className="animate-fade-up rounded-xl bg-blue-50 px-4 py-3 text-center text-sm text-cimory-blue">
              {CALM[calm]}
            </p>
            <DontClose />
          </div>
        </Card>
      )}

      {qs.state === "EXPIRED" && (
        <Card className="space-y-4 p-6 text-center">
          <MvImg name="cowWink" className="mx-auto h-28 w-auto" />
          <h2 className="text-xl font-bold">Waktu klaim Anda habis</h2>
          <p className="text-muted">Giliran Anda sudah tiba, tapi tiket tidak diklaim dalam 5 menit. Anda bisa masuk antrean lagi dari urutan paling belakang.</p>
          <Turnstile onToken={setRejoinToken} />
          <Button onClick={rejoin} disabled={busy || rejoinToken === null} className="w-full">
            {busy && <Spinner />} Masuk antrean lagi
          </Button>
        </Card>
      )}

      {qs.state === "SOLD_OUT" && (
        <Card className="space-y-4 p-6">
          <div className="text-center">
            <MvImg name="cowChill" className="mx-auto h-28 w-auto" />
            <h2 className="mt-2 text-xl font-bold">Maaf, kuota {props.categoryName} sudah habis</h2>
            <p className="mt-1 text-muted">Antrean ditutup karena semua tiket di kategori ini sudah diklaim.</p>
          </div>
          <AltCategories slug={slug} items={props.alternatives} />
          <ButtonLink href={`/event/${slug}`} variant="secondary" className="w-full">
            Kembali ke halaman event
          </ButtonLink>
        </Card>
      )}

      {qs.state === "CLOSED" && (
        <Card className="space-y-4 p-6 text-center">
          <MvImg name="cowChill" className="mx-auto h-28 w-auto" />
          <h2 className="text-xl font-bold">Pemesanan sudah ditutup</h2>
          <p className="text-muted">Kategori {props.categoryName} sedang tidak menerima klaim.</p>
          <ButtonLink href={`/event/${slug}`} className="w-full">Kembali ke halaman event</ButtonLink>
        </Card>
      )}

      {qs.state === "NOT_IN_QUEUE" && (
        <Card className="space-y-4 p-6 text-center">
          <MvImg name="cowWink" className="mx-auto h-28 w-auto" />
          <h2 className="text-xl font-bold">Anda belum masuk antrean</h2>
          <p className="text-muted">Masuk antrean dari halaman event. Tombol aktif 10 menit sebelum penjualan dibuka.</p>
          <ButtonLink href={`/event/${slug}`} className="w-full">Ke halaman event</ButtonLink>
        </Card>
      )}

      {(qs.state === "WAITING" || qs.state === "WAITING_PRE") && (
        <div className="text-center">
          <button type="button" onClick={leave} disabled={busy} className="text-sm font-semibold text-muted underline hover:text-ink">
            Keluar dari antrean
          </button>
        </div>
      )}
      <p className="text-center text-xs text-muted">
        <Link href="/faq" className="underline">Bagaimana antrean bekerja?</Link>
      </p>
    </div>
  );
}

function progress(position: number, maxPos: number) {
  if (maxPos <= 1) return 8;
  return Math.max(8, Math.min(98, Math.round((1 - (position - 1) / maxPos) * 100)));
}

function DontClose() {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-left ring-1 ring-red-200">
      <span className="text-xl" aria-hidden>⚠️</span>
      <p className="text-sm text-slate-800">
        <b className="text-cimory-red-dark">Jangan tutup atau refresh tab ini.</b> Halaman akan lanjut otomatis ke konfirmasi saat giliran Anda tiba.
      </p>
    </div>
  );
}
