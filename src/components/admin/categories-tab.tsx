"use client";

import { useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber, utcToZonedLocal, TZ_LABEL } from "@/lib/format";
import { Alert, Badge, Button, Field, Input, Spinner, Textarea } from "@/components/ui";
import { Modal, QuotaBar, type useToast } from "./kit";
import type { AdminCategory, EventPayload } from "./event-types";

type ToastFn = ReturnType<typeof useToast>["toast"];

type Form = {
  name: string;
  description: string;
  quota: number;
  open_local: string;
  close_local: string;
  sort_order: number;
  color: string;
  admit_batch: number;
  admit_interval_sec: number;
};

const LOCK_MS = 10 * 60 * 1000;

function catState(c: AdminCategory, now = Date.now()) {
  const open = new Date(c.open_at).getTime();
  const close = new Date(c.close_at).getTime();
  if (c.is_closed || now >= close) return { label: "Ditutup", tone: "slate" as const };
  if (now >= open) return c.claimed >= c.quota ? { label: "Habis", tone: "red" as const } : { label: "Sedang dibuka", tone: "green" as const };
  if (now >= open - LOCK_MS) return { label: "Segera dibuka · jam terkunci", tone: "amber" as const };
  return { label: "Belum dibuka", tone: "blue" as const };
}

