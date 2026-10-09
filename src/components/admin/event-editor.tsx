"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, TZ_LABEL } from "@/lib/format";
import { Alert, Button, Card, Field, Spinner, Textarea, Input, cx } from "@/components/ui";
import { EventStatusChip, Modal, useToast } from "./kit";
import type { EventPayload } from "./event-types";
import { InfoTab, MediaTab, SettingsTab, TimeTab } from "./event-tabs";
import { CategoriesTab } from "./categories-tab";
import { StaffTab } from "./staff-tab";

const TABS = [
  { key: "info", label: "Informasi dasar" },
  { key: "media", label: "Media" },
  { key: "waktu", label: "Waktu & lokasi" },
  { key: "kategori", label: "Kategori tiket" },
  { key: "staf", label: "Staf gate" },
  { key: "pengaturan", label: "Pengaturan" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export type SaveFn = (patch: Record<string, unknown>, okText?: string) => Promise<boolean>;

export function EventEditor({ id }: { id: string }) {
  const [data, setData] = useState<EventPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("info");
  const [conflict, setConflict] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      setData(await api<EventPayload>(`/api/admin/events/${id}`));
      setConflict(false);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ClientApiError ? e.message : "Gagal memuat event.");
    }
  }, [id]);

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabKey;
    if (TABS.some((t) => t.key === h)) setTab(h);
    load();
  }, [load]);

  const handleErr = useCallback(
    (e: unknown) => {
      const ce = e as ClientApiError;
      if (ce?.data?.code === "VERSION_CONFLICT") setConflict(true);
      toast({ tone: "err", text: ce?.message ?? "Gagal menyimpan." });
    },
    [toast],
  );

  const save: SaveFn = useCallback(
    async (patch, okText = "Perubahan disimpan.") => {
      if (!data) return false;
      try {
        await api(`/api/admin/events/${id}`, { method: "PATCH", json: { version: data.event.version, ...patch } });
        toast({ tone: "ok", text: okText });
        await load();
        return true;
      } catch (e) {
        handleErr(e);
        return false;
      }
    },
    [data, id, load, toast, handleErr],
  );

  if (loadErr) return <Alert tone="red">{loadErr}</Alert>;
  if (!data) return <div className="space-y-3"><div className="skeleton h-20" /><div className="skeleton h-96" /></div>;

  const e = data.event;
  const finished = new Date(e.end_at).getTime() <= Date.now();
  const readOnly = e.status === "CANCELLED";

  const switchTab = (k: TabKey) => {
    setTab(k);
    history.replaceState(null, "", `#${k}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/events" className="text-sm font-semibold text-cimory-blue hover:underline">
            ← Daftar event
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold">{e.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <EventStatusChip status={data.status} />
            <span>
              {fmtDateTime(e.start_at, e.timezone)} · /event/{e.slug}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/events/${id}/preview`} target="_blank" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-cimory-blue hover:bg-slate-50">
            Preview
          </Link>
          <Link href={`/admin/events/${id}/peserta`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-cimory-blue hover:bg-slate-50">
            Peserta
          </Link>
          {e.status === "DRAFT" && (
            <Button className="py-2.5 text-sm" onClick={() => setPublishOpen(true)}>
              Publikasikan
            </Button>
          )}
          {e.status !== "CANCELLED" && !finished && (
            <Button variant="secondary" className="py-2.5 text-sm !text-cimory-red-dark" onClick={() => setCancelOpen(true)}>
              Batalkan event
            </Button>
          )}
        </div>
      </div>

      {conflict && (
        <Alert tone="amber" title="Data sudah diubah admin lain">
          Perubahan Anda belum tersimpan. <button className="font-semibold underline" onClick={load}>Muat ulang data terbaru</button>, lalu ulangi perubahan.
        </Alert>
      )}
      {readOnly && <Alert tone="red" title="Event dibatalkan">Event ini sudah dibatalkan dan tidak bisa diubah lagi.</Alert>}
      {e.status === "DRAFT" && data.problems.length > 0 && (
        <Alert tone="amber" title={`Belum siap dipublikasi (${data.problems.length})`}>
          <ul className="list-disc pl-5">
            {data.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="overflow-x-auto">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
              className={cx(
                "-mb-px border-b-[3px] px-4 py-2.5 text-sm font-semibold transition",
                tab === t.key ? "border-cimory-red text-cimory-blue" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.key === "kategori" && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{data.categories.length}</span>}
              {t.key === "staf" && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{data.staff.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <fieldset disabled={readOnly} className="min-w-0">
        <Card className="p-5 sm:p-6" key={`${tab}-${e.version}`}>
          {tab === "info" && <InfoTab data={data} save={save} />}
          {tab === "media" && <MediaTab data={data} reload={load} toast={toast} />}
          {tab === "waktu" && <TimeTab data={data} save={save} />}
          {tab === "kategori" && <CategoriesTab data={data} reload={load} toast={toast} onConflict={() => setConflict(true)} />}
          {tab === "staf" && <StaffTab data={data} save={save} reload={load} toast={toast} />}
          {tab === "pengaturan" && <SettingsTab data={data} save={save} />}
        </Card>
      </fieldset>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} data={data} onDone={load} toast={toast} onConflict={() => setConflict(true)} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} data={data} onDone={load} toast={toast} />
      {toastNode}
    </div>
  );
}

type ToastFn = ReturnType<typeof useToast>["toast"];

/** Publikasi dengan konfirmasi ganda: tinjau jadwal → konfirmasi akhir. */
function PublishModal({ open, onClose, data, onDone, toast, onConflict }: { open: boolean; onClose: () => void; data: EventPayload; onDone: () => void; toast: ToastFn; onConflict: () => void }) {
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const e = data.event;
  const tz = TZ_LABEL[e.timezone];

  const close = () => {
    setStep(1);
    setChecked(false);
    setProblems([]);
    onClose();
  };

  async function publish() {
    setBusy(true);
    try {
      await api(`/api/admin/events/${e.id}`, { json: { action: "publish", version: e.version } });
      toast({ tone: "ok", text: "Event dipublikasi dan tampil di halaman publik." });
      close();
      onDone();
    } catch (err) {
      const ce = err as ClientApiError;
      if (ce.data?.code === "VERSION_CONFLICT") onConflict();
      setProblems((ce.data?.problems as string[]) ?? [ce.message]);
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  const blocked = data.problems.length > 0;
  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={step === 1 ? "Tinjau jadwal sebelum publikasi" : "Konfirmasi publikasi"}
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={close}>Batal</Button>
            <Button disabled={!checked || blocked} onClick={() => setStep(2)}>Lanjut</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button>
            <Button disabled={busy} onClick={publish}>{busy && <Spinner />} Ya, publikasikan sekarang</Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-4 text-sm">
          {(blocked || problems.length > 0) && (
            <Alert tone="red" title="Belum bisa dipublikasi">
              <ul className="list-disc pl-5">{[...new Set([...data.problems, ...problems])].map((p) => <li key={p}>{p}</li>)}</ul>
            </Alert>
          )}
          <p>
            <b>{e.name}</b> · acara {fmtDateTime(e.start_at, e.timezone)} – {fmtDateTime(e.end_at, e.timezone)}
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full">
              <thead className="bg-cimory-blue text-left text-xs uppercase text-white">
                <tr>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2">Kuota</th>
                  <th className="px-3 py-2">Buka order ({tz})</th>
                  <th className="px-3 py-2">Tutup order ({tz})</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{c.name}</td>
                    <td className="px-3 py-2">{c.quota}</td>
                    <td className="px-3 py-2 font-semibold text-cimory-red-dark">{fmtDateTime(c.open_at, e.timezone)}</td>
                    <td className="px-3 py-2">{fmtDateTime(c.close_at, e.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
            <input type="checkbox" className="mt-1 size-4" checked={checked} onChange={(x) => setChecked(x.target.checked)} />
            <span>Saya sudah memeriksa jam buka order di atas. Jam buka terkunci 10 menit sebelum kategori dibuka.</span>
          </label>
        </div>
      ) : (
        <p className="text-sm">
          Event akan langsung tampil di halaman publik, dan pengguna bisa mulai masuk antrean 10 menit sebelum jam buka tiap kategori. Lanjutkan?
        </p>
      )}
    </Modal>
  );
}

function CancelModal({ open, onClose, data, onDone, toast }: { open: boolean; onClose: () => void; data: EventPayload; onDone: () => void; toast: ToastFn }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const e = data.event;
  const active = data.categories.reduce((s, c) => s + c.claimed, 0);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ticketsCancelled: number }>(`/api/admin/events/${e.id}`, { json: { action: "cancel", version: e.version, reason } });
      toast({ tone: "ok", text: `Event dibatalkan. ${r.ticketsCancelled} tiket dibatalkan dan pemegangnya diberi tahu lewat email.` });
      onClose();
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Batalkan event"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
          <Button variant="danger" className="!py-2.5" disabled={busy || confirm !== "BATALKAN" || reason.trim().length < 3} onClick={run}>
            {busy && <Spinner />} Batalkan event
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {err && <Alert tone="red">{err}</Alert>}
        <Alert tone="red" title="Tindakan ini tidak bisa dibatalkan">
          Semua tiket aktif ({active}) otomatis dibatalkan dan email pemberitahuan dikirim ke pemegangnya.
        </Alert>
        <Field label="Alasan pembatalan" htmlFor="cancel-reason">
          <Textarea id="cancel-reason" value={reason} onChange={(x) => setReason(x.target.value)} maxLength={300} />
        </Field>
        <Field label='Ketik "BATALKAN" untuk konfirmasi' htmlFor="cancel-confirm">
          <Input id="cancel-confirm" value={confirm} onChange={(x) => setConfirm(x.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
