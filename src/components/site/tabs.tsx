"use client";

import { useId, useRef, useState } from "react";
import { cx } from "@/components/ui";

/** Tab aksesibel (role=tablist, panah kiri/kanan). Konten HTML sudah disanitasi di server. */
export function HtmlTabs({ tabs }: { tabs: { label: string; html: string }[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Informasi event" className="flex gap-1 border-b border-line" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cx(
              "relative -mb-px px-4 py-3 text-sm font-semibold transition",
              i === active ? "text-[#22e5ff]" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            <span className={cx("absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#ff2bd6] transition-transform", i === active ? "scale-x-100" : "scale-x-0")} />
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="rich-text animate-fade-up pt-4 text-[15px] text-slate-700"
          dangerouslySetInnerHTML={{ __html: t.html || "<p>Belum ada informasi.</p>" }}
        />
      ))}
    </div>
  );
}
