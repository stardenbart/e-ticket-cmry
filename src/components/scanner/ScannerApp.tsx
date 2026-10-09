"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraScanner } from "./CameraScanner";
import { ResultScreen, type Overlay } from "./ResultScreen";
import { feedbackAdmitted, feedbackError, feedbackOk, unlockAudio } from "./feedback";
import { validateScan, verdictForTicket, idTypeLabel, type Manifest, type ManifestTicket, type ManifestEvent } from "@/lib/scanner/validate";
import * as local from "@/lib/scanner/local";
import { fmtDateTime, TZ_LABEL } from "@/lib/format";

type ScannerEventInfo = { id: string; name: string; venue: string; gates: string[]; timezone: string; start_at: string; end_at: string; valid_until: string };
type View = "scan" | "search" | "history" | "sync";
type Conn = "online" | "offline";

const SYNC_INTERVAL_MS = 10_000;
const REQ_TIMEOUT_MS = 6_000;

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...rest,
      method: rest.method ?? (json !== undefined ? "POST" : "GET"),
      headers: json !== undefined ? { "content-type": "application/json" } : undefined,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      cache: "no-store",
      credentials: "same-origin",
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(res.status, data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? "Terjadi kesalahan.");
    return data as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(0, "NETWORK", "Tidak ada koneksi ke server.");
  } finally {
    clearTimeout(timer);
  }
}

const clock = (ms: number) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(ms).replace(/\./g, ":");

