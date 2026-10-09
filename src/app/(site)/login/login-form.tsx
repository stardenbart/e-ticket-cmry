"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { PasswordInput } from "@/components/site/password-input";
import { OtpInput } from "@/components/site/otp-input";

type LoginRes = { ok: boolean; role?: string; needVerify?: boolean; needOtp?: boolean; challengeId?: string; message?: string };

function destination(role: string | undefined, next: string) {
  if (role === "EVENT_ADMIN" || role === "SUPER_ADMIN") return next.startsWith("/admin") || next.startsWith("/scanner") ? next : "/admin";
  if (role === "GATE_STAFF") return next.startsWith("/scanner") ? next : "/scanner";
  return next;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginRes>("/api/auth/login", { json: { email, password } });
      if (r.needVerify) {
        router.push(`/verifikasi?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
        return;
      }
      if (r.needOtp && r.challengeId) {
        setChallenge(r.challengeId);
        setInfo(r.message ?? "Kode 2FA sudah dikirim ke email Anda.");
        setBusy(false);
        return;
      }
      router.push(destination(r.role, next));
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Gagal masuk. Coba lagi.");
      setBusy(false);
    }
  }

  async function verify2fa(value = code) {
    if (value.length !== 6 || !challenge) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginRes>("/api/auth/login-2fa", { json: { challengeId: challenge, code: value } });
      router.push(destination(r.role, next));
      router.refresh();
    } catch (err) {
      const e = err instanceof ClientApiError ? err : null;
      setError(e?.message ?? "Kode salah.");
      if (e?.data.code === "CHALLENGE_EXPIRED" || e?.data.code === "OTP_LOCKED") setChallenge(null);
      setCode("");
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <div className="space-y-5">
        <Alert tone="blue" title="Verifikasi 2 langkah">
          {info} Akun admin dan staf wajib memasukkan kode setiap kali masuk.
        </Alert>
        <OtpInput value={code} onChange={setCode} onComplete={verify2fa} disabled={busy} invalid={!!error} />
        {error && <Alert tone="red">{error}</Alert>}
        <Button onClick={() => verify2fa()} disabled={busy || code.length !== 6} className="w-full">
          {busy && <Spinner />} Verifikasi & masuk
        </Button>
        <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); }} className="w-full text-sm font-semibold text-cimory-blue hover:underline">
          Kembali ke login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Link href="/lupa-password" className="text-sm font-semibold text-cimory-blue hover:underline">
          Lupa password?
        </Link>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" disabled={busy || !email || !password} className="w-full">
        {busy && <Spinner />} Masuk
      </Button>
    </form>
  );
}
