import { inputClass } from "@/components/ui";

export type FilterValues = { q?: string; kota?: string; tanggal?: string; kategori?: string };

/** Form filter berbasis GET (bekerja tanpa JavaScript). */
export function EventFilters({ action, values, cities, types }: { action: string; values: FilterValues; cities: string[]; types: string[] }) {
  const sel = `${inputClass} py-2.5 text-sm`;
  return (
    <form action={action} method="get" role="search" className="grid gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <label className="relative block sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Cari event</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input name="q" defaultValue={values.q} placeholder="Cari nama event, venue, atau kota" className={`${sel} pl-11`} />
      </label>
      <label className="block">
        <span className="sr-only">Kota</span>
        <select name="kota" defaultValue={values.kota ?? ""} className={sel}>
          <option value="">Semua kota</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="sr-only">Tanggal</span>
        <select name="tanggal" defaultValue={values.tanggal ?? ""} className={sel}>
          <option value="">Kapan saja</option>
          <option value="minggu-ini">7 hari ke depan</option>
          <option value="bulan-ini">30 hari ke depan</option>
          <option value="nanti">Lebih dari 30 hari</option>
        </select>
      </label>
      <label className="block">
        <span className="sr-only">Kategori acara</span>
        <select name="kategori" defaultValue={values.kategori ?? ""} className={sel}>
          <option value="">Semua kategori</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-xl bg-cimory-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-cimory-blue-dark sm:col-span-2 lg:col-span-1">
        Cari
      </button>
    </form>
  );
}

/** Ubah searchParams filter menjadi argumen listPublicEvents. */
export function parseFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const values: FilterValues = { q: one("q"), kota: one("kota"), tanggal: one("tanggal"), kategori: one("kategori") };
  const now = Date.now();
  const DAY = 86400_000;
  let from: Date | undefined;
  let to: Date | undefined;
  if (values.tanggal === "minggu-ini") {
    from = new Date(now);
    to = new Date(now + 7 * DAY);
  } else if (values.tanggal === "bulan-ini") {
    from = new Date(now);
    to = new Date(now + 30 * DAY);
  } else if (values.tanggal === "nanti") {
    from = new Date(now + 30 * DAY);
  }
  return { values, query: { q: values.q, city: values.kota, type: values.kategori, from, to } };
}
