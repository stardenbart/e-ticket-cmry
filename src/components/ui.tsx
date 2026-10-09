// Komponen UI dasar bersama (server & client safe — tanpa state).
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "danger" | "secondary" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-cimory-blue text-white hover:bg-cimory-blue-dark shadow-sm",
  // Merah hanya untuk tombol dengan teks tebal ≥ 18.7px (aturan kontras PRD) — font-bold text-lg.
  danger: "bg-cimory-red text-white hover:bg-cimory-red-dark shadow-sm",
  secondary: "bg-white text-cimory-blue border border-line hover:bg-slate-50",
  ghost: "text-cimory-blue hover:bg-slate-100",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...p} className={cx(base, VARIANT[variant], variant === "danger" && "text-lg font-bold", className)} />;
}

export function ButtonLink({ variant = "primary", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...p} className={cx(base, VARIANT[variant], variant === "danger" && "text-lg font-bold", className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-surface shadow-sm", className)} />;
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-cimory-red-dark" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-slate-400 focus:border-cimory-blue focus:outline-none focus:ring-2 focus:ring-cimory-blue/20 disabled:bg-slate-100";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cx(inputClass, className)} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cx(inputClass, "appearance-none pr-10", className)} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(inputClass, "min-h-28", className)} />;
}

type Tone = "blue" | "red" | "green" | "amber" | "slate";
const TONE: Record<Tone, string> = {
  blue: "bg-blue-50 text-cimory-blue ring-blue-200",
  red: "bg-red-50 text-cimory-red-dark ring-red-200",
  green: "bg-green-50 text-ok ring-green-200",
  amber: "bg-amber-50 text-warn ring-amber-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

/** Status selalu dengan teks (dan ikon opsional), tidak pernah hanya warna. */
export function Badge({ tone = "slate", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Alert({ tone = "blue", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", TONE[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-blue-50 text-cimory-blue">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
          <path d="M14 5v14" strokeDasharray="2 2" />
        </svg>
      </div>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-muted">{children}</div>}
      {action}
    </Card>
  );
}
