"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, ButtonLink, Spinner, cx } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime } from "@/lib/format";
import { QuotaBar } from "./quota-bar";
import { FlipCountdown, TextCountdown } from "./countdown";
import { useServerNow } from "./use-server-now";

export type PanelCategory = {
  id: string;
  name: string;
  description: string;
  quota: number;
  remaining: number;
  openAt: string;
  closeAt: string;
  isClosed: boolean;
  color: string;
};

type Status = "UPCOMING" | "OPEN" | "SOLD_OUT" | "CLOSED";

const QUEUE_LEAD_MS = 10 * 60 * 1000;

export function CategoryPanel(props: {
  eventId: string;
  slug: string;
  timezone: string;
  categories: PanelCategory[];
  eventState: "ACTIVE" | "CANCELLED" | "FINISHED";
  user: { loggedIn: boolean; profileComplete: boolean; ticketId: string | null; queueCategoryId: string | null };
}) {
  const { eventId, slug, timezone, user } = props;
  const router = useRouter();
  const now = useServerNow(1000);
  const [live, setLive] = useState<Record<string, { remaining: number; status: Status }>>({});
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState<PanelCategory | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Sisa kuota realtime lewat SSE (hanya informasi).
  useEffect(() => {
    if (props.eventState !== "ACTIVE") return;
    const es = new EventSource(`/api/events/${eventId}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { categories: { id: string; remaining: number; status: Status }[] };
        setLive(Object.fromEntries(data.categories.map((c) => [c.id, { remaining: c.remaining, status: c.status }])));
        setConnected(true);
      } catch {}
    };
    return () => es.close();
  }, [eventId, props.eventState]);

  const cats = useMemo(
    () =>
      props.categories.map((c) => {
        const remaining = live[c.id]?.remaining ?? c.remaining;
        const t = now ?? Date.now();
        let status: Status;
        if (c.isClosed || live[c.id]?.status === "CLOSED" || t >= new Date(c.closeAt).getTime()) status = "CLOSED";
        else if (t < new Date(c.openAt).getTime()) status = "UPCOMING";
        else if (remaining <= 0) status = "SOLD_OUT";
        else status = "OPEN";
        const queueOpen = status === "OPEN" || (status === "UPCOMING" && t >= new Date(c.openAt).getTime() - QUEUE_LEAD_MS);
        return { ...c, remaining, status, queueOpen };
      }),
    [props.categories, live, now],
  );

  const nextOpen = cats.filter((c) => c.status === "UPCOMING").sort((a, b) => a.openAt.localeCompare(b.openAt))[0];

  function startJoin(c: PanelCategory) {
    const back = `/event/${slug}`;
    if (!user.loggedIn) return router.push(`/login?next=${encodeURIComponent(back)}`);
    if (!user.profileComplete) return router.push(`/profil?next=${encodeURIComponent(back)}`);
    setSheetOpen(false);
    setJoining(c);
  }

  const list = (
    <div className="space-y-3">
      {props.eventState === "CANCELLED" && <Alert tone="red" title="Event dibatalkan">Event ini dibatalkan oleh penyelenggara. Semua tiket sudah dibatalkan otomatis.</Alert>}
      {props.eventState === "FINISHED" && <Alert tone="slate" title="Event sudah selesai">Terima kasih atas antusiasmenya!</Alert>}
      {user.ticketId && (
        <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
          <p className="flex items-center gap-2 font-semibold text-ok">
            <span aria-hidden>✓</span> Anda sudah memegang tiket untuk event ini.
          </p>
          <ButtonLink href={`/tiket-saya/${user.ticketId}`} className="mt-3 w-full">
            Lihat Tiket Saya
          </ButtonLink>
        </div>
      )}
      {nextOpen && !user.ticketId && props.eventState === "ACTIVE" && (
        <div className="rounded-2xl bg-cimory-light p-4 text-center ring-1 ring-line">
          <p className="mb-2 text-sm font-semibold text-muted">{nextOpen.name} dibuka dalam</p>
          <FlipCountdown target={nextOpen.openAt} size="lg" className="justify-center" onDone={() => router.refresh()} />
        </div>
      )}
      {cats.map((c) => (
        <div key={c.id} className="rounded-2xl border border-line bg-white p-4 transition hover:border-slate-300">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-bold">
                <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <span className="truncate">{c.name}</span>
              </p>
              {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
            </div>
            <StatusBadge status={c.status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Buka</dt>
              <dd className="font-semibold">{fmtDateTime(c.openAt, timezone)}</dd>
            </div>
            <div>
              <dt className="text-muted">Tutup</dt>
              <dd className="font-semibold">{fmtDateTime(c.closeAt, timezone)}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <QuotaBar remaining={c.remaining} quota={c.quota} />
          </div>
          {!user.ticketId && props.eventState === "ACTIVE" && (
            <div className="mt-4">
              <CategoryAction c={c} queueCategoryId={user.queueCategoryId} onJoin={() => startJoin(c)} />
            </div>
          )}
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className={cx("size-2 rounded-full", connected ? "bg-ok" : "bg-slate-300")} aria-hidden />
        {connected ? "Sisa kuota diperbarui otomatis" : "Menghubungkan pembaruan kuota…"} · Gratis, 1 tiket per akun
      </p>
    </div>
  );

  const cheapest = cats.find((c) => c.queueOpen) ?? nextOpen ?? cats[0];

  return (
    <>
      <div className="hidden lg:block">{list}</div>

      {/* Mobile: bottom sheet menempel di bawah layar */}
      <div className="lg:hidden">
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#22e5ff]/30 bg-[#07081f]/92 px-4 py-3 shadow-[0_-10px_30px_rgba(5,3,20,0.5)] backdrop-blur-md">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              {user.ticketId ? (
                <p className="text-sm font-semibold text-ok">✓ Anda sudah punya tiket</p>
              ) : cheapest ? (
                <>
                  <p className="truncate text-xs text-muted">{cats.length} kategori · Gratis</p>
                  <p className="truncate text-sm font-bold">
                    {cheapest.status === "UPCOMING" ? <TextCountdown target={cheapest.openAt} prefix="Dibuka dalam" /> : cheapest.status === "OPEN" ? "Sedang dibuka" : cheapest.status === "SOLD_OUT" ? "Kuota habis" : "Ditutup"}
                  </p>
                </>
              ) : null}
            </div>
            {user.ticketId ? (
              <ButtonLink href={`/tiket-saya/${user.ticketId}`}>Lihat Tiket</ButtonLink>
            ) : (
              <Button onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen}>
                Pilih Tiket
              </Button>
            )}
          </div>
        </div>
        {sheetOpen && (
          <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Pilih kategori tiket"
              className="max-h-[85dvh] w-full animate-fade-up overflow-y-auto rounded-t-[32px] border-t border-[#22e5ff]/40 bg-[#07081f] p-4 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <p className="mv-title text-xl font-extrabold">Pilih Kategori Tiket</p>
                <button type="button" onClick={() => setSheetOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-cimory-blue hover:bg-white">
                  Tutup
                </button>
              </div>
              {list}
            </div>
          </div>
        )}
      </div>

      {joining && <JoinDialog category={joining} onClose={() => setJoining(null)} />}
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "OPEN") return <Badge tone="green" icon={<span aria-hidden>●</span>}>Sedang dibuka</Badge>;
  if (status === "UPCOMING") return <Badge tone="amber" icon={<span aria-hidden>⏳</span>}>Segera dibuka</Badge>;
  if (status === "SOLD_OUT") return <Badge tone="red" icon={<span aria-hidden>✕</span>}>Habis</Badge>;
  return <Badge tone="slate" icon={<span aria-hidden>■</span>}>Ditutup</Badge>;
}

function CategoryAction({ c, queueCategoryId, onJoin }: { c: PanelCategory & { status: Status; queueOpen: boolean }; queueCategoryId: string | null; onJoin: () => void }) {
  if (queueCategoryId === c.id && (c.status === "OPEN" || c.status === "UPCOMING")) {
    return (
      <ButtonLink href={`/antrean/${c.id}`} className="w-full">
        Lanjutkan antrean →
      </ButtonLink>
    );
  }
  if (c.status === "CLOSED") return <Button disabled className="w-full">Pemesanan ditutup</Button>;
  if (c.status === "SOLD_OUT") return <Button disabled className="w-full">Kuota habis</Button>;
  if (!c.queueOpen) {
    return (
      <Button disabled variant="secondary" className="w-full">
        <TextCountdown target={new Date(new Date(c.openAt).getTime() - QUEUE_LEAD_MS).toISOString()} prefix="Antrean dibuka dalam" />
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={onJoin}
      className="pulse-ring font-hud inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(100deg,#ff2bd6,#b026ff_50%,#2d6bff)] px-5 py-3 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(255,43,214,0.35)] ring-1 ring-[#22e5ff]/40 transition hover:brightness-110 active:scale-[0.98]"
    >
      <span aria-hidden>✦</span> Masuk Antrean
    </button>
  );
}

function JoinDialog({ category, onClose }: { category: PanelCategory; onClose: () => void }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; otherCategory?: string } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/queue", { json: { action: "join", categoryId: category.id, turnstileToken: token ?? undefined } });
      router.push(`/antrean/${category.id}`);
    } catch (e) {
      const err = e instanceof ClientApiError ? e : null;
      if (err?.data.code === "ALREADY_IN_QUEUE") {
        setError({ message: "Anda sudah mengantre di kategori lain untuk event ini. Satu akun hanya boleh punya satu posisi antrean per event.", otherCategory: String(err.data.categoryId ?? "") });
      } else if (err?.data.code === "PROFILE_INCOMPLETE") {
        router.push(`/profil?next=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setError({ message: err?.message ?? "Gagal masuk antrean. Coba lagi." });
      }
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-title"
        className="w-full max-w-md animate-pop rounded-t-3xl border border-[#22e5ff]/40 bg-[#0a0b2e] p-6 shadow-2xl sm:rounded-[18px_48px_18px_48px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="join-title" className="text-xl font-bold">
          Masuk antrean {category.name}
        </h2>
        <p className="mt-1 text-sm text-muted">Selesaikan verifikasi singkat untuk memastikan Anda bukan bot. Posisi antrean ditentukan oleh server, bukan jam perangkat Anda.</p>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          <li>• Yang masuk sebelum jam buka akan <b>diacak</b> saat antrean dibuka.</li>
          <li>• Membuka banyak tab tidak menambah peluang.</li>
          <li>• Setelah giliran tiba, Anda punya 5 menit untuk klaim.</li>
        </ul>
        <div className="mt-4">
          <Turnstile onToken={setToken} />
        </div>
        {error && (
          <Alert tone="red" className="mt-4">
            {error.message}
            {error.otherCategory && (
              <Link href={`/antrean/${error.otherCategory}`} className="mt-1 block font-semibold underline">
                Buka antrean saya
              </Link>
            )}
          </Alert>
        )}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button ref={btn} onClick={join} disabled={busy || token === null} className="flex-[2]">
            {busy ? <Spinner /> : null}
            {token === null ? "Memverifikasi…" : "Lanjut ke antrean"}
          </Button>
        </div>
      </div>
    </div>
  );
}
