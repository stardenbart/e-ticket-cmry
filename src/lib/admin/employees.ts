// Data karyawan eligible: daftar + tautan akun/tiket per event, impor Excel/CSV, ekspor dengan format tabel yang sama.
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { sql, type Tx } from "../db";
import { audit } from "../audit";
import { ApiError } from "../http";
import { apostropheToSpace, nameKey, nikCategory, type EmployeeCategory } from "../employee-shared";

/** Status karyawan untuk satu event: belum tautkan akun → belum klaim → belum check-in → sudah check-in. */
export type EmployeeAccountStatus = "BELUM_DAFTAR" | "BELUM_KLAIM" | "BELUM_CHECKIN" | "SUDAH_CHECKIN";
export const EMPLOYEE_STATUSES: EmployeeAccountStatus[] = ["BELUM_DAFTAR", "BELUM_KLAIM", "BELUM_CHECKIN", "SUDAH_CHECKIN"];

export type EmployeeRow = {
  nik: string;
  nik_ktp: string | null;
  name: string;
  dept: string;
  category: EmployeeCategory;
  updated_at: Date;
  // Akun yang terhubung lewat NIK saat daftar
  user_id: string | null;
  user_email: string | null;
  user_phone: string | null;
  user_registered_at: Date | null;
  user_google: boolean | null;
  // Tiket aktif / sudah check-in di event yang dipilih
  ticket_id: string | null;
  ticket_status: string | null;
  ticket_category: string | null;
  shirt_size: string | null;
  ticket_issued_at: Date | null;
  checked_in_at: Date | null;
  status: EmployeeAccountStatus;
};

export type EmployeeFilter = { q?: string; category?: string; dept?: string; status?: string; eventId?: string | null; limit?: number; offset?: number };

const statusExpr = () => sql`
  CASE WHEN u.id IS NULL THEN 'BELUM_DAFTAR'
       WHEN t.id IS NULL THEN 'BELUM_KLAIM'
       WHEN t.status = 'CHECKED_IN' THEN 'SUDAH_CHECKIN'
       ELSE 'BELUM_CHECKIN' END`;

