"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import { Modal, Td, Th, useToast } from "./kit";

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  nik: string | null;
  dept: string | null;
  category: string | null;
  eligible: boolean;
  google: boolean;
  has_password: boolean;
  created_at: string;
  disabled_at: string | null;
  tickets_active: number;
  checked_in: boolean;
  last_ticket_category: string | null;
};
type Stats = { total: number; linked: number; unlinked: number; with_ticket: number; disabled: number; no_phone: number; google: number };
type ListRes = { rows: Row[]; total: number; page: number; pageSize: number; stats: Stats };
type Action = { kind: "disable" | "enable" | "unlink" | "phone" | "nik"; row: Row } | null;

/** Kelola akun peserta yang sudah daftar (admin & super admin). */
export function ParticipantAccounts() {
  const [filters, setFilters] = useState({ q: "", link: "", ticket: "", state: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const { toast, toastNode } = useToast();

  const qs = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) p.set(k, v);
      return p.toString();
    },
    [filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<ListRes>(`/api/admin/participant-accounts?${qs({ page: String(page) })}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [qs, page]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const set = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const s = data?.stats;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageTitle
        title="Akun Peserta"
        subtitle="Semua akun peserta yang sudah daftar: tautan NIK, nomor HP, status tiket, dan status akun."
        action={
          <a href={`/api/admin/participant-accounts/export?${qs()}`} className="inline-flex items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-cimory-blue hover:bg-slate-50">
            Ekspor Excel
          </a>
        }
      />

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickStat label="Total akun" value={s.total} active={!filters.link && !filters.ticket && !filters.state} onClick={() => setFilters({ ...filters, link: "", ticket: "", state: "" })} />
          <QuickStat label="Tertaut NIK" value={s.linked} tone="green" active={filters.link === "LINKED"} onClick={() => set("link", filters.link === "LINKED" ? "" : "LINKED")} />
          <QuickStat label="Belum tertaut NIK" value={s.unlinked} tone="amber" active={filters.link === "UNLINKED"} onClick={() => set("link", filters.link === "UNLINKED" ? "" : "UNLINKED")} />
          <QuickStat label="Punya tiket" value={s.with_ticket} tone="blue" active={filters.ticket === "HAS"} onClick={() => set("ticket", filters.ticket === "HAS" ? "" : "HAS")} />
          <QuickStat label="Belum isi no HP" value={s.no_phone} tone="amber" active={filters.state === "NO_PHONE"} onClick={() => set("state", filters.state === "NO_PHONE" ? "" : "NO_PHONE")} />
          <QuickStat label="Dinonaktifkan" value={s.disabled} tone="red" active={filters.state === "DISABLED"} onClick={() => set("state", filters.state === "DISABLED" ? "" : "DISABLED")} />
        </div>
      )}

      <Card className="mb-4 grid gap-3 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Cari nama, email, NIK, NIK KTP, atau no HP…" aria-label="Cari" />
        <Select value={filters.link} onChange={(e) => set("link", e.target.value)} aria-label="Tautan NIK">
          <option value="">Semua tautan NIK</option>
          <option value="LINKED">Tertaut ke data karyawan</option>
          <option value="UNLINKED">Belum tertaut</option>
        </Select>
        <Select value={filters.ticket} onChange={(e) => set("ticket", e.target.value)} aria-label="Tiket">
          <option value="">Semua (tiket)</option>
          <option value="HAS">Punya tiket aktif</option>
          <option value="NONE">Belum klaim tiket</option>
        </Select>
        <Select value={filters.state} onChange={(e) => set("state", e.target.value)} aria-label="Status akun">
          <option value="">Semua status akun</option>
          <option value="ACTIVE">Aktif</option>
          <option value="DISABLED">Dinonaktifkan</option>
          <option value="NO_PHONE">Belum isi no HP</option>
        </Select>
      </Card>

      {err && <Alert tone="red" className="mb-4">{err}</Alert>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr>
              <Th>Nama / Email</Th>
              <Th>No HP</Th>
              <Th>NIK · Dept</Th>
              <Th>Login</Th>
              <Th>Daftar</Th>
              <Th>Tiket</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <Td>
                  <Spinner className="text-cimory-blue" />
                </Td>
              </tr>
            )}
            {data?.rows.length === 0 && (
              <tr>
                <Td className="text-muted">Tidak ada akun yang cocok dengan filter.</Td>
              </tr>
            )}
            {data?.rows.map((r) => (
              <tr key={r.id} className={r.disabled_at ? "bg-slate-50 text-muted" : "hover:bg-slate-50"}>
                <Td>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="max-w-60 truncate text-xs text-muted">{r.email}</p>
                </Td>
                <Td className="whitespace-nowrap font-mono text-sm">{r.phone ?? <span className="font-sans text-muted">—</span>}</Td>
                <Td>
                  {r.nik ? (
                    <>
                      <p className="font-mono text-sm">{r.nik}</p>
                      <p className="text-xs text-muted">{r.eligible ? `${r.dept || "—"} · ${r.category ?? ""}` : "Tidak ada di data karyawan"}</p>
                    </>
                  ) : (
                    <Badge tone="amber" className="whitespace-nowrap">Belum tertaut</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-sm">{[r.has_password && "Password", r.google && "Google"].filter(Boolean).join(" + ") || "—"}</Td>
                <Td className="whitespace-nowrap text-sm">{fmtDateTime(r.created_at)}</Td>
                <Td className="text-sm">
                  {r.tickets_active ? (
                    <span className="whitespace-nowrap">
                      {r.checked_in ? "Sudah check-in" : "Aktif"} · {r.last_ticket_category}
                    </span>
                  ) : (
                    <span className="text-muted">Belum klaim</span>
                  )}
                </Td>
                <Td>
                  {r.disabled_at ? (
                    <Badge tone="red" className="whitespace-nowrap">Nonaktif</Badge>
                  ) : (
                    <Badge tone="green" className="whitespace-nowrap">Aktif</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-right text-sm font-semibold">
                  <RowMenu row={r} onPick={(kind) => setAction({ kind, row: r })} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">
            {fmtNumber((page - 1) * data.pageSize + 1)}–{fmtNumber(Math.min(page * data.pageSize, data.total))} dari {fmtNumber(data.total)}
            {loading && <Spinner className="ml-2 inline size-4" />}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-2 text-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ‹ Sebelumnya
            </Button>
            <Button variant="secondary" className="!px-3 !py-2 text-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Berikutnya ›
            </Button>
          </div>
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

function QuickStat({ label, value, active, onClick, tone }: { label: string; value: number; active: boolean; onClick: () => void; tone?: "green" | "amber" | "blue" | "red" }) {
  const color = tone === "green" ? "text-ok" : tone === "amber" ? "text-warn" : tone === "red" ? "text-cimory-red-dark" : "text-cimory-blue";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:border-cimory-blue ${active ? "border-cimory-blue ring-2 ring-cimory-blue/30" : "border-line"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{fmtNumber(value)}</p>
    </button>
  );
}

function RowMenu({ row, onPick }: { row: Row; onPick: (k: NonNullable<Action>["kind"]) => void }) {
  const link = "text-cimory-blue hover:underline";
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      <button className={link} onClick={() => onPick("phone")}>
        No HP
      </button>
      <button className={link} onClick={() => onPick("nik")}>
        {row.nik ? "Koreksi NIK" : "Tautkan NIK"}
      </button>
      {row.nik && !row.tickets_active && (
        <button className={link} onClick={() => onPick("unlink")}>
          Lepas NIK
        </button>
      )}
      {row.disabled_at ? (
        <button className="text-ok hover:underline" onClick={() => onPick("enable")}>
          Aktifkan
        </button>
      ) : (
        <button className="text-cimory-red-dark hover:underline" onClick={() => onPick("disable")}>
          Nonaktifkan
        </button>
      )}
    </div>
  );
}

const TITLE: Record<NonNullable<Action>["kind"], string> = {
  disable: "Nonaktifkan akun",
  enable: "Aktifkan kembali akun",
  unlink: "Lepas tautan NIK",
  phone: "Ubah nomor HP",
  nik: "Koreksi / tautkan NIK",
};

function ActionModal({ action, onClose, onDone }: { action: NonNullable<Action>; onClose: () => void; onDone: (msg: string) => void }) {
  const r = action.row;
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState(r.phone ?? "");
  const [nik, setNik] = useState(r.nik ?? "");
  const [apply, setApply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsReason = action.kind === "disable" || action.kind === "unlink" || action.kind === "nik";
  const valid = (!needsReason || reason.trim().length >= 5) && (action.kind !== "phone" || phone.trim().length > 0) && (action.kind !== "nik" || nik.trim().length > 0);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (action.kind === "nik") {
        const res = await api<{ ticketsUpdated: number; name: string }>(`/api/admin/users/${r.id}/identity`, { json: { nik, reason, applyToTickets: apply } });
        onDone(`NIK ditautkan (${res.name})${apply ? `, ${res.ticketsUpdated} tiket aktif diperbarui` : ""}.`);
      } else {
        const payload = action.kind === "phone" ? { action: "phone", phone } : action.kind === "enable" ? { action: "enable" } : { action: action.kind, reason };
        await api(`/api/admin/participant-accounts/${r.id}`, { method: "PATCH", json: payload });
        onDone(
          action.kind === "disable"
            ? "Akun dinonaktifkan dan sesi login diputus."
            : action.kind === "enable"
              ? "Akun diaktifkan kembali."
              : action.kind === "unlink"
                ? "Tautan NIK dilepas."
                : "Nomor HP diperbarui.",
        );
      }
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLE[action.kind]}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant={action.kind === "disable" ? "danger" : "primary"} className={action.kind === "disable" ? "!py-2.5" : ""} disabled={busy || !valid} onClick={run}>
            {busy && <Spinner />} Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {err && <Alert tone="red">{err}</Alert>}
        <p>
          <b>{r.full_name}</b> · {r.email}
        </p>
        {action.kind === "disable" && (
          <Alert tone="red">Akun tidak bisa login dan sesi yang sedang aktif langsung diputus. Tiket yang sudah terbit tidak berubah — batalkan dari menu Peserta event bila perlu.</Alert>
        )}
        {action.kind === "enable" && <Alert tone="blue">Akun bisa login kembali.</Alert>}
        {action.kind === "unlink" && <Alert tone="amber">Akun dilepas dari NIK {r.nik}. Peserta harus menautkan ulang NIK-nya di halaman Profil sebelum bisa klaim tiket.</Alert>}
        {action.kind === "phone" && (
          <Field label="Nomor HP" htmlFor="pa-phone" hint="Contoh: 081234567890 (+62 juga diterima).">
            <Input id="pa-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="font-mono" />
          </Field>
        )}
        {action.kind === "nik" && (
          <>
            <Alert tone="blue">Tautkan akun ke karyawan lain di Data Karyawan. Nama akun mengikuti data karyawan. Perubahan tercatat di audit log.</Alert>
            <Field label="NIK karyawan atau NIK KTP" htmlFor="pa-nik" hint="04.xxxx (CMD), A1.xx.xxxx (OS), atau NIK KTP 16 digit.">
              <Input id="pa-nik" value={nik} onChange={(e) => setNik(e.target.value.toUpperCase().replace(/\s+/g, ""))} autoComplete="off" className="font-mono" />
            </Field>
            {r.tickets_active > 0 && (
              <label className="flex items-start gap-2 rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-1" checked={apply} onChange={(e) => setApply(e.target.checked)} />
                <span>
                  <b>Terapkan ke tiket aktif</b> — nama, NIK & dept di tiket yang sudah terbit ikut diperbarui.
                </span>
              </label>
            )}
          </>
        )}
        {needsReason && (
          <Field label="Alasan / dasar permintaan" htmlFor="pa-reason" hint="Minimal 5 karakter; tercatat di audit log.">
            <Textarea id="pa-reason" className="min-h-20" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
