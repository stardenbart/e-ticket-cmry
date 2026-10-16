import { sql, type Tx } from "./db";
import { identityHash } from "./crypto";
import { nameKey, parseIdentity, validateName, type EmployeeCategory } from "./employee-shared";

export type Employee = { nik: string; nik_ktp: string | null; name: string; name_key: string; dept: string; category: EmployeeCategory };

export async function findEmployee(nik: string, tx: Tx | typeof sql = sql): Promise<Employee | null> {
  const [e] = await tx<Employee[]>`SELECT nik, nik_ktp, name, name_key, dept, category FROM employees WHERE nik = ${nik}`;
  return e ?? null;
}

/** Cari karyawan dari NIK karyawan ATAU NIK KTP (16 digit). */
export async function findEmployeeByIdentity(raw: string, tx: Tx | typeof sql = sql): Promise<Employee | null> {
  const id = parseIdentity(raw);
  if (!id.ok) return null;
  const [e] = await tx<Employee[]>`
    SELECT nik, nik_ktp, name, name_key, dept, category FROM employees
    WHERE ${id.kind === "KTP" ? tx`nik_ktp = ${id.ktp}` : tx`nik = ${id.nik}`}`;
  return e ?? null;
}

/** Hash identitas (dipakai unique index "1 identitas = 1 tiket per event") untuk NIK karyawan. */
export const nikIdentityHash = (nik: string) => identityHash("NIK", nik);

export type EligibilityFail =
  | { ok: false; code: "INVALID_NIK" | "INVALID_NAME"; field: "nik" | "name"; message: string }
  | { ok: false; code: "NOT_ELIGIBLE"; field: "nik"; message: string }
  | { ok: false; code: "NAME_MISMATCH"; field: "name"; message: string };

/**
 * Cek NIK (karyawan atau KTP) + nama terhadap daftar karyawan eligible.
 * NIK harus sama persis; nama dicocokkan setelah mengabaikan tanda baca & spasi ganda.
 */
export async function checkEligibility(
  rawNik: string,
  rawName: string,
  tx: Tx | typeof sql = sql,
): Promise<{ ok: true; employee: Employee } | EligibilityFail> {
  const id = parseIdentity(rawNik);
  if (!id.ok) return { ok: false, code: "INVALID_NIK", field: "nik", message: id.message };
  const nm = validateName(rawName);
  if (!nm.ok) return { ok: false, code: "INVALID_NAME", field: "name", message: nm.message };
  const employee = await findEmployeeByIdentity(rawNik, tx);
  if (!employee) {
    const what = id.kind === "KTP" ? "NIK KTP" : "NIK karyawan";
    return { ok: false, code: "NOT_ELIGIBLE", field: "nik", message: `${what} tidak terdaftar di daftar karyawan. Coba isi dengan NIK yang lain (karyawan/KTP), atau hubungi panitia.` };
  }
  if (employee.name_key !== nameKey(nm.name)) {
    return { ok: false, code: "NAME_MISMATCH", field: "name", message: "Nama tidak sesuai dengan data karyawan untuk NIK ini. Tulis nama lengkap sesuai Kartu Karyawan (huruf kapital)." };
  }
  return { ok: true, employee };
}
