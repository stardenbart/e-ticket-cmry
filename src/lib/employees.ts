import { sql, type Tx } from "./db";
import { identityHash } from "./crypto";
import { nameKey, validateName, validateNik, type EmployeeCategory } from "./employee-shared";

export type Employee = { nik: string; name: string; name_key: string; dept: string; category: EmployeeCategory };

export async function findEmployee(nik: string, tx: Tx | typeof sql = sql): Promise<Employee | null> {
  const [e] = await tx<Employee[]>`SELECT nik, name, name_key, dept, category FROM employees WHERE nik = ${nik}`;
  return e ?? null;
}

/** Hash identitas (dipakai unique index "1 identitas = 1 tiket per event") untuk NIK karyawan. */
export const nikIdentityHash = (nik: string) => identityHash("NIK", nik);

export type EligibilityFail =
  | { ok: false; code: "INVALID_NIK" | "INVALID_NAME"; field: "nik" | "name"; message: string }
  | { ok: false; code: "NOT_ELIGIBLE"; field: "nik"; message: string }
  | { ok: false; code: "NAME_MISMATCH"; field: "name"; message: string };

/**
 * Cek NIK + nama terhadap daftar karyawan eligible.
 * NIK harus sama persis; nama dicocokkan setelah mengabaikan tanda baca & spasi ganda.
 */
export async function checkEligibility(
  rawNik: string,
  rawName: string,
  tx: Tx | typeof sql = sql,
): Promise<{ ok: true; employee: Employee } | EligibilityFail> {
  const n = validateNik(rawNik);
  if (!n.ok) return { ok: false, code: "INVALID_NIK", field: "nik", message: n.message };
  const nm = validateName(rawName);
  if (!nm.ok) return { ok: false, code: "INVALID_NAME", field: "name", message: nm.message };
  const employee = await findEmployee(n.nik, tx);
  if (!employee) {
    return { ok: false, code: "NOT_ELIGIBLE", field: "nik", message: "NIK tidak terdaftar sebagai peserta eligible. Hubungi panitia bila menurut Anda ini keliru." };
  }
  if (employee.name_key !== nameKey(nm.name)) {
    return { ok: false, code: "NAME_MISMATCH", field: "name", message: "Nama tidak sesuai dengan data karyawan untuk NIK ini. Tulis nama lengkap sesuai KTP (huruf kapital)." };
  }
  return { ok: true, employee };
}