function filterSql(f: EmployeeFilter) {
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, "")}%` : null;
  return sql`
    WHERE TRUE
      ${like ? sql`AND (e.nik ILIKE ${like} OR e.nik_ktp ILIKE ${like} OR e.name ILIKE ${like} OR e.dept ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like})` : sql``}
      ${f.category === "CMD" || f.category === "OS" ? sql`AND e.category = ${f.category}` : sql``}
      ${f.dept ? sql`AND e.dept = ${f.dept}` : sql``}
      ${EMPLOYEE_STATUSES.includes(f.status as EmployeeAccountStatus) ? sql`AND ${statusExpr()} = ${f.status!}` : sql``}`;
}

/** Tiket karyawan di event terpilih (tanpa event: tiket terbaru di event mana pun). */
const baseFrom = (eventId?: string | null) => sql`
  FROM employees e
  LEFT JOIN users u ON u.nik = e.nik
  LEFT JOIN LATERAL (
    SELECT t.id, t.status, t.shirt_size, t.issued_at, t.checked_in_at, c.name AS category_name
    FROM tickets t JOIN ticket_categories c ON c.id = t.category_id
    WHERE t.nik = e.nik AND t.status IN ('ACTIVE','CHECKED_IN')
      ${eventId ? sql`AND t.event_id = ${eventId}` : sql``}
    ORDER BY t.issued_at DESC LIMIT 1
  ) t ON TRUE`;

export async function queryEmployees(f: EmployeeFilter) {
  const rows = await sql<EmployeeRow[]>`
    SELECT e.nik, e.nik_ktp, e.name, e.dept, e.category, e.updated_at,
           u.id AS user_id, u.email AS user_email, u.phone AS user_phone, u.created_at AS user_registered_at, (u.google_sub IS NOT NULL) AS user_google,
           t.id AS ticket_id, t.status AS ticket_status, t.category_name AS ticket_category, t.shirt_size,
           t.issued_at AS ticket_issued_at, t.checked_in_at,
           ${statusExpr()} AS status
    ${baseFrom(f.eventId)}
    ${filterSql(f)}
    ORDER BY e.category, e.dept, e.name
    ${f.limit ? sql`LIMIT ${f.limit} OFFSET ${f.offset ?? 0}` : sql``}`;
  const [{ total }] = await sql<{ total: number }[]>`SELECT count(*)::int AS total ${baseFrom(f.eventId)} ${filterSql(f)}`;
  return { rows, total };
}

/** Ringkasan per event: jumlah karyawan di tiap status (untuk kartu statistik & tombol filter cepat). */
export async function employeeStats(eventId?: string | null) {
  const [s] = await sql<
    { total: number; cmd: number; os: number; with_ktp: number; registered: number; belum_daftar: number; belum_klaim: number; belum_checkin: number; sudah_checkin: number }[]
  >`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE e.category = 'CMD')::int AS cmd,
           count(*) FILTER (WHERE e.category = 'OS')::int AS os,
           count(e.nik_ktp)::int AS with_ktp,
           count(u.id)::int AS registered,
           count(*) FILTER (WHERE ${statusExpr()} = 'BELUM_DAFTAR')::int AS belum_daftar,
           count(*) FILTER (WHERE ${statusExpr()} = 'BELUM_KLAIM')::int AS belum_klaim,
           count(*) FILTER (WHERE ${statusExpr()} = 'BELUM_CHECKIN')::int AS belum_checkin,
           count(*) FILTER (WHERE ${statusExpr()} = 'SUDAH_CHECKIN')::int AS sudah_checkin
    ${baseFrom(eventId)}`;
  const depts = (await sql<{ dept: string }[]>`SELECT DISTINCT dept FROM employees WHERE dept <> '' ORDER BY dept`).map((r) => r.dept);
  return { ...s, depts };
}

/** Event yang bisa dipilih di halaman Data Karyawan (terbaru dulu, draft di akhir). */
export async function employeeEvents() {
  return sql<{ id: string; name: string; status: string }[]>`
    SELECT id, name, status FROM events ORDER BY (status = 'DRAFT'), start_at DESC`;
}

/** NIK KTP harus unik antar-karyawan. */
export async function assertKtpFree(ktp: string | null, ownNik: string) {
  if (!ktp) return;
  const [other] = await sql<{ nik: string }[]>`SELECT nik FROM employees WHERE nik_ktp = ${ktp} AND nik <> ${ownNik}`;
  if (other) throw new ApiError(409, "DUPLICATE_KTP", `NIK KTP ini sudah dipakai karyawan ${other.nik}.`);
}

// ---------------------------------------------------------------------------
// Validasi satu baris (dipakai impor, tambah, dan edit)
// ---------------------------------------------------------------------------
/** nik_ktp: null = kosong. Saat impor, sel kosong tidak menghapus NIK KTP yang sudah tersimpan. */
export type EmployeeInput = { nik: string; nik_ktp: string | null; name: string; dept: string; category: EmployeeCategory };

export function normalizeEmployee(raw: { nik: unknown; nik_ktp?: unknown; name: unknown; dept: unknown; category: unknown }): { ok: true; value: EmployeeInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const nik = normalizeNikCell(raw.nik);
  const ktp = normalizeKtpCell(raw.nik_ktp);
  if (!ktp.ok) errors.push(ktp.error);
  const name = apostropheToSpace(String(raw.name ?? "")).replace(/\s+/g, " ").trim().toUpperCase();
  const dept = String(raw.dept ?? "").replace(/\s+/g, " ").trim();
  const catRaw = String(raw.category ?? "").trim().toUpperCase();
  const fromNik = nikCategory(nik);
  if (!nik) errors.push("NIK kosong");
  else if (!fromNik) errors.push(`NIK "${nik}" tidak sesuai format 04.xxxx (CMD) / A1.xx.xxxx (OS)`);
  if (!name) errors.push("Nama kosong");
  else if (name.length > 150) errors.push("Nama terlalu panjang");
  else if (!/^[A-Z0-9 .,'\-]+$/.test(name)) errors.push("Nama mengandung karakter tidak valid");
  let category: EmployeeCategory | null = null;
  if (!catRaw) category = fromNik;
  else if (catRaw === "CMD" || catRaw === "OS") category = catRaw;
  else errors.push(`Kategori "${catRaw}" harus CMD atau OS`);
  if (category && fromNik && category !== fromNik) errors.push(`Kategori ${category} tidak cocok dengan format NIK (${fromNik})`);
  if (errors.length || !category) return { ok: false, errors: errors.length ? errors : ["Kategori tidak valid"] };
  return { ok: true, value: { nik, nik_ktp: ktp.ok ? ktp.value : null, name, dept, category } };
}

/**
 * NIK KTP dari sel Excel/CSV: 16 digit (titik/spasi/tanda hubung diabaikan). Kosong = null.
 * Excel hanya menyimpan 15 digit angka, jadi NIK KTP yang tersimpan sebagai ANGKA sudah rusak
 * (digit terakhir jadi 0) → ditolak dengan petunjuk memformat kolom sebagai Teks.
 */
function normalizeKtpCell(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v && typeof v === "object" && "result" in (v as Record<string, unknown>)) v = (v as { result: unknown }).result;
  if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) v = (v as { text: unknown }).text;
  if (v == null || String(v).trim() === "") return { ok: true, value: null };
  if (typeof v === "number") return { ok: false, error: "NIK KTP tersimpan sebagai angka di Excel (digit terakhir bisa berubah jadi 0) — format kolom NIK KTP sebagai Teks lalu isi ulang" };
  const d = String(v).replace(/^'/, "").replace(/[\s.\-]/g, "");
  if (!/^\d{16}$/.test(d)) return { ok: false, error: `NIK KTP "${String(v).trim()}" harus 16 digit angka` };
  return { ok: true, value: d };
}

/**
 * NIK dari sel Excel. Bila Excel mengubah "04.0018" jadi angka 4.0018, kembalikan dengan menambah "0" di depan.
 * (Nol di akhir yang sudah dibuang Excel, mis. 04.0010 → 4.001, tidak bisa ditebak — format kolom NIK sebagai Teks.)
 */
function normalizeNikCell(v: unknown): string {
  if (typeof v === "number" && v >= 4 && v < 5) return `0${String(v)}`;
  if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) v = (v as { text: unknown }).text;
  if (v && typeof v === "object" && "result" in (v as Record<string, unknown>)) v = (v as { result: unknown }).result;
  return String(v ?? "").toUpperCase().replace(/\s+/g, "");
}

// ---------------------------------------------------------------------------
// Impor
// ---------------------------------------------------------------------------
const HEADER_ALIASES: Record<keyof EmployeeInput, string[]> = {
  nik: ["nik", "nik karyawan", "nomor induk karyawan", "no induk", "nip"],
  nik_ktp: ["nik ktp", "no ktp", "nomor ktp", "ktp", "nik kependudukan", "nomor induk kependudukan"],
  name: ["nama pegawai", "nama", "nama karyawan", "name"],
  dept: ["dept", "departemen", "department", "divisi"],
  category: ["kategori", "category", "status karyawan", "cmd/os"],
};

export type ImportPreview = {
  rows: EmployeeInput[];
  errors: { row: number; nik: string; messages: string[] }[];
  stats: { total: number; valid: number; invalid: number; inserts: number; updates: number; unchanged: number };
};

export async function parseEmployeeFile(buf: Buffer, filename: string): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  const isCsv = /\.csv$/i.test(filename);
  if (isCsv) {
    // Excel versi Indonesia sering memakai ";" sebagai pemisah CSV.
    const text = buf.toString("utf8").replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    await wb.csv.read(Readable.from([text]), { parserOptions: { delimiter }, map: (v: string) => v });
  } else {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  }
  const ws = wb.worksheets.find((w) => w.name.toLowerCase() !== "petunjuk") ?? wb.worksheets[0];
  if (!ws) throw new Error("File tidak berisi sheet.");

  // Cari baris header (dalam 10 baris pertama).
  let headerRow = 0;
  const cols: Partial<Record<keyof EmployeeInput, number>> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    const row = ws.getRow(r);
    const found: Partial<Record<keyof EmployeeInput, number>> = {};
    row.eachCell((cell, col) => {
      const h = String(cell.text ?? "").trim().toLowerCase();
      for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof EmployeeInput, string[]][]) {
        if (!found[key] && aliases.includes(h)) found[key] = col;
      }
    });
    if (found.nik && found.name) {
      headerRow = r;
      Object.assign(cols, found);
    }
  }
  if (!headerRow) throw new Error('Header tidak ditemukan. Baris judul harus berisi kolom "NIK" dan "Nama Pegawai" (lihat template).');

  const rows: EmployeeInput[] = [];
  const errors: ImportPreview["errors"] = [];
  const seen = new Map<string, number>();
  const seenKtp = new Map<string, number>();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cell = (c?: number) => (c ? row.getCell(c).value : null);
    const raw = { nik: cell(cols.nik), nik_ktp: cell(cols.nik_ktp), name: cell(cols.name), dept: cell(cols.dept), category: cell(cols.category) };
    if ([raw.nik, raw.nik_ktp, raw.name, raw.dept, raw.category].every((v) => v == null || String(v).trim() === "")) continue;
    const n = normalizeEmployee({ ...raw, name: textOf(raw.name), dept: textOf(raw.dept), category: textOf(raw.category) });
    if (!n.ok) {
      errors.push({ row: r, nik: normalizeNikCell(raw.nik), messages: n.errors });
      continue;
    }
    const dup = seen.get(n.value.nik);
    if (dup) {
      errors.push({ row: r, nik: n.value.nik, messages: [`NIK duplikat dengan baris ${dup}`] });
      continue;
    }
    if (n.value.nik_ktp) {
      const dupKtp = seenKtp.get(n.value.nik_ktp);
      if (dupKtp) {
        errors.push({ row: r, nik: n.value.nik, messages: [`NIK KTP duplikat dengan baris ${dupKtp}`] });
        continue;
      }
      seenKtp.set(n.value.nik_ktp, r);
    }
    seen.set(n.value.nik, r);
    rows.push(n.value);
  }
  // NIK KTP yang sudah dipakai karyawan LAIN di database.
  const ktps = rows.filter((x) => x.nik_ktp).map((x) => x.nik_ktp!);
  if (ktps.length) {
    const taken = await sql<{ nik: string; nik_ktp: string }[]>`SELECT nik, nik_ktp FROM employees WHERE nik_ktp IN ${sql(ktps)}`;
    const owner = new Map(taken.map((t) => [t.nik_ktp, t.nik]));
    for (let i = rows.length - 1; i >= 0; i--) {
      const x = rows[i];
      const o = x.nik_ktp ? owner.get(x.nik_ktp) : undefined;
      if (o && o !== x.nik) {
        errors.push({ row: seen.get(x.nik) ?? 0, nik: x.nik, messages: [`NIK KTP sudah dipakai karyawan ${o}`] });
        rows.splice(i, 1);
      }
    }
  }
  if (rows.length + errors.length > 20000) throw new Error("Maksimal 20.000 baris per impor.");

  const existing = rows.length
    ? await sql<{ nik: string; nik_ktp: string | null; name: string; dept: string; category: string }[]>`
        SELECT nik, nik_ktp, name, dept, category FROM employees WHERE nik IN ${sql(rows.map((x) => x.nik))}`
    : [];
  const byNik = new Map(existing.map((e) => [e.nik, e]));
  let inserts = 0;
  let updates = 0;
  let unchanged = 0;
  for (const x of rows) {
    const e = byNik.get(x.nik);
    if (!e) inserts++;
    else if (e.name !== x.name || e.dept !== x.dept || e.category !== x.category || (x.nik_ktp && x.nik_ktp !== e.nik_ktp)) updates++;
    else unchanged++;
  }
  return {
    rows,
    errors,
    stats: { total: rows.length + errors.length, valid: rows.length, invalid: errors.length, inserts, updates, unchanged },
  };
}

function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as Record<string, unknown>)) return ((v as { richText: { text: string }[] }).richText ?? []).map((p) => p.text).join("");
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) return String((v as { text: unknown }).text);
  if (typeof v === "object" && "result" in (v as Record<string, unknown>)) return String((v as { result: unknown }).result);
  return String(v);
}

/** Simpan hasil impor (upsert). `replace` = hapus karyawan yang tidak ada di file, kecuali yang sudah punya tiket. */
export async function commitEmployeeImport(rows: EmployeeInput[], opts: { actorId: string; replace: boolean; ip?: string; filename?: string }) {
  return sql.begin(async (tx) => {
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, name_key: nameKey(r.name), updated_by: opts.actorId }));
      const res = await tx`
        INSERT INTO employees ${tx(chunk, "nik", "nik_ktp", "name", "name_key", "dept", "category", "updated_by")}
        ON CONFLICT (nik) DO UPDATE SET name = EXCLUDED.name, name_key = EXCLUDED.name_key, dept = EXCLUDED.dept,
          category = EXCLUDED.category, updated_by = EXCLUDED.updated_by,
          nik_ktp = COALESCE(EXCLUDED.nik_ktp, employees.nik_ktp)
        WHERE (employees.name, employees.dept, employees.category, employees.nik_ktp)
          IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.dept, EXCLUDED.category, COALESCE(EXCLUDED.nik_ktp, employees.nik_ktp))`;
      upserted += res.count;
    }
    let removed = 0;
    let kept = 0;
    if (opts.replace) {
      const niks = rows.map((r) => r.nik);
      const keep = await tx<{ nik: string }[]>`
        SELECT e.nik FROM employees e
        WHERE ${niks.length ? tx`e.nik NOT IN ${tx(niks)}` : tx`TRUE`}
          AND EXISTS (SELECT 1 FROM tickets t WHERE t.nik = e.nik AND t.status IN ('ACTIVE','CHECKED_IN'))`;
      kept = keep.length;
      const del = await tx`
        DELETE FROM employees e
        WHERE ${niks.length ? tx`e.nik NOT IN ${tx(niks)}` : tx`TRUE`}
          AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.nik = e.nik AND t.status IN ('ACTIVE','CHECKED_IN'))`;
      removed = del.count;
    }
    await audit(
      { actorId: opts.actorId, action: "employees.import", entity: "employees", entityId: opts.filename ?? null, after: { rows: rows.length, upserted, replace: opts.replace, removed, kept_with_ticket: kept }, ip: opts.ip },
      tx,
    );
    return { upserted, removed, kept };
  });
}

export async function saveEmployee(v: EmployeeInput, opts: { actorId: string; originalNik?: string; ip?: string }, tx: Tx | typeof sql = sql) {
  const before = opts.originalNik ? (await tx`SELECT nik, nik_ktp, name, dept, category FROM employees WHERE nik = ${opts.originalNik}`)[0] : null;
  if (opts.originalNik && !before) return { notFound: true as const };
  if (opts.originalNik && opts.originalNik !== v.nik) {
    // Ganti NIK hanya bila NIK lama belum dipakai akun.
    const [linked] = await tx`SELECT 1 FROM users WHERE nik = ${opts.originalNik}`;
    if (linked) return { error: "NIK ini sudah tertaut ke akun; NIK tidak bisa diganti. Hapus/ubah tautan akun dulu." };
    await tx`DELETE FROM employees WHERE nik = ${opts.originalNik}`;
  }
  await tx`
    INSERT INTO employees (nik, nik_ktp, name, name_key, dept, category, updated_by)
    VALUES (${v.nik}, ${v.nik_ktp}, ${v.name}, ${nameKey(v.name)}, ${v.dept}, ${v.category}, ${opts.actorId})
    ON CONFLICT (nik) DO UPDATE SET nik_ktp = EXCLUDED.nik_ktp, name = EXCLUDED.name, name_key = EXCLUDED.name_key, dept = EXCLUDED.dept,
      category = EXCLUDED.category, updated_by = EXCLUDED.updated_by`;
  await audit({ actorId: opts.actorId, action: opts.originalNik ? "employee.update" : "employee.create", entity: "employee", entityId: v.nik, before, after: v, ip: opts.ip }, tx);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Ekspor & template (kolom sama dengan tabel admin; file ekspor bisa diimpor ulang)
// ---------------------------------------------------------------------------
export const STATUS_LABEL: Record<EmployeeAccountStatus, string> = {
  BELUM_DAFTAR: "Belum tautkan akun",
  BELUM_KLAIM: "Belum klaim tiket",
  BELUM_CHECKIN: "Belum check-in",
  SUDAH_CHECKIN: "Sudah check-in",
};
const TICKET_LABEL: Record<string, string> = { ACTIVE: "Aktif", CHECKED_IN: "Sudah check-in" };

export const EXPORT_COLUMNS = [
  { header: "NIK", key: "nik", width: 14 },
  { header: "NIK KTP", key: "nik_ktp", width: 20 },
  { header: "Nama Pegawai", key: "name", width: 34 },
  { header: "Dept", key: "dept", width: 22 },
  { header: "Kategori", key: "category", width: 10 },
  { header: "Status", key: "status", width: 14 },
  { header: "Email Akun", key: "email", width: 30 },
  { header: "No HP", key: "phone", width: 16 },
  { header: "Login Google", key: "google", width: 13 },
  { header: "Tanggal Daftar", key: "registered", width: 18 },
  { header: "Status Tiket", key: "ticket", width: 16 },
  { header: "Kategori Tiket", key: "ticketCategory", width: 16 },
  { header: "Ukuran Baju", key: "size", width: 12 },
  { header: "Tanggal Klaim", key: "claimed", width: 18 },
  { header: "Check-in", key: "checkin", width: 18 },
] as const;

function styleHeader(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0827B5" } };
  h.alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  // NIK & NIK KTP sebagai teks agar "04.12345" tidak jadi angka dan 16 digit KTP tidak terpotong.
  ws.getColumn(1).numFmt = "@";
  ws.getColumn(2).numFmt = "@";
}

export async function exportEmployeesXlsx(rows: EmployeeRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CMD Employee Gathering 2026";
  const ws = wb.addWorksheet("Data Karyawan");
  ws.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws);
  const d = (x: Date | null) => (x ? new Date(x) : null);
  for (const r of rows) {
    ws.addRow({
      nik: r.nik,
      nik_ktp: r.nik_ktp ?? "",
      name: r.name,
      dept: r.dept,
      category: r.category,
      status: STATUS_LABEL[r.status],
      email: r.user_email ?? "",
      phone: r.user_phone ?? "",
      google: r.user_id ? (r.user_google ? "Ya" : "Tidak") : "",
      registered: d(r.user_registered_at),
      ticket: r.ticket_status ? TICKET_LABEL[r.ticket_status] ?? r.ticket_status : "",
      ticketCategory: r.ticket_category ?? "",
      size: r.shirt_size ?? "",
      claimed: d(r.ticket_issued_at),
      checkin: d(r.checked_in_at),
    });
  }
  for (const k of ["registered", "claimed", "checkin"]) ws.getColumn(k).numFmt = "dd/mm/yyyy hh:mm";
  ws.autoFilter = { from: "A1", to: { row: 1, column: EXPORT_COLUMNS.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function templateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data Karyawan");
  ws.columns = EXPORT_COLUMNS.slice(0, 5).map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws);
  ws.addRow({ nik: "04.12345", nik_ktp: "3201010101900001", name: "MUHAMMAD RIZKI PRATAMA", dept: "Production", category: "CMD" });
  ws.addRow({ nik: "A1.23.4567", nik_ktp: "3271015505950002", name: "SITI NURHALIZA", dept: "Warehouse", category: "OS" });
  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 110;
  [
    "Isi sheet \"Data Karyawan\" mulai baris 2 (hapus 2 baris contoh). Kolom wajib: NIK, Nama Pegawai, Dept, Kategori. NIK KTP disarankan (boleh kosong).",
    "NIK karyawan CMD: 04.xxxx (contoh 04.0018 atau 04.12345). NIK karyawan OS: A1.xx.xxxx (contoh A1.23.4567). x = angka, jumlah digit boleh berbeda.",
    "Kolom NIK dan NIK KTP sudah berformat Teks — jangan diubah ke angka, agar \"04.\" tidak hilang dan 16 digit KTP tidak terpotong (Excel hanya menyimpan 15 digit angka).",
    "NIK KTP: 16 digit angka. Peserta boleh daftar & klaim memakai NIK karyawan ATAU NIK KTP. Sel NIK KTP yang kosong saat impor tidak menghapus NIK KTP yang sudah tersimpan.",
    "Nama Pegawai: nama lengkap sesuai Kartu Karyawan. Disimpan dalam HURUF KAPITAL; peserta harus mengetik nama yang sama saat daftar & pemesanan.",
    "Kategori: CMD atau OS (boleh dikosongkan — akan diisi otomatis dari format NIK).",
    "File hasil Ekspor dari menu Data Karyawan juga bisa diimpor ulang; kolom selain 5 kolom di atas diabaikan.",
  ].forEach((t) => help.addRow([t]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
