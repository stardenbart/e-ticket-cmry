import { describe, expect, it } from "vitest";
import { categoryStatus, isLocked } from "@/lib/events";

const now = Date.UTC(2026, 9, 21, 5, 30); // 21 Okt 2026 12:30 WIB
const base = { open_at: new Date(now - 30 * 60_000), close_at: new Date(now + 86400_000), is_closed: false };

describe("Kategori berantai (buka setelah kategori lain habis)", () => {
  it("terkunci selama prasyarat belum habis, walau jam bukanya sudah lewat", () => {
    const c = { ...base, opens_after_category_id: "a", unlocked_at: null };
    expect(isLocked(c)).toBe(true);
    expect(categoryStatus(c, 100, now)).toBe("LOCKED");
  });
  it("terbuka setelah unlocked_at terisi", () => {
    const c = { ...base, opens_after_category_id: "a", unlocked_at: new Date(now - 60_000) };
    expect(isLocked(c)).toBe(false);
    expect(categoryStatus(c, 100, now)).toBe("OPEN");
    expect(categoryStatus(c, 0, now)).toBe("SOLD_OUT");
  });
  it("kategori biasa tidak terpengaruh", () => {
    expect(categoryStatus(base, 5, now)).toBe("OPEN");
    expect(categoryStatus({ ...base, opens_after_category_id: null, unlocked_at: null }, 5, now)).toBe("OPEN");
  });
  it("ditutup tetap menang atas terkunci", () => {
    expect(categoryStatus({ ...base, is_closed: true, opens_after_category_id: "a", unlocked_at: null }, 5, now)).toBe("CLOSED");
  });
});
