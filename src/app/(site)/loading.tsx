import { EventGridSkeleton } from "@/components/site/event-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6" aria-busy="true" aria-label="Memuat">
      <div className="skeleton aspect-[4/3] w-full rounded-3xl sm:aspect-[2/1] lg:aspect-[5/2]" />
      <div className="skeleton h-14 w-full" />
      <EventGridSkeleton />
    </div>
  );
}
