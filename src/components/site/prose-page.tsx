import type { ReactNode } from "react";
import { PageHero } from "./ornaments";

export function ProsePage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 sm:pt-20">
      <PageHero title={title} subtitle={updated ? <span className="text-sm">Terakhir diperbarui {updated}</span> : undefined} />
      <div className="mv-frame rich-text mt-4 space-y-2 p-6 text-[15px] leading-relaxed text-[#e6ebff] sm:p-10">{children}</div>
    </div>
  );
}