export default function ScannerApp() {
  const router = useRouter();
  const [booted, setBooted] = useState(false);
  const [conn, setConn] = useState<Conn>("online");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [user, setUser] = useState<local.CachedUser | null>(null);
  const [events, setEvents] = useState<ScannerEventInfo[] | null>(null);
  const [selection, setSelection] = useState<local.Selection | null>(null);
  const [manifest, setManifestState] = useState<Manifest | null>(null);
  const [pending, setPending] = useState(0);
  const [view, setView] = useState<View>("scan");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  const manifestRef = useRef<Manifest | null>(null);
  const deviceRef = useRef<string>("");
  const syncingRef = useRef(false);
  const offsetRef = useRef(0); // jam server − jam perangkat

  const setManifest = useCallback(async (m: Manifest | null, persist = true) => {
    manifestRef.current = m;
    setManifestState(m);
    if (m && persist) await local.saveManifest(m);
  }, []);

  const refreshPending = useCallback(async () => setPending(await local.queueCount()), []);
  const nowIso = () => new Date(Date.now() + offsetRef.current).toISOString();

  // ------------------------------------------------------------------ boot
  useEffect(() => {
    (async () => {
      deviceRef.current = await local.deviceId();
      await local.purgeExpired();
      const [cachedUser, sel] = await Promise.all([local.getCachedUser(), local.getSelection()]);
      setUser(cachedUser ?? null);
      if (sel) {
        const m = await local.loadManifest(sel.eventId);
        if (m) {
          setSelection(sel);
          offsetRef.current = m.serverNow - m.syncedAt;
          await setManifest(m, false);
        } else await local.clearSelection();
      }
      await refreshPending();
      try {
        const r = await call<{ user: local.CachedUser; events: ScannerEventInfo[] }>("/api/scanner/events");
        setUser(r.user);
        await local.setCachedUser(r.user);
        setEvents(r.events);
        setConn("online");
        if (sel && !r.events.some((e) => e.id === sel.eventId)) {
          // Akses ke event dicabut / kedaluwarsa (H+1).
          await local.deleteEventData(sel.eventId);
          await local.clearSelection();
          setSelection(null);
          await setManifest(null, false);
          setNotice("Akses ke event sebelumnya sudah berakhir. Data manifest dihapus dari perangkat.");
        }
      } catch (e) {
        const err = e as HttpError;
        if (err.status === 401 || err.status === 403) {
          if (!sel) {
            router.replace("/scanner/login");
            return;
          }
          setSessionExpired(true);
        } else setConn("offline");
      }
      setBooted(true);
    })();
  }, [router, setManifest, refreshPending]);

  // ------------------------------------------------------------------ online/offline
  useEffect(() => {
    const on = () => setConn("online");
    const off = () => setConn("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (!navigator.onLine) setConn("offline");
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ------------------------------------------------------------------ sync: antrean offline + delta manifest
  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    const m = manifestRef.current;
    if (!m) return;
    syncingRef.current = true;
    try {
      const items = await local.queueAll();
      if (items.length) {
        const r = await call<{ results: { clientId: string; result: "ADMITTED" | "REJECTED" | "CONFLICT"; reason?: string }[] }>("/api/scanner/sync", {
          json: { items: items.map((i) => ({ ...i })) },
        });
        for (const res of r.results) {
          await local.historyUpdate(res.clientId, { outcome: res.result, reason: res.reason, offline: true });
          await local.queueDel(res.clientId);
        }
        if (r.results.some((x) => x.result === "CONFLICT")) setNotice("Ada check-in offline yang bentrok (CONFLICT). Admin sudah diberi tahu untuk meninjau.");
      }
      const since = new Date(m.serverNow - 2000).toISOString();
      const d = await call<{ serverNow: number; publicKeys: Record<string, string>; event: ManifestEvent; tickets: ManifestTicket[] }>(
        `/api/scanner/events/${m.event.id}/manifest?since=${encodeURIComponent(since)}`,
      );
      const cur = manifestRef.current ?? m;
      const tickets = { ...cur.tickets };
      for (const t of d.tickets) tickets[t.id] = t;
      // Check-in lokal yang belum tersinkron tetap berlaku.
      let next: Manifest = { ...cur, event: d.event, publicKeys: d.publicKeys, tickets, serverNow: d.serverNow, syncedAt: Date.now() };
      for (const q of await local.queueAll()) if (q.decision === "ADMIT" && q.ticketId) next = local.markLocalCheckin(next, q.ticketId, q.gate, q.scannedAt);
      offsetRef.current = d.serverNow - Date.now();
      await setManifest(next);
      setConn("online");
      setSessionExpired(false);
    } catch (e) {
      const err = e as HttpError;
      if (err.status === 401) setSessionExpired(true);
      else if (err.status === 403 && err.code === "NO_EVENT_ACCESS") {
        await local.deleteEventData(m.event.id);
        await local.clearSelection();
        setSelection(null);
        await setManifest(null, false);
        setNotice("Akses Anda ke event ini sudah berakhir. Manifest dihapus dari perangkat.");
      } else if (err.status === 0) setConn("offline");
    } finally {
      syncingRef.current = false;
      await refreshPending();
    }
  }, [setManifest, refreshPending]);

  useEffect(() => {
    if (!selection) return;
    const id = setInterval(() => {
      void local.purgeExpired().then(async () => {
        if (!(await local.getSelection())) {
          setSelection(null);
          await setManifest(null, false);
          setNotice("Manifest event sudah kedaluwarsa (H+1) dan dihapus dari perangkat.");
          return;
        }
        if (navigator.onLine) void syncNow();
      });
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selection, syncNow, setManifest]);

  useEffect(() => {
    if (conn === "online" && selection) void syncNow();
  }, [conn, selection, syncNow]);

  // ------------------------------------------------------------------ pilih event & gate
  const chooseEvent = async (e: ScannerEventInfo, gate: string) => {
    setLoadingEvent(e.id + gate);
    setNotice(null);
    try {
      const k = await call<{ key: string; validUntil: string }>(`/api/scanner/events/${e.id}/key`);
      await local.storeKey(e.id, k.key);
      const d = await call<{ serverNow: number; publicKeys: Record<string, string>; event: ManifestEvent; tickets: ManifestTicket[] }>(
        `/api/scanner/events/${e.id}/manifest`,
      );
      const m: Manifest = {
        event: d.event,
        publicKeys: d.publicKeys,
        tickets: Object.fromEntries(d.tickets.map((t) => [t.id, t])),
        serverNow: d.serverNow,
        syncedAt: Date.now(),
      };
      offsetRef.current = d.serverNow - Date.now();
      await setManifest(m);
      const sel: local.Selection = { eventId: e.id, gate, eventName: e.name, validUntil: d.event.valid_until, endAt: d.event.end_at };
      await local.setSelection(sel);
      setSelection(sel);
      setView("scan");
    } catch (err) {
      setNotice((err as Error).message || "Gagal mengunduh manifest.");
    } finally {
      setLoadingEvent(null);
    }
  };

  const changeEvent = async () => {
    if (!navigator.onLine) {
      setNotice("Ganti event butuh koneksi untuk mengunduh manifest baru.");
      return;
    }
    await local.clearSelection();
    setSelection(null);
    try {
      const r = await call<{ events: ScannerEventInfo[] }>("/api/scanner/events");
      setEvents(r.events);
    } catch {}
  };

  // ------------------------------------------------------------------ scan → verdict (offline)
  const onDetect = useCallback((text: string) => {
    const m = manifestRef.current;
    if (!m || overlay) return;
    unlockAudio();
    const v = validateScan(text, m);
    const scannedAt = nowIso();
    if (v.ok) {
      feedbackOk();
      setOverlay({ kind: "verify", ticket: v.ticket, version: v.version, method: "QR", scannedAt, requireId: m.event.require_id_match });
    } else {
      feedbackError();
      setOverlay({ kind: "red", title: "Ditolak", reason: v.reason, ticket: v.ticket, method: "QR" });
      void local.historyAdd({
        clientId: crypto.randomUUID(),
        at: scannedAt,
        eventId: m.event.id,
        gate: selection?.gate ?? "",
        holderName: v.ticket?.holder_name,
        categoryName: v.ticket?.category_name,
        outcome: "INVALID",
        reason: v.reason,
        method: "QR",
        offline: conn === "offline",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, selection, conn]);

  const openManual = (t: ManifestTicket) => {
    const m = manifestRef.current;
    if (!m) return;
    unlockAudio();
    const v = verdictForTicket(m.tickets[t.id] ?? t, (m.tickets[t.id] ?? t).version, m.event.timezone);
    if (v.ok) {
      feedbackOk();
      setOverlay({ kind: "verify", ticket: v.ticket, version: v.version, method: "MANUAL", scannedAt: nowIso(), requireId: m.event.require_id_match });
    } else {
      feedbackError();
      setOverlay({ kind: "red", title: "Ditolak", reason: v.reason, ticket: v.ticket, method: "MANUAL" });
    }
  };

  // ------------------------------------------------------------------ keputusan staf
  const decide = async (decision: "ADMIT" | "REJECT", reason?: string) => {
    if (!overlay || overlay.kind !== "verify" || !selection) return;
    const m = manifestRef.current!;
    const payload: local.CheckinPayload = {
      clientId: crypto.randomUUID(),
      eventId: m.event.id,
      ticketId: overlay.ticket.id,
      version: overlay.version,
      gate: selection.gate,
      decision,
      reason,
      method: overlay.method,
      scannedAt: overlay.scannedAt,
      deviceId: deviceRef.current,
    };
    const hist: local.HistoryEntry = {
      clientId: payload.clientId,
      at: payload.scannedAt,
      eventId: payload.eventId,
      gate: payload.gate,
      holderName: overlay.ticket.holder_name,
      categoryName: overlay.ticket.category_name,
      outcome: decision === "ADMIT" ? "PENDING_ADMIT" : "PENDING_REJECT",
      reason,
      method: overlay.method,
      offline: true,
    };
    setBusy(true);
    try {
      if (navigator.onLine && !sessionExpired) {
        try {
          const r = await call<{ result: "ADMITTED" | "REJECTED" | "CONFLICT"; reason?: string; checkedInAt?: string }>("/api/scanner/checkin", { json: payload });
          await local.historyAdd({ ...hist, outcome: r.result, reason: r.reason ?? reason, offline: false });
          setConn("online");
          if (r.result === "ADMITTED") {
            await setManifest(local.markLocalCheckin(m, overlay.ticket.id, selection.gate, r.checkedInAt ?? payload.scannedAt));
            feedbackAdmitted();
            setOverlay({ kind: "admitted", ticket: overlay.ticket, offline: false });
          } else {
            if (decision === "ADMIT") feedbackError();
            setOverlay({ kind: "rejected", ticket: overlay.ticket, reason: r.reason ?? "Ditolak.", offline: false });
            void syncNow(); // manifest kemungkinan basi (mis. tiket baru saja masuk di gate lain)
          }
          return;
        } catch (e) {
          const err = e as HttpError;
          if (err.status === 401) setSessionExpired(true);
          else if (err.status !== 0) {
            setNotice(err.message);
            setOverlay(null);
            return;
          } else setConn("offline");
        }
      }
      // Offline: simpan ke antrean perangkat, tandai lokal agar scan ulang di perangkat ini merah.
      await local.queueAdd(payload);
      await local.historyAdd(hist);
      if (decision === "ADMIT") {
        await setManifest(local.markLocalCheckin(m, overlay.ticket.id, selection.gate, payload.scannedAt));
        feedbackAdmitted();
        setOverlay({ kind: "admitted", ticket: overlay.ticket, offline: true });
      } else setOverlay({ kind: "rejected", ticket: overlay.ticket, reason: reason ?? "Ditolak staf", offline: true });
      await refreshPending();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const n = await local.queueCount();
    if (n > 0 && !confirm(`${n} keputusan belum tersinkron dan akan HILANG jika logout sekarang. Tetap logout?`)) return;
    try {
      await call("/api/auth/logout", { method: "POST" });
    } catch {}
    await local.wipeAll();
    router.replace("/scanner/login");
  };

  // ------------------------------------------------------------------ render
  if (!booted) {
    return (
      <div className="grid min-h-dvh place-items-center text-white/80">
        <p className="animate-pulse">Memuat scanner…</p>
      </div>
    );
  }

  const header = (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{selection ? selection.eventName : "Scanner Gate"}</p>
          <p className="truncate text-sm text-white/70">{selection ? selection.gate : user ? user.name : ""}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${conn === "online" ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}
            role="status"
          >
            <span className={`size-2 rounded-full ${conn === "online" ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} aria-hidden />
            {conn === "online" ? "Online" : "Offline"}
          </span>
          <span className={pending > 0 ? "text-amber-300" : "text-white/60"}>Belum sinkron: {pending}</span>
          {manifest && <span className="text-white/60">Manifest {clock(manifest.syncedAt)}</span>}
        </div>
      </div>
      {sessionExpired && (
        <div className="mt-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950">
          Sesi login berakhir. Scan tetap bisa offline;{" "}
          <button className="underline" onClick={() => router.push("/scanner/login")}>
            login ulang
          </button>{" "}
          untuk sinkron.
        </div>
      )}
      {notice && (
        <button onClick={() => setNotice(null)} className="mt-2 block w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm text-white">
          {notice} <span className="text-white/60">(tutup)</span>
        </button>
      )}
    </header>
  );

  if (!selection || !manifest) {
    return (
      <div className="min-h-dvh">
        {header}
        <main className="mx-auto max-w-xl px-4 py-6">
          <h1 className="text-2xl font-bold text-white">Pilih event & gate</h1>
          <p className="mt-1 text-white/70">Perangkat akan mengunduh manifest tiket dan kunci verifikasi untuk dipakai offline.</p>
          {events === null ? (
            <p className="mt-6 text-white/70">{conn === "offline" ? "Butuh koneksi untuk memuat daftar event." : "Memuat…"}</p>
          ) : events.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white/5 p-5 text-white/80">Tidak ada event yang ditugaskan kepada Anda saat ini.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {events.map((e) => (
                <li key={e.id} className="rounded-2xl bg-white p-5 text-ink">
                  <p className="text-lg font-bold">{e.name}</p>
                  <p className="text-sm text-muted">
                    {e.venue} · {fmtDateTime(e.start_at, e.timezone)}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {e.gates.map((g) => (
                      <button
                        key={g}
                        disabled={!!loadingEvent}
                        onClick={() => chooseEvent(e, g)}
                        className="min-h-14 rounded-xl bg-cimory-blue text-lg font-bold text-white active:scale-[0.98] disabled:opacity-60"
                      >
                        {loadingEvent === e.id + g ? "Mengunduh…" : g}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button onClick={logout} className="mt-8 w-full rounded-xl border border-white/20 py-3 font-semibold text-white/80">
            Logout
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        {view === "scan" && <ScanView paused={!!overlay} onDetect={onDetect} />}
        {view === "search" && <SearchView manifest={manifest} online={conn === "online" && !sessionExpired} onPick={openManual} />}
        {view === "history" && <HistoryView tz={manifest.event.timezone} />}
        {view === "sync" && (
          <SyncView manifest={manifest} pending={pending} conn={conn} onSync={syncNow} onChangeEvent={changeEvent} onLogout={logout} user={user} />
        )}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Menu scanner">
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {(
            [
              ["scan", "Scan", "M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10"],
              ["search", "Cari", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4"],
              ["history", "Riwayat", "M12 7v5l3 2M21 12a9 9 0 1 1-9-9"],
              ["sync", "Sinkron", "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5"],
            ] as [View, string, string][]
          ).map(([v, label, d]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${view === v ? "text-white" : "text-white/55"}`}
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d} />
              </svg>
              {label}
              {v === "sync" && pending > 0 && <span className="sr-only">({pending} belum sinkron)</span>}
            </button>
          ))}
        </div>
      </nav>
      {overlay && (
        <ResultScreen
          overlay={overlay}
          busy={busy}
          onAdmit={() => decide("ADMIT")}
          onReject={(r) => decide("REJECT", r)}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

// ==========================================================================
function ScanView({ paused, onDetect }: { paused: boolean; onDetect: (t: string) => void }) {
  const [manual, setManual] = useState("");
  return (
    <div>
      <CameraScanner paused={paused} onDetect={onDetect} />
      <p className="mt-3 text-center text-sm text-white/70">Arahkan kamera ke QR tiket. Validasi berjalan offline di perangkat.</p>
      <details className="mt-5 rounded-2xl bg-white/5 p-4 text-white">
        <summary className="cursor-pointer font-semibold">Input kode QR manual</summary>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDetect(manual.trim());
            setManual("");
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="ET1…"
            className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-3 font-mono text-sm text-white"
            aria-label="Kode QR"
          />
          <button className="min-h-12 rounded-xl bg-cimory-blue px-4 font-bold">Cek</button>
        </form>
      </details>
    </div>
  );
}

function statusLabel(s: string) {
  return ({ ACTIVE: "Aktif", CHECKED_IN: "Sudah check-in", CANCELLED: "Dibatalkan", REVOKED: "Dicabut" } as Record<string, string>)[s] ?? s;
}

function SearchView({ manifest, online, onPick }: { manifest: Manifest; online: boolean; onPick: (t: ManifestTicket) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ManifestTicket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"online" | "offline">("online");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setErr(null);
    if (term.length < 3) return setErr("Ketik minimal 3 karakter (nama atau ID tiket).");
    setLoading(true);
    try {
      if (online) {
        try {
          const r = await call<{ results: (ManifestTicket & { checked_in_at: string | null })[] }>(
            `/api/scanner/search?eventId=${manifest.event.id}&q=${encodeURIComponent(term)}`,
          );
          setResults(r.results);
          setMode("online");
          return;
        } catch (e2) {
          if ((e2 as HttpError).status !== 0) {
            setErr((e2 as Error).message);
            return;
          }
        }
      }
      // Offline: cari di manifest lokal (tercatat sebagai MANUAL saat keputusan disinkron).
      const t = term.toLowerCase();
      setResults(
        Object.values(manifest.tickets)
          .filter((x) => x.holder_name.toLowerCase().includes(t) || x.id.startsWith(t))
          .slice(0, 10),
      );
      setMode("offline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-bold">Pencarian manual</h2>
      <p className="mt-1 text-sm text-white/70">Untuk QR yang tidak terbaca (layar retak, baterai habis). Identitas fisik tetap wajib dicocokkan. Setiap pencarian dicatat di audit log.</p>
      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nama atau ID tiket"
          className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-3 text-white"
          aria-label="Nama atau ID tiket"
          autoComplete="off"
        />
        <button disabled={loading} className="min-h-12 rounded-xl bg-cimory-blue px-5 font-bold disabled:opacity-60">
          {loading ? "…" : "Cari"}
        </button>
      </form>
      {err && <p className="mt-3 text-sm font-semibold text-red-300" role="alert">{err}</p>}
      {results && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-white/60">{mode === "offline" ? "Hasil dari manifest lokal (offline)" : "Hasil dari server"} · maks 10</p>
          {results.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-4 text-white/80">Tidak ada tiket yang cocok.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((t) => (
                <li key={t.id}>
                  <button onClick={() => onPick(t)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left text-ink">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{t.holder_name}</span>
                      <span className="block truncate text-sm text-muted">
                        {t.category_name} · {idTypeLabel(t.id_type)} ••••{t.id_last4 ?? "----"} · <span className="font-mono">{t.id.slice(0, 8)}</span>
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${t.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {statusLabel(t.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const OUTCOME: Record<local.HistoryEntry["outcome"], { label: string; cls: string; icon: string }> = {
  ADMITTED: { label: "Masuk", cls: "bg-green-100 text-green-800", icon: "✓" },
  REJECTED: { label: "Ditolak", cls: "bg-red-100 text-red-800", icon: "✕" },
  CONFLICT: { label: "Konflik", cls: "bg-amber-100 text-amber-900", icon: "⚠" },
  PENDING_ADMIT: { label: "Masuk · belum sinkron", cls: "bg-amber-100 text-amber-900", icon: "⏳" },
  PENDING_REJECT: { label: "Ditolak · belum sinkron", cls: "bg-amber-100 text-amber-900", icon: "⏳" },
  INVALID: { label: "QR tidak valid", cls: "bg-red-100 text-red-800", icon: "✕" },
};

function HistoryView({ tz }: { tz: string }) {
  const [items, setItems] = useState<local.HistoryEntry[] | null>(null);
  useEffect(() => {
    void local.historyAll().then(setItems);
    const id = setInterval(() => void local.historyAll().then(setItems), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-white">
      <h2 className="text-xl font-bold">Riwayat scan perangkat ini</h2>
      {!items ? (
        <p className="mt-4 text-white/70">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white/5 p-4 text-white/80">Belum ada scan.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.slice(0, 200).map((h) => {
            const o = OUTCOME[h.outcome];
            return (
              <li key={h.clientId} className="rounded-xl bg-white px-4 py-3 text-ink">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{h.holderName ?? "—"}</p>
                    <p className="text-sm text-muted">
                      {new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(h.at))}{" "}
                      {TZ_LABEL[tz]} · {h.gate}
                      {h.method === "MANUAL" ? " · manual" : ""}
                      {h.categoryName ? ` · ${h.categoryName}` : ""}
                    </p>
                    {h.reason && <p className="mt-1 text-sm text-slate-700">{h.reason}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${o.cls}`}>
                    <span aria-hidden>{o.icon}</span> {o.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SyncView({
  manifest,
  pending,
  conn,
  onSync,
  onChangeEvent,
  onLogout,
  user,
}: {
  manifest: Manifest;
  pending: number;
  conn: Conn;
  onSync: () => Promise<void>;
  onChangeEvent: () => void;
  onLogout: () => void;
  user: local.CachedUser | null;
}) {
  const [syncing, setSyncing] = useState(false);
  const tickets = Object.values(manifest.tickets);
  const checkedIn = tickets.filter((t) => t.status === "CHECKED_IN").length;
  const active = tickets.filter((t) => t.status === "ACTIVE").length;
  const purgeAt = Math.min(Date.parse(manifest.event.end_at) + 86_400_000, Date.parse(manifest.event.valid_until));
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Status sinkronisasi</h2>
      <dl className="rounded-2xl bg-white px-4 py-2 text-ink">
        <Row k="Koneksi" v={conn === "online" ? "● Online" : "○ Offline"} />
        <Row k="Belum tersinkron" v={pending} />
        <Row k="Manifest terakhir" v={clock(manifest.syncedAt)} />
        <Row k="Tiket di manifest" v={tickets.length} />
        <Row k="Sudah check-in" v={checkedIn} />
        <Row k="Belum check-in (aktif)" v={active} />
        <Row k="Wajib cocok identitas" v={manifest.event.require_id_match ? "Ya" : "Tidak"} />
        <Row k="Data dihapus otomatis" v={fmtDateTime(purgeAt, manifest.event.timezone)} />
        <Row k="Login sebagai" v={user?.email ?? "—"} />
      </dl>
      <button
        disabled={syncing || conn === "offline"}
        onClick={async () => {
          setSyncing(true);
          await onSync();
          setSyncing(false);
        }}
        className="min-h-14 w-full rounded-xl bg-cimory-blue text-lg font-bold text-white disabled:opacity-50"
      >
        {syncing ? "Menyinkronkan…" : conn === "offline" ? "Menunggu koneksi…" : "Sinkronkan sekarang"}
      </button>
      <p className="text-sm text-white/70">
        Mode offline hanya cadangan. Dua perangkat offline bisa sama-sama menerima QR yang sama; saat sinkron, check-in paling awal yang sah dan sisanya
        ditandai CONFLICT untuk ditinjau admin.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onChangeEvent} className="min-h-12 rounded-xl border border-white/25 font-semibold text-white">
          Ganti event/gate
        </button>
        <button onClick={onLogout} className="min-h-12 rounded-xl border border-red-400/60 font-semibold text-red-300">
          Logout & hapus data
        </button>
      </div>
    </div>
  );
}
