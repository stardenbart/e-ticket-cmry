import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { loadCategoryContext } from "@/lib/site/category-context";
import { fmtDate, fmtTime } from "@/lib/format";
import { WaitingRoom } from "./waiting-room";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ruang Tunggu" };

export default async function QueuePage({ params }: { params: Promise<{ categoryId: string }> }) {
  await requirePageUser();
  const { categoryId } = await params;
  const ctx = await loadCategoryContext(categoryId);
  if (!ctx) notFound();
  const { event, cat, alternatives } = ctx;
  return (
    <div className="mx-auto max-w-xl px-4 pb-8 pt-20 sm:pt-24">
      <div className="mb-5 text-center">
        <p className="font-hud text-xs font-bold uppercase tracking-[0.22em] text-[#22e5ff]">✦ Ruang tunggu ✦</p>
        <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{event.name}</h1>
        <p className="text-muted">
          {cat.name} · {fmtDate(event.start_at, event.timezone)}, {fmtTime(event.start_at, event.timezone)}
        </p>
      </div>
      <WaitingRoom
        categoryId={cat.id}
        categoryName={cat.name}
        slug={event.slug}
        openAt={cat.open_at.toISOString()}
        batch={cat.admit_batch}
        intervalSec={cat.admit_interval_sec}
        alternatives={alternatives}
      />
    </div>
  );
}
