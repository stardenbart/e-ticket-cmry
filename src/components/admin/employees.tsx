"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { Modal, Stat, Td, Th, useToast } from "./kit";

type Row = {
  nik: string;
  name: string;
  dept: string;
  category: "CMD" | "OS";
  user_id: string | null;
  user_email: string | null;
  user_registered_at: string | null;
  user_google: boolean | null;
  ticket_id: string | null;
  ticket_status: string | null;
  ticket_category: string | null;
  shirt_size: string | null;
  ticket_issued_at: string | null;
  checked_in_at: string | null;
  status: "BELUM_DAFTAR" | "TERDAFTAR" | "SUDAH_KLAIM";
};
type Stats = { total: number; cmd: number; os: number; registered: number; claimed: number; depts: string[] };
type ListRes = { rows: Row[]; total: number; page: number; pageSize: number; stats: Stats };
type Preview = {
  token: string;
  filename: string;
  stats: { total: number; valid: number; invalid: number; inserts: number; updates: number; unchanged: number };
  errors: { row: number; nik: string; messages: string[] }[];
  moreErrors: number;
};

const STATUS: Record<Row["status"], { label: string; tone: "slate" | "blue" | "green" }> = {
  BELUM_DAFTAR: { label: "Belum daftar", tone: "slate" },
  TERDAFTAR: { label: "Terdaftar", tone: "blue" },
  SUDAH_KLAIM: { label: "Sudah klaim", tone: "green" },
};

