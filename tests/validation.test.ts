import { describe, expect, it } from "vitest";
import { validateIdNumber } from "@/lib/validation";
import { zonedLocalToUtc, utcToZonedLocal } from "@/lib/format";
import { categoryStatus, eventStatus } from "@/lib/events";

describe("validateIdNumber", () => {
  it("KTP 16 digit", () => {
    expect(validateIdNumber("KTP", "3201 0101 0190 0001")).toEqual({ ok: true, value: "3201010101900001" });
    expect(validateIdNumber("KTP", "12345").ok).toBe(false);
  });
  it("SIM 12–16 digit, Paspor 6–9 alfanumerik", () => {
    expect(validateIdNumber("SIM", "1201-9876-5432").ok).toBe(true);
    expect(validateIdNumber("PASPOR", "c1234567")).toEqual({ ok: true, value: "C1234567" });
    expect(validateIdNumber("PASPOR", "AB").ok).toBe(false);
  });
});

describe("zona waktu event", () => {
  it("WIB/WITA/WIT bolak-balik", () => {
    const d = zonedLocalToUtc("2026-12-31T19:30", "Asia/Makassar");
    expect(d.toISOString()).toBe("2026-12-31T11:30:00.000Z");
    expect(utcToZonedLocal(d, "Asia/Makassar")).toBe("2026-12-31T19:30");
    expect(utcToZonedLocal(d, "Asia/Jayapura")).toBe("2026-12-31T20:30");
  });
});

describe("status kategori & event", () => {
  const now = Date.parse("2026-10-08T10:00:00Z");
  const cat = (openMin: number, closeMin: number, is_closed = false) => ({
    open_at: new Date(now + openMin * 60_000),
    close_at: new Date(now + closeMin * 60_000),
    is_closed,
  });
  it("UPCOMING / OPEN / SOLD_OUT / CLOSED", () => {
    expect(categoryStatus(cat(5, 60), 10, now)).toBe("UPCOMING");
    expect(categoryStatus(cat(-5, 60), 10, now)).toBe("OPEN");
    expect(categoryStatus(cat(-5, 60), 0, now)).toBe("SOLD_OUT");
    expect(categoryStatus(cat(-60, -5), 10, now)).toBe("CLOSED");
    expect(categoryStatus(cat(-5, 60, true), 10, now)).toBe("CLOSED");
  });
  it("Published → On Sale → Closed → Finished", () => {
    const e = { status: "PUBLISHED" as const, end_at: new Date(now + 86400_000) };
    expect(eventStatus(e, [cat(5, 60)], now)).toBe("PUBLISHED");
    expect(eventStatus(e, [cat(-5, 60)], now)).toBe("ON_SALE");
    expect(eventStatus(e, [cat(-60, -5)], now)).toBe("CLOSED");
    expect(eventStatus({ ...e, end_at: new Date(now - 1) }, [cat(-5, 60)], now)).toBe("FINISHED");
    expect(eventStatus({ ...e, status: "CANCELLED" }, [cat(-5, 60)], now)).toBe("CANCELLED");
  });
});
