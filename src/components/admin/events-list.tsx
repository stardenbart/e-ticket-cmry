"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Button, Card, EmptyState, Field, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { EventStatusChip, Modal, QuotaBar, Td, Th, useToast } from "./kit";

type Row = { id: string; slug: string; name: string; city: string; start_at: string; status: string; quota: number; claimed: number; categories: number };

export function EventsList() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const load = () => api<{ events: Row[] }>("/api/admin/events").then((r) => setRows(r.events)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (!status || r.status === status) && (!q || `${r.name} ${r.city} ${r.slug}`.toLowerCase().includes(q.toLowerCase()))),
    [rows, q, status],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id: string }>("/api/admin/events", { json: { name } });
      router.push(`/admin/events/${r.id}`);
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal membuat event.");
      setBusy(false);
    }
  }

  async function duplicate(id: string) {
    try {
      const r = await api<{ id: string }>(`/api/admin/events/${id}`, { json: { action: "duplicate" } });
      toast({ tone: "ok", text: "Event diduplikasi sebagai Draft." });
      router.push(`/admin/events/${r.id}`);
    } catch (e) {
      toast({ tone: "err", text: (e as Error).message });
    }
  }

  return (
    <div>
      <PageTitle title="Daftar Event" subtitle="Kelola event, kategori tiket, jadwal, dan staf gate." action={<Button onClick={() => setCreateOpen(true)}>+ Buat Event</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Cari nama, kota, slug…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Cari event" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-48" aria-label="Filter status">
          <option value="">Semua status</option>
          {["DRAFT", "PUBLISHED", "ON_SALE", "CLOSED", "FINISHED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      {rows === null ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Belum ada event" action={<Button onClick={() => setCreateOpen(true)}>Buat event pertama</Button>}>
          Event baru dibuat sebagai Draft dan baru tampil di publik setelah dipublikasi.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Mulai</Th>
                <Th>Status</Th>
                <Th className="w-56">Klaim</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/admin/events/${r.id}`} className="font-semibold text-cimory-blue hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-muted">
                      /{r.slug} · {r.city || "—"} · {r.categories} kategori
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.start_at)}</Td>
                  <Td>
                    <EventStatusChip status={r.status} />
                  </Td>
                  <Td>
                    <QuotaBar claimed={r.claimed} quota={r.quota} />
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {fmtNumber(r.claimed)} / {fmtNumber(r.quota)}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-3 text-sm font-semibold">
                      <Link href={`/admin/events/${r.id}`} className="text-cimory-blue hover:underline">
                        Kelola
                      </Link>
                      <Link href={`/admin/events/${r.id}/peserta`} className="text-cimory-blue hover:underline">
                        Peserta
                      </Link>
                      <button onClick={() => duplicate(r.id)} className="text-cimory-blue hover:underline">
                        Duplikasi
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat event baru"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button form="create-event" type="submit" disabled={busy || !name.trim()}>
              {busy && <Spinner />} Buat Draft
            </Button>
          </>
        }
      >
        <form id="create-event" onSubmit={create} className="space-y-4">
          {err && <Alert tone="red">{err}</Alert>}
          <Field label="Nama event" htmlFor="ev-name" hint={`${name.length}/100 karakter. Detail lain diisi di langkah berikutnya.`}>
            <Input id="ev-name" maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </form>
      </Modal>
      {toastNode}
    </div>
  );
}
