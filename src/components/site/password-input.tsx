"use client";

import { useState, type ComponentProps } from "react";
import { inputClass, cx } from "@/components/ui";

export function PasswordInput({ className, ...p }: ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...p} type={show ? "text" : "password"} className={cx(inputClass, "pr-20", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-sm font-semibold text-cimory-blue hover:bg-slate-100"
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
      >
        {show ? "Sembunyi" : "Lihat"}
      </button>
    </div>
  );
}
