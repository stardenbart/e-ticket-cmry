"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";

/**
 * Editor rich text sederhana (contenteditable). Hasilnya tetap disanitasi di server
 * dengan allowlist sebelum disimpan, jadi editor ini bukan garis pertahanan XSS.
 */
export function RichTextEditor({ value, onChange, label, id, minHeight = 180 }: { value: string; onChange: (html: string) => void; label: string; id: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>("");

  useEffect(() => {
    if (ref.current && value !== last.current) {
      ref.current.innerHTML = value;
      last.current = value;
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? "";
    last.current = html;
    onChange(html);
  };

  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const tools: { label: string; title: string; run: () => void; className?: string }[] = [
    { label: "B", title: "Tebal", run: () => cmd("bold"), className: "font-bold" },
    { label: "I", title: "Miring", run: () => cmd("italic"), className: "italic" },
    { label: "H", title: "Subjudul", run: () => cmd("formatBlock", "h3"), className: "font-bold" },
    { label: "¶", title: "Paragraf", run: () => cmd("formatBlock", "p") },
    { label: "• Daftar", title: "Daftar berpoin", run: () => cmd("insertUnorderedList") },
    { label: "1. Daftar", title: "Daftar bernomor", run: () => cmd("insertOrderedList") },
    {
      label: "Tautan",
      title: "Sisipkan tautan",
      run: () => {
        const url = window.prompt("URL tautan (https://…)");
        if (url && /^(https?:\/\/|mailto:)/i.test(url)) cmd("createLink", url);
      },
    },
    { label: "Hapus format", title: "Hapus format", run: () => cmd("removeFormat") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-cimory-blue focus-within:ring-2 focus-within:ring-cimory-blue/20">
      <div className="flex flex-wrap gap-1 border-b border-line bg-slate-50 px-2 py-1.5" role="toolbar" aria-label={`Format ${label}`}>
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            className={cx("rounded-md px-2.5 py-1 text-sm text-ink hover:bg-white hover:shadow-sm", t.className)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="rich-text px-4 py-3 text-[15px] leading-relaxed outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
