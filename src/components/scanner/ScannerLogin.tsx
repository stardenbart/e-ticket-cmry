"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCachedUser } from "@/lib/scanner/local";

type Step = { kind: "password" } | { kind: "otp"; challengeId: string };

async function post<T>(url: string, json: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: { code: string; message: string } } }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json), credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const inputCls = "min-h-14 w-full rounded-xl border border-white/20 bg-slate-900 px-4 text-lg text-white placeholder:text-white/40 focus:border-white focus:outline-none";

export default function ScannerLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "err" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const r = await fetch("/api/scanner/events", { cache: "no-store" });
    if (r.status === 403) {
      await fetch("/api/auth/logout", { method: "POST" });
      setStep({ kind: "password" });
      setMsg({ tone: "err", text: "Akun ini bukan staf gate atau admin." });
      return;
    }
    const d = await r.json();
    if (d.user) await setCachedUser(d.user);
    router.replace("/scanner");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) return setMsg({ tone: "err", text: "Login butuh koneksi internet." });
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{ ok: boolean; needOtp?: boolean; needVerify?: boolean; challengeId?: string; message?: string }>("/api/auth/login", { email, password });
      if (!r.ok) return setMsg({ tone: "err", text: r.data.error?.message ?? "Login gagal." });
      if (r.data.needOtp && r.data.challengeId) {
        setStep({ kind: "otp", challengeId: r.data.challengeId });
        setMsg({ tone: "info", text: "Kode 2FA 6 digit sudah dikirim ke email Anda." });
        return;
      }
      if (r.data.needVerify) return setMsg({ tone: "err", text: r.data.message ?? "Email belum terverifikasi." });
      await finish();
    } catch {
      setMsg({ tone: "err", text: "Tidak dapat terhubung ke server." });
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "otp") return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post("/api/auth/login-2fa", { challengeId: step.challengeId, code });
      if (!r.ok) {
        if (r.data.error?.code === "CHALLENGE_EXPIRED") setStep({ kind: "password" });
        return setMsg({ tone: "err", text: r.data.error?.message ?? "Kode salah." });
      }
      await finish();
    } catch {
      setMsg({ tone: "err", text: "Tidak dapat terhubung ke server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 text-white">
      <div className="mb-8">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-cimory-gradient">
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="white" strokeWidth="2" aria-hidden>
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold">Login Staf Gate</h1>
        <p className="mt-1 text-white/70">Scanner tiket E-Ticket Gathering. Sesi berlaku 12 jam.</p>
      </div>

      {step.kind === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
          <button disabled={busy} className="min-h-14 w-full rounded-xl bg-cimory-blue text-lg font-bold disabled:opacity-60">
            {busy ? "Memproses…" : "Lanjut"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Kode 2FA dari email</span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputCls} text-center font-mono text-3xl tracking-[0.5em]`}
              autoFocus
            />
          </label>
          <button disabled={busy || code.length !== 6} className="min-h-14 w-full rounded-xl bg-cimory-blue text-lg font-bold disabled:opacity-60">
            {busy ? "Memverifikasi…" : "Masuk"}
          </button>
          <button type="button" onClick={() => setStep({ kind: "password" })} className="w-full py-2 text-sm font-semibold text-white/70 underline">
            Kembali
          </button>
        </form>
      )}

      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.tone === "err" ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white"}`}>
          {msg.text}
        </p>
      )}
    </main>
  );
}
