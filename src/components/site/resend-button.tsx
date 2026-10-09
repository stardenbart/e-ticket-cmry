"use client";

import { useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";

/** Tombol kirim ulang kode dengan cooldown 60 detik (cooldown juga ditegakkan di server). */
export function ResendButton({ email, purpose, initialCooldown = 60, onMessage }: { email: string; purpose: "VERIFY_EMAIL" | "RESET_PASSWORD"; initialCooldown?: number; onMessage: (m: { tone: "blue" | "red"; text: string }) => void }) {
  const [left, setLeft] = useState(initialCooldown);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function resend() {
    if (!email) return onMessage({ tone: "red", text: "Isi email terlebih dulu." });
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/api/auth/resend-otp", { json: { email, purpose } });
      onMessage({ tone: "blue", text: r.message });
      setLeft(60);
    } catch (e) {
      const err = e instanceof ClientApiError ? e : null;
      onMessage({ tone: "red", text: err?.message ?? "Gagal mengirim ulang kode." });
      const retry = Number(err?.data.retryAfter);
      if (retry > 0) setLeft(retry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={resend} disabled={busy || left > 0} className="text-sm font-semibold text-cimory-blue hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
      {left > 0 ? `Kirim ulang kode dalam ${left} detik` : busy ? "Mengirim…" : "Kirim ulang kode"}
    </button>
  );
}
