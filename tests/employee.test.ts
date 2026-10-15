import { describe, expect, it } from "vitest";
import { cleanNik, nameKey, nikCategory, validateName, validateNik } from "@/lib/employee-shared";
import { normalizeEmployee } from "@/lib/admin/employees";

describe("NIK karyawan", () => {
  it("CMD 04.<angka> dan OS A1.<angka>.<angka>, jumlah digit boleh berbeda", () => {
    expect(nikCategory("04.12345")).toBe("CMD");
    expect(nikCategory("04.0018")).toBe("CMD");
    expect(nikCategory("A1.5.123")).toBe("OS");
    expect(nikCategory("A1.23.4567")).toBe("OS");
    expect(validateNik(" a1.23.4567 ")).toEqual({ ok: true, nik: "A1.23.4567", category: "OS" });
  });
  it("menolak format salah", () => {
    for (const bad of ["0412345", "04.", "04.12.34", "A1.234567", "A2.23.4567", "05.12345", "A1.2X.4567", "04.12A45", ""]) {
      expect(validateNik(bad).ok, bad).toBe(false);
    }
  });
  it("cleanNik hanya merapikan, tidak menebak titik", () => {
    expect(cleanNik("04 .12345")).toBe("04.12345");
    expect(cleanNik("0412345")).toBe("0412345");
  });
});

describe("Nama sesuai KTP (huruf kapital)", () => {
  it("wajib kapital", () => {
    expect(validateName("Budi Santoso").ok).toBe(false);
    expect(validateName("BUDI  SANTOSO ")).toEqual({ ok: true, name: "BUDI SANTOSO" });
    expect(validateName("MUH. RIZKI-PRATAMA").ok).toBe(true);
    expect(validateName("BUDI123").ok).toBe(false);
  });
  it("pencocokan mengabaikan tanda baca & spasi ganda", () => {
    expect(nameKey("MUH. RIZKI")).toBe(nameKey("MUH  RIZKI"));
    expect(nameKey("SITI NUR'AINI")).toBe("SITI NUR AINI");
    expect(nameKey("BUDI SANTOSO")).not.toBe(nameKey("BUDI SANTOS"));
  });
});

describe("Baris impor data karyawan", () => {
  it("kategori otomatis dari NIK, nama jadi kapital", () => {
    expect(normalizeEmployee({ nik: "04.00001", name: "budi santoso", dept: " Production ", category: "" })).toEqual({
      ok: true,
      value: { nik: "04.00001", name: "BUDI SANTOSO", dept: "Production", category: "CMD" },
    });
  });
  it("Excel mengubah 04.0018 menjadi angka 4.0018 → dikembalikan", () => {
    const r = normalizeEmployee({ nik: 4.0018, name: "A", dept: "", category: "CMD" });
    expect(r.ok && r.value.nik).toBe("04.0018");
  });
  it("kategori tidak cocok dengan format NIK ditolak", () => {
    const r = normalizeEmployee({ nik: "A1.23.4567", name: "SARI", dept: "", category: "CMD" });
    expect(r.ok).toBe(false);
  });
});
