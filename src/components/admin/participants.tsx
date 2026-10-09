"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Button, Card, Field, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import { Modal, Td, Th, TicketStatusChip, useToast } from "./kit";
import type { EventPayload } from "./event-types";

type Row = {
  id: string;
  holder_name: string;
  email: string;
  user_id: string;
  category_name: string;
  status: string;
  version: number;
  id_type: string;
  id_last4: string | null;
  email_status: string;
  issued_at: string;
  checked_in_at: string | null;
  checked_in_gate: string | null;
};

type Action = { kind: "reissue" | "cancel" | "identity"; row: Row } | null;

export function Participants({ id }: { id: string }) {
  const [ev, setEv] = useState<EventPayload | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [err, setErr] = useState<string | null>(null);
  const { toast, toastNode } = useToast();
  const pageSize = 50;

  useEffect(() => {
    api<EventPayload>(`/api/admin/events/${id}`).then(setEv).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ q: qDebounced, status, category, page: String(page) });
  const qs = params.toString();
  const load = useCallback(async () => {
    try {
      const r = await api<{ rows: Row[]; total: number }>(`/api/admin/events/${id}/peserta?${qs}`);
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id, qs]);
  useEffect(() => {
    load();
  }, [load]);

  async function resend(r: Row) {
    try {
      await api(`/api/admin/tickets/${r.id}`, { json: { action: "resend" } });
      toast({ tone: "ok", text: `Email tiket ${r.holder_name} diantrekan ulang.` });
    } catch (e) {
      toast({ tone: "err", text: (e as Error).message });
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const csvParams = new URLSearchParams({ q: qDebounced, status, category }).toString();

  return (
    <div>
      <Link href={`/admin/events/${id}`} className="text-sm font-semibold text-cimory-blue hover:underline">
        ← Kembali ke event
      </Link>
      <PageTitle
        title="Peserta"
        subtitle={ev ? ev.event.name : "…"}
        action={
          <a href={`/api/admin/events/${id}/peserta.csv?${csvParams}`} className="rounded-xl bg-cimory-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-cimory-blue-dark">
            Export CSV
          </a>
        }
      />
      <p className="-mt-3 mb-4 text-xs text-muted">Akses dan export data peserta dicatat di audit log.</p>
      {err && <Alert tone="red" className="mb-4">{err}</Alert>}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Cari nama, email, atau ID tiket…"
          className="max-w-sm"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          aria-label="Cari peserta"
        />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-48" aria-label="Status">
          <option value="">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="checkin">Sudah check-in</option>
          <option value="batal">Batal / dicabut</option>
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="max-w-56" aria-label="Kategori">
          <option value="">Semua kategori</option>
          {ev?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="self-center text-sm text-muted">{fmtNumber(total)} tiket</span>
      </div>

      {rows === null ? (
        <div className="skeleton h-72" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <Th>Pemegang</Th>
                <Th>Kategori</Th>
                <Th>Status</Th>
                <Th>Identitas</Th>
                <Th>Diterbitkan</Th>
                <Th>Check-in</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <Td className="text-muted">Tidak ada peserta yang cocok.</Td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-semibold">{r.holder_name}</p>
                    <p className="text-xs text-muted">{r.email}</p>
                    <p className="font-mono text-[11px] text-muted">{r.id}</p>
                  </Td>
                  <Td>{r.category_name}</Td>
                  <Td>
                    <TicketStatusChip status={r.status} />
                    {r.email_status === "FAILED" && <p className="mt-1 text-xs font-semibold text-cimory-red-dark">Email gagal</p>}
                    {r.version > 1 && <p className="mt-1 text-xs text-muted">QR v{r.version}</p>}
                  </Td>
                  <Td>
                    {r.id_type} ·••{r.id_last4 ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.issued_at)}</Td>
                  <Td className="whitespace-nowrap">{r.checked_in_at ? `${fmtDateTime(r.checked_in_at)} · ${r.checked_in_gate ?? ""}` : "—"}</Td>
                  <Td className="text-right">
                    <div className="flex flex-col items-end gap-1 text-sm font-semibold">
                      {r.status === "ACTIVE" && (
                        <>
                          <button className="text-cimory-blue hover:underline" onClick={() => resend(r)}>
                            Kirim ulang email
                          </button>
                          <button className="text-cimory-blue hover:underline" onClick={() => setAction({ kind: "reissue", row: r })}>
                            Reissue QR
                          </button>
                          <button className="text-cimory-red-dark hover:underline" onClick={() => setAction({ kind: "cancel", row: r })}>
                            Batalkan
                          </button>
                        </>
                      )}
                      <button className="text-cimory-blue hover:underline" onClick={() => setAction({ kind: "identity", row: r })}>
                        Koreksi identitas
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" className="py-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Sebelumnya
          </Button>
          <span>
            Halaman {page} / {pages}
          </span>
          <Button variant="secondary" className="py-2" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Berikutnya →
          </Button>
        </div>
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onDone={(msg) => {
            setAction(null);
            toast({ tone: "ok", text: msg });
            load();
          }}
        />
      )}
      {toastNode}
    </div>
  );
}

function ActionModal({ action, onClose, onDone }: { action: NonNullable<Action>; onClose: () => void; onDone: (msg: string) => void }) {
  const r = action.row;
  const [reason, setReason] = useState("");
  const [fullName, setFullName] = useState(r.holder_name);
  const [idType, setIdType] = useState(r.id_type);
  const [idNumber, setIdNumber] = useState("");
  const [apply, setApply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (action.kind === "identity") {
        const res = await api<{ ticketsUpdated: number }>(`/api/admin/users/${r.user_id}/identity`, {
          json: { fullName, idType, idNumber: idNumber || undefined, reason, applyToTickets: apply },
        });
        onDone(`Identitas dikoreksi${apply ? `, ${res.ticketsUpdated} tiket aktif diperbarui` : ""}.`);
      } else {
        const res = await api<{ message: string }>(`/api/admin/tickets/${r.id}`, { json: { action: action.kind, reason } });
        onDone(res.message);
      }
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  const title = action.kind === "reissue" ? "Reissue QR tiket" : action.kind === "cancel" ? "Batalkan tiket" : "Koreksi identitas pemegang";
  const valid = reason.trim().length >= (action.kind === "reissue" ? 0 : action.kind === "identity" ? 5 : 3);

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant={action.kind === "cancel" ? "danger" : "primary"} className={action.kind === "cancel" ? "!py-2.5" : ""} disabled={busy || !valid} onClick={run}>
            {busy && <Spinner />} {action.kind === "reissue" ? "Terbitkan QR baru" : action.kind === "cancel" ? "Batalkan tiket" : "Simpan koreksi"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {err && <Alert tone="red">{err}</Alert>}
        <p>
          <b>{r.holder_name}</b> · {r.category_name} · <span className="font-mono text-xs">{r.id}</span>
        </p>
        {action.kind === "reissue" && (
          <Alert tone="amber">Versi QR naik. QR lama otomatis ditolak di gate setelah manifest scanner tersinkron, dan QR baru dikirim ke email pemegang.</Alert>
        )}
        {action.kind === "cancel" && <Alert tone="red">Tiket dibatalkan, slot kembali ke kuota, dan pemegang diberi tahu lewat email.</Alert>}
        {action.kind === "identity" && (
          <>
            <Alert tone="blue">
              Dipakai untuk permintaan koreksi dari peserta yang profilnya terkunci. Nomor identitas lengkap tidak disimpan — hanya hash & 4 digit terakhir. Perubahan
              tercatat di audit log.
            </Alert>
            <Field label="Nama lengkap sesuai identitas" htmlFor="i-name">
              <Input id="i-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jenis identitas" htmlFor="i-type">
                <Select id="i-type" value={idType} onChange={(e) => setIdType(e.target.value)}>
                  <option value="KTP">KTP</option>
                  <option value="SIM">SIM</option>
                  <option value="PASPOR">Paspor</option>
                </Select>
              </Field>
              <Field label="Nomor identitas baru" htmlFor="i-num" hint="Kosongkan bila nomor tidak berubah.">
                <Input id="i-num" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} autoComplete="off" />
              </Field>
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1" checked={apply} onChange={(e) => setApply(e.target.checked)} />
              <span>
                <b>Terapkan ke tiket aktif</b> — nama & identitas di tiket yang sudah terbit ikut diperbarui. Tanpa ini, tiket lama tetap memakai data saat klaim.
              </span>
            </label>
          </>
        )}
        <Field label={action.kind === "reissue" ? "Alasan (opsional)" : "Alasan / dasar permintaan"} htmlFor="a-reason">
          <Textarea id="a-reason" className="min-h-20" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
