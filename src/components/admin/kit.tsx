"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, cx } from "@/components/ui";

const EVENT_STATUS: Record<string, { label: string; tone: "slate" | "blue" | "green" | "amber" | "red"; icon: string }> = {
  DRAFT: { label: "Draft", tone: "slate", icon: "✎" },
  PUBLISHED: { label: "Published", tone: "blue", icon: "◷" },
  ON_SALE: { label: "On Sale", tone: "green", icon: "●" },
  CLOSED: { label: "Closed", tone: "amber", icon: "■" },
  FINISHED: { label: "Finished", tone: "slate", icon: "✓" },
  CANCELLED: { label: "Cancelled", tone: "red", icon: "✕" },
};

export function EventStatusChip({ status }: { status: string }) {
  const s = EVENT_STATUS[status] ?? { label: status, tone: "slate" as const, icon: "" };
  return (
    <Badge tone={s.tone} icon={<span aria-hidden>{s.icon}</span>}>
      {s.label}
    </Badge>
  );
}

const TICKET_STATUS: Record<string, { label: string; tone: "green" | "blue" | "red" | "slate" }> = {
  ACTIVE: { label: "Aktif", tone: "green" },
  CHECKED_IN: { label: "Sudah check-in", tone: "blue" },
  CANCELLED: { label: "Batal", tone: "red" },
  REVOKED: { label: "Dicabut", tone: "slate" },
};

export function TicketStatusChip({ status }: { status: string }) {
  const s = TICKET_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Bar terisi: claimed / quota. Merah saat sisa < 10%. */
export function QuotaBar({ claimed, quota, className }: { claimed: number; quota: number; className?: string }) {
  const pct = quota > 0 ? Math.min(100, (claimed / quota) * 100) : 0;
  const low = quota > 0 && (quota - claimed) / quota < 0.1;
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)} role="progressbar" aria-valuenow={claimed} aria-valuemin={0} aria-valuemax={quota}>
      <div className={cx("h-full rounded-full transition-[width] duration-700", low ? "bg-cimory-red" : "bg-cimory-blue")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={cx("m-auto w-[calc(100%-2rem)] rounded-2xl border border-line p-0 shadow-2xl backdrop:bg-slate-900/50", wide ? "max-w-2xl" : "max-w-lg")}
    >
      {open && (
        <div>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Tutup">
              ✕
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export type ToastMsg = { tone: "ok" | "err"; text: string } | null;

export function useToast() {
  const [msg, setMsg] = useState<ToastMsg>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.tone === "err" ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div
      role={msg.tone === "err" ? "alert" : "status"}
      className={cx(
        "animate-fade-up fixed bottom-4 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg",
        msg.tone === "ok" ? "bg-ok" : "bg-cimory-red-dark",
      )}
    >
      {msg.tone === "ok" ? "✓ " : "⚠ "}
      {msg.text}
    </div>
  ) : null;
  return { toast: setMsg, toastNode: node };
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap bg-cimory-blue px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-line px-3 py-2.5 align-top text-sm", className)}>{children}</td>;
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: "red" | "blue" | "green"; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-bold tabular-nums", tone === "red" ? "text-cimory-red-dark" : tone === "green" ? "text-ok" : "text-cimory-blue")}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