export function CategoriesTab({ data, reload, toast, onConflict }: { data: EventPayload; reload: () => Promise<void>; toast: ToastFn; onConflict: () => void }) {
  const e = data.event;
  const tz = TZ_LABEL[e.timezone];
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);

  async function toggleClose(c: AdminCategory) {
    const ok = window.confirm(c.is_closed ? `Buka kembali kategori "${c.name}"?` : `Tutup kategori "${c.name}"? Pengguna tidak bisa klaim lagi.`);
    if (!ok) return;
    try {
      await api(`/api/admin/events/${e.id}/categories/${c.id}`, {
        method: "PATCH",
        json: { ...toForm(c, e.timezone), version: c.version, is_closed: !c.is_closed },
      });
      toast({ tone: "ok", text: c.is_closed ? "Kategori dibuka kembali." : "Kategori ditutup." });
      reload();
    } catch (x) {
      if ((x as ClientApiError).data?.code === "VERSION_CONFLICT") onConflict();
      toast({ tone: "err", text: (x as Error).message });
    }
  }

  async function remove(c: AdminCategory) {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await api(`/api/admin/events/${e.id}/categories/${c.id}?version=${c.version}`, { method: "DELETE" });
      toast({ tone: "ok", text: "Kategori dihapus." });
      reload();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Kuota boleh dinaikkan kapan saja, diturunkan hanya sampai jumlah yang sudah diklaim. Jam buka terkunci 10 menit sebelum buka. Waktu dalam {tz}.
        </p>
        <Button className="py-2 text-sm" onClick={() => setEditing("new")}>
          + Tambah kategori
        </Button>
      </div>
      {data.categories.length === 0 && <Alert tone="amber">Belum ada kategori tiket. Event butuh minimal satu kategori untuk dipublikasi.</Alert>}
      <div className="grid gap-3">
        {data.categories.map((c) => {
          const s = catState(c);
          return (
            <div key={c.id} className="rounded-xl border border-line p-4" style={{ borderLeft: `5px solid ${c.color}` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{c.name}</h3>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
                  <p className="mt-2 text-sm">
                    Order: <b>{fmtDateTime(c.open_at, e.timezone)}</b> → {fmtDateTime(c.close_at, e.timezone)}
                  </p>
                  <p className="text-xs text-muted">
                    Antrean: {c.admit_batch} orang / {c.admit_interval_sec} detik · urutan {c.sort_order}
                  </p>
                </div>
                <div className="w-full max-w-60">
                  <QuotaBar claimed={c.claimed} quota={c.quota} />
                  <p className="mt-1 text-sm tabular-nums">
                    <b>{fmtNumber(c.claimed)}</b> / {fmtNumber(c.quota)} diklaim
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-sm font-semibold">
                <button className="text-cimory-blue hover:underline" onClick={() => setEditing(c)}>
                  Ubah
                </button>
                <button className="text-cimory-blue hover:underline" onClick={() => toggleClose(c)}>
                  {c.is_closed ? "Buka kembali" : "Tutup kategori"}
                </button>
                {c.ticket_count === 0 ? (
                  <button className="text-cimory-red-dark hover:underline" onClick={() => remove(c)}>
                    Hapus
                  </button>
                ) : (
                  <span className="font-normal text-muted">Tidak bisa dihapus ({c.ticket_count} tiket) — tutup saja.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <CategoryModal
          key={editing === "new" ? "new" : editing.id + editing.version}
          data={data}
          cat={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          toast={toast}
          onConflict={onConflict}
        />
      )}
    </div>
  );
}

function toForm(c: AdminCategory, tz: string): Form {
  return {
    name: c.name,
    description: c.description,
    quota: c.quota,
    open_local: utcToZonedLocal(c.open_at, tz),
    close_local: utcToZonedLocal(c.close_at, tz),
    sort_order: c.sort_order,
    color: c.color,
    admit_batch: c.admit_batch,
    admit_interval_sec: c.admit_interval_sec,
  };
}

function CategoryModal({
  data,
  cat,
  onClose,
  onSaved,
  toast,
  onConflict,
}: {
  data: EventPayload;
  cat: AdminCategory | null;
  onClose: () => void;
  onSaved: () => void;
  toast: ToastFn;
  onConflict: () => void;
}) {
  const e = data.event;
  const tz = TZ_LABEL[e.timezone];
  const [f, setF] = useState<Form>(() =>
    cat
      ? toForm(cat, e.timezone)
      : {
          name: "",
          description: "",
          quota: 100,
          open_local: utcToZonedLocal(new Date(Date.now() + 86400_000), e.timezone).slice(0, 14) + "00",
          close_local: utcToZonedLocal(new Date(new Date(e.start_at).getTime() - 86400_000), e.timezone),
          sort_order: data.categories.length,
          color: "#1B3A6F",
          admit_batch: 50,
          admit_interval_sec: 5,
        },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const now = Date.now();
  const openLocked = !!cat && !cat.is_closed && now >= new Date(cat.open_at).getTime() - LOCK_MS && now < new Date(cat.close_at).getTime();
  const quotaTooLow = !!cat && f.quota < cat.claimed;
  const timesBad = f.close_local <= f.open_local;
  const startLocal = utcToZonedLocal(e.start_at, e.timezone);
  const closeAfterStart = f.close_local >= startLocal;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (cat) await api(`/api/admin/events/${e.id}/categories/${cat.id}`, { method: "PATCH", json: { ...f, version: cat.version } });
      else await api(`/api/admin/events/${e.id}/categories`, { json: f });
      toast({ tone: "ok", text: cat ? "Kategori diperbarui." : "Kategori ditambahkan." });
      onSaved();
    } catch (x) {
      const ce = x as ClientApiError;
      if (ce.data?.code === "VERSION_CONFLICT") onConflict();
      setErr(ce.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={cat ? `Ubah kategori: ${cat.name}` : "Tambah kategori tiket"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" form="cat-form" disabled={busy || quotaTooLow || timesBad || closeAfterStart}>
            {busy && <Spinner />} Simpan
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="space-y-4">
        {err && <Alert tone="red">{err}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama kategori" htmlFor="c-name">
            <Input id="c-name" required maxLength={60} value={f.name} onChange={(x) => set("name", x.target.value)} />
          </Field>
          <Field
            label="Kuota"
            htmlFor="c-quota"
            error={quotaTooLow ? `Tidak bisa di bawah jumlah yang sudah diklaim (${cat!.claimed}).` : undefined}
            hint={cat ? `Sudah diklaim: ${cat.claimed}. Minimal ${Math.max(1, cat.claimed)}.` : "Minimal 1."}
          >
            <Input id="c-quota" type="number" min={Math.max(1, cat?.claimed ?? 1)} required value={f.quota} onChange={(x) => set("quota", Math.floor(Number(x.target.value) || 0))} />
          </Field>
        </div>
        <Field label="Deskripsi benefit" htmlFor="c-desc">
          <Textarea id="c-desc" className="min-h-20" maxLength={500} value={f.description} onChange={(x) => set("description", x.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Jam buka order (${tz})`}
            htmlFor="c-open"
            hint={openLocked ? "🔒 Terkunci: kurang dari 10 menit sebelum buka / sedang dibuka." : "Terkunci otomatis 10 menit sebelum buka."}
          >
            <Input id="c-open" type="datetime-local" required disabled={openLocked} value={f.open_local} onChange={(x) => set("open_local", x.target.value)} />
          </Field>
          <Field
            label={`Jam tutup order (${tz})`}
            htmlFor="c-close"
            error={timesBad ? "Harus setelah jam buka." : closeAfterStart ? "Harus sebelum acara mulai." : undefined}
          >
            <Input id="c-close" type="datetime-local" required value={f.close_local} onChange={(x) => set("close_local", x.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Urutan tampil" htmlFor="c-sort">
            <Input id="c-sort" type="number" min={0} value={f.sort_order} onChange={(x) => set("sort_order", Number(x.target.value) || 0)} />
          </Field>
          <Field label="Warna label" htmlFor="c-color">
            <Input id="c-color" type="color" className="h-[50px] p-1" value={f.color} onChange={(x) => set("color", x.target.value)} />
          </Field>
          <Field label="Lolos per batch" htmlFor="c-batch" hint="Waiting room">
            <Input id="c-batch" type="number" min={1} value={f.admit_batch} onChange={(x) => set("admit_batch", Number(x.target.value) || 1)} />
          </Field>
          <Field label="Interval (detik)" htmlFor="c-int">
            <Input id="c-int" type="number" min={1} value={f.admit_interval_sec} onChange={(x) => set("admit_interval_sec", Number(x.target.value) || 1)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
