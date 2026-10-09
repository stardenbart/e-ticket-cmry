// Format tanggal/angka Indonesia (id-ID, 24 jam). Aman dipakai di server maupun klien.

export const TZ_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

const TZ_OFFSET_H: Record<string, number> = { "Asia/Jakarta": 7, "Asia/Makassar": 8, "Asia/Jayapura": 9 };

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

export function fmtDate(d: Date | string | number, tz = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(toDate(d));
}

export function fmtDateShort(d: Date | string | number, tz = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(toDate(d));
}

export function fmtTime(d: Date | string | number, tz = "Asia/Jakarta") {
  const t = new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(toDate(d));
  return `${t.replace(".", ":")} ${TZ_LABEL[tz] ?? ""}`.trim();
}

export function fmtDateTime(d: Date | string | number, tz = "Asia/Jakarta") {
  return `${fmtDateShort(d, tz)}, ${fmtTime(d, tz)}`;
}

export function fmtNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** "YYYY-MM-DDTHH:mm" waktu lokal zona event → Date (UTC). Zona Indonesia tanpa DST. */
export function zonedLocalToUtc(local: string, tz: string): Date {
  const off = TZ_OFFSET_H[tz] ?? 7;
  const [date, time = "00:00"] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - off, mm));
}

/** Date (UTC) → "YYYY-MM-DDTHH:mm" di zona event (untuk input datetime-local). */
export function utcToZonedLocal(d: Date | string, tz: string): string {
  const shifted = new Date(toDate(d).getTime() + (TZ_OFFSET_H[tz] ?? 7) * 3600_000);
  return shifted.toISOString().slice(0, 16);
}
