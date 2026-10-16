// Akun peserta (role ATTENDEE) yang sudah daftar: daftar, filter, ekspor, dan tindakan admin.
import ExcelJS from "exceljs";
import { sql } from "../db";

export type ParticipantAccountRow = {
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
  created_at: Date;
  disabled_at: Date | null;
  tickets_active: number;
  checked_in: boolean;
  last_ticket_category: string | null;
};

export type AccountFilter = { q?: string; link?: string; ticket?: string; state?: string; limit?: number; offset?: number };

function where(f: AccountFilter) {
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, "")}%` : null;
  return sql`
    WHERE u.role = 'ATTENDEE'
      ${like ? sql`AND (u.full_name ILIKE ${like} OR u.email ILIKE ${like} OR u.nik ILIKE ${like} OR u.phone ILIKE ${like} OR e.nik_ktp ILIKE ${like})` : sql``}
      ${f.link === "LINKED" ? sql`AND e.nik IS NOT NULL` : f.link === "UNLINKED" ? sql`AND e.nik IS NULL` : sql``}
      ${f.ticket === "HAS" ? sql`AND t.active > 0` : f.ticket === "NONE" ? sql`AND coalesce(t.active, 0) = 0` : sql``}
      ${f.state === "ACTIVE" ? sql`AND u.disabled_at IS NULL` : f.state === "DISABLED" ? sql`AND u.disabled_at IS NOT NULL` : sql``}
      ${f.state === "NO_PHONE" ? sql`AND u.phone IS NULL` : sql``}`;
}

const from = () => sql`
  FROM users u
  LEFT JOIN employees e ON e.nik = u.nik
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE tk.status IN ('ACTIVE','CHECKED_IN'))::int AS active,
           bool_or(tk.status = 'CHECKED_IN') AS checked_in,
           (array_agg(c.name ORDER BY tk.issued_at DESC) FILTER (WHERE tk.status IN ('ACTIVE','CHECKED_IN')))[1] AS last_category
    FROM tickets tk JOIN ticket_categories c ON c.id = tk.category_id
    WHERE tk.user_id = u.id
  ) t ON TRUE`;

export async function queryParticipantAccounts(f: AccountFilter) {
  const rows = await sql<ParticipantAccountRow[]>`
    SELECT u.id, u.full_name, u.email, u.phone, u.nik, e.dept, e.category, (e.nik IS NOT NULL) AS eligible,
           (u.google_sub IS NOT NULL) AS google, (u.password_hash IS NOT NULL) AS has_password,
           u.created_at, u.disabled_at,
           coalesce(t.active, 0) AS tickets_active, coalesce(t.checked_in, false) AS checked_in, t.last_category AS last_ticket_category
    ${from()}
    ${where(f)}
    ORDER BY u.created_at DESC
    ${f.limit ? sql`LIMIT ${f.limit} OFFSET ${f.offset ?? 0}` : sql``}`;
  const [{ total }] = await sql<{ total: number }[]>`SELECT count(*)::int AS total ${from()} ${where(f)}`;
  return { rows, total };
}

export async function participantAccountStats() {
  const [s] = await sql<{ total: number; linked: number; unlinked: number; with_ticket: number; disabled: number; no_phone: number; google: number }[]>`
    SELECT count(*)::int AS total,
           count(e.nik)::int AS linked,
           (count(*) - count(e.nik))::int AS unlinked,
           count(*) FILTER (WHERE coalesce(t.active, 0) > 0)::int AS with_ticket,
           count(u.disabled_at)::int AS disabled,
           count(*) FILTER (WHERE u.phone IS NULL)::int AS no_phone,
           count(u.google_sub)::int AS google
    ${from()}
    WHERE u.role = 'ATTENDEE'`;
  return s;
}

export async function exportParticipantAccountsXlsx(rows: ParticipantAccountRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CMD Employee Gathering 2026";
  const ws = wb.addWorksheet("Akun Peserta");
  ws.columns = [
    { header: "Nama", key: "name", width: 32 },
    { header: "Email", key: "email", width: 32 },
    { header: "No HP", key: "phone", width: 16 },
    { header: "NIK", key: "nik", width: 14 },
    { header: "Dept", key: "dept", width: 22 },
    { header: "Kategori", key: "category", width: 10 },
    { header: "Tertaut ke data karyawan", key: "eligible", width: 14 },
    { header: "Login", key: "login", width: 16 },
    { header: "Tanggal Daftar", key: "created", width: 18 },
    { header: "Tiket", key: "ticket", width: 18 },
    { header: "Status Akun", key: "state", width: 14 },
  ];
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0827B5" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getColumn("phone").numFmt = "@";
  ws.getColumn("nik").numFmt = "@";
  for (const r of rows) {
    ws.addRow({
      name: r.full_name,
      email: r.email,
      phone: r.phone ?? "",
      nik: r.nik ?? "",
      dept: r.dept ?? "",
      category: r.category ?? "",
      eligible: r.eligible ? "Ya" : "Tidak",
      login: [r.has_password && "Password", r.google && "Google"].filter(Boolean).join(" + ") || "—",
      created: new Date(r.created_at),
      ticket: r.tickets_active ? `${r.checked_in ? "Sudah check-in" : "Aktif"} · ${r.last_ticket_category ?? ""}` : "Belum klaim",
      state: r.disabled_at ? "Dinonaktifkan" : "Aktif",
    });
  }
  ws.getColumn("created").numFmt = "dd/mm/yyyy hh:mm";
  ws.autoFilter = { from: "A1", to: { row: 1, column: 11 } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