export function Employees() {
  const [filters, setFilters] = useState({ q: "", category: "", dept: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
      setData(await api<ListRes>(`/api/admin/employees?${qs({ page: String(page) })}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [qs, page]);

  // Pencarian ditunda sedikit agar tidak memanggil server tiap ketikan.
  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const set = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  async function remove(r: Row) {
    if (!confirm(`Hapus ${r.name} (${r.nik}) dari daftar karyawan eligible?${r.user_id ? "\nAkunnya tetap ada tetapi tidak bisa memesan tiket." : ""}`)) return;
    try {
      await api(`/api/admin/employees/${encodeURIComponent(r.nik)}`, { method: "DELETE" });
      toast({ tone: "ok", text: "Karyawan dihapus." });
      load();
    } catch (e) {
      toast({ tone: "err", text: (e as Error).message });
    }
  }

  const s = data?.stats;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageTitle
        title="Data Karyawan"
        subtitle="Acuan peserta eligible. Akun peserta terhubung otomatis lewat NIK yang diisi saat daftar."
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/employees/template" className="inline-flex items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-cimory-blue hover:bg-slate-50">
              Unduh template
            </a>
            <a href={`/api/admin/employees/export?${qs()}`} className="inline-flex items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-cimory-blue hover:bg-slate-50">
              Ekspor Excel
            </a>
            <Button variant="secondary" className="!py-2.5 text-sm" onClick={() => setImportOpen(true)}>
              Impor Excel/CSV
            </Button>
            <Button className="!py-2.5 text-sm" onClick={() => setEdit("new")}>
              + Tambah
            </Button>
          </div>
        }
      />

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total karyawan" value={fmtNumber(s.total)} />
          <Stat label="CMD" value={fmtNumber(s.cmd)} />
          <Stat label="OS" value={fmtNumber(s.os)} />
          <Stat label="Sudah daftar akun" value={fmtNumber(s.registered)} hint={s.total ? `${Math.round((s.registered / s.total) * 100)}%` : undefined} />
          <Stat label="Sudah klaim tiket" value={fmtNumber(s.claimed)} tone="green" hint={s.total ? `${Math.round((s.claimed / s.total) * 100)}%` : undefined} />
        </div>
      )}

      <Card className="mb-4 grid gap-3 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Cari NIK, nama, dept, atau email akun…" aria-label="Cari" />
        <Select value={filters.category} onChange={(e) => set("category", e.target.value)} aria-label="Kategori">
          <option value="">Semua kategori</option>
          <option value="CMD">CMD</option>
          <option value="OS">OS</option>
        </Select>
        <Select value={filters.dept} onChange={(e) => set("dept", e.target.value)} aria-label="Departemen">
          <option value="">Semua dept</option>
          {s?.depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
          <option value="">Semua status</option>
          <option value="BELUM_DAFTAR">Belum daftar</option>
          <option value="TERDAFTAR">Terdaftar (belum klaim)</option>
          <option value="SUDAH_KLAIM">Sudah klaim</option>
        </Select>
      </Card>

      {err && <Alert tone="red" className="mb-4">{err}</Alert>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr>
              <Th>NIK</Th>
              <Th>Nama Pegawai</Th>
              <Th>Dept</Th>
              <Th>Kategori</Th>
              <Th>Status</Th>
              <Th>Akun tertaut</Th>
              <Th>Tiket</Th>
              <Th>Baju</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <Td className="text-center" >
                  <Spinner className="text-cimory-blue" />
                </Td>
              </tr>
            )}
            {data?.rows.length === 0 && (
              <tr>
                <Td className="text-muted">Belum ada data. Impor file Excel/CSV atau tambah manual.</Td>
              </tr>
            )}
            {data?.rows.map((r) => (
              <tr key={r.nik} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap font-mono">{r.nik}</Td>
                <Td className="font-semibold">{r.name}</Td>
                <Td>{r.dept || "—"}</Td>
                <Td>{r.category}</Td>
                <Td>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </Td>
                <Td>
                  {r.user_email ? (
                    <>
                      <p className="max-w-56 truncate">{r.user_email}</p>
                      <p className="text-xs text-muted">
                        {r.user_registered_at ? fmtDateTime(r.user_registered_at) : ""}
                        {r.user_google ? " · Google" : ""}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td>
                  {r.ticket_status ? (
                    <>
                      <p>{r.ticket_status === "CHECKED_IN" ? "Sudah check-in" : "Aktif"} · {r.ticket_category}</p>
                      <p className="text-xs text-muted">{r.ticket_issued_at ? fmtDateTime(r.ticket_issued_at) : ""}</p>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td className="font-semibold">{r.shirt_size ?? "—"}</Td>
                <Td className="whitespace-nowrap text-right text-sm font-semibold">
                  <button className="text-cimory-blue hover:underline" onClick={() => setEdit(r)}>
                    Ubah
                  </button>
                  <span className="mx-2 text-line">|</span>
                  <button className="text-cimory-red-dark hover:underline disabled:opacity-40" disabled={!!r.ticket_id} onClick={() => remove(r)} title={r.ticket_id ? "Sudah punya tiket" : undefined}>
                    Hapus
                  </button>
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

      {edit && (
        <EditModal
          row={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={(msg) => {
            setEdit(null);
            toast({ tone: "ok", text: msg });
            load();
          }}
        />
      )}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onDone={(msg) => {
            setImportOpen(false);
            toast({ tone: "ok", text: msg });
            load();
          }}
        />
      )}
      {toastNode}
    </div>
  );
}

function EditModal({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState({ nik: row?.nik ?? "", name: row?.name ?? "", dept: row?.dept ?? "", category: row?.category ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (row) await api(`/api/admin/employees/${encodeURIComponent(row.nik)}`, { method: "PUT", json: f });
      else await api("/api/admin/employees", { json: f });
      onSaved(row ? "Data karyawan diperbarui." : "Karyawan ditambahkan.");
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal menyimpan.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? "Ubah data karyawan" : "Tambah karyawan"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={busy || !f.nik || !f.name}>
            {busy && <Spinner />} Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Alert tone="red">{err}</Alert>}
        {row?.user_id && <Alert tone="blue">Karyawan ini sudah punya akun ({row.user_email}). Nama akun ikut diperbarui; NIK tidak bisa diganti.</Alert>}
        <Field label="NIK" htmlFor="e-nik" hint="04.XXXXX untuk CMD, A1.XX.XXXX untuk OS.">
          <Input id="e-nik" value={f.nik} disabled={!!row?.user_id} onChange={(e) => setF({ ...f, nik: e.target.value.toUpperCase().replace(/\s+/g, "") })} className="font-mono" />
        </Field>
        <Field label="Nama Pegawai (sesuai KTP)" htmlFor="e-name" hint="Disimpan dalam huruf kapital.">
          <Input id="e-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toUpperCase() })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dept" htmlFor="e-dept">
            <Input id="e-dept" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} />
          </Field>
          <Field label="Kategori" htmlFor="e-cat" hint="Kosongkan = ikut format NIK.">
            <Select id="e-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="">Otomatis dari NIK</option>
              <option value="CMD">CMD</option>
              <option value="OS">OS</option>
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    setPreview(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/admin/employees/import", { method: "POST", body: form, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Gagal membaca file.");
      setPreview(data as Preview);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ upserted: number; removed: number; kept: number; rows: number }>("/api/admin/employees/import", { json: { token: preview.token, replace } });
      onDone(`Impor selesai: ${fmtNumber(r.rows)} baris diproses, ${fmtNumber(r.upserted)} baru/berubah${replace ? `, ${fmtNumber(r.removed)} dihapus` : ""}.`);
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal menyimpan.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Impor data karyawan"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={commit} disabled={busy || !preview || preview.stats.valid === 0}>
            {busy && <Spinner />} Simpan {preview ? `${fmtNumber(preview.stats.valid)} baris` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          Unggah file <b>.xlsx</b> atau <b>.csv</b> dengan kolom <b>NIK, Nama Pegawai, Dept, Kategori</b> (lihat <a className="font-semibold text-cimory-blue underline" href="/api/admin/employees/template">template</a>). File hasil Ekspor juga bisa diimpor ulang. NIK yang sudah ada akan diperbarui.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="block w-full rounded-xl border border-dashed border-line p-4"
        />
        {busy && !preview && (
          <p className="flex items-center gap-2 text-muted">
            <Spinner /> Membaca file…
          </p>
        )}
        {err && <Alert tone="red">{err}</Alert>}
        {preview && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Baris valid" value={fmtNumber(preview.stats.valid)} tone="green" />
              <Stat label="Baru" value={fmtNumber(preview.stats.inserts)} />
              <Stat label="Berubah" value={fmtNumber(preview.stats.updates)} />
              <Stat label="Error" value={fmtNumber(preview.stats.invalid)} tone={preview.stats.invalid ? "red" : undefined} />
            </div>
            {preview.errors.length > 0 && (
              <div>
                <p className="mb-2 font-semibold text-cimory-red-dark">Baris berikut tidak akan disimpan — perbaiki di file lalu unggah ulang bila perlu:</p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-line">
                  <table className="w-full text-xs">
                    <tbody>
                      {preview.errors.map((e) => (
                        <tr key={e.row} className="border-b border-line last:border-0">
                          <td className="whitespace-nowrap px-3 py-1.5 font-semibold">Baris {e.row}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono">{e.nik || "—"}</td>
                          <td className="px-3 py-1.5">{e.messages.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.moreErrors > 0 && <p className="mt-1 text-xs text-muted">…dan {fmtNumber(preview.moreErrors)} error lainnya.</p>}
              </div>
            )}
            <label className="flex items-start gap-2 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>
                <b>Ganti seluruh daftar</b> — karyawan yang tidak ada di file ini dihapus dari daftar eligible (kecuali yang sudah memegang tiket). Tanpa centang, data hanya ditambah/diperbarui.
              </span>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
