import Link from "next/link";
import type { AltCategory } from "@/lib/site/category-context";
import { QuotaBar } from "./quota-bar";

/** Kartu kategori alternatif yang masih tersedia di event yang sama. */
export function AltCategories({ slug, items }: { slug: string; items: AltCategory[] }) {
  if (!items.length)
    return <p className="text-sm text-muted">Tidak ada kategori lain yang masih tersedia untuk event ini.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Kategori lain yang masih tersedia:</p>
      {items.map((c) => (
        <Link key={c.id} href={`/event/${slug}`} className="block rounded-2xl border border-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="flex items-center gap-2 font-bold">
            <span className="size-3 rounded-full" style={{ background: c.color }} aria-hidden />
            {c.name}
          </p>
          {c.description && <p className="mb-2 text-sm text-muted">{c.description}</p>}
          <QuotaBar remaining={c.remaining} quota={c.quota} compact />
          <p className="mt-2 text-sm font-semibold text-cimory-blue">Pilih kategori ini →</p>
        </Link>
      ))}
    </div>
  );
}
