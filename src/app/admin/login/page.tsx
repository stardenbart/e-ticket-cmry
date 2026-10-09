"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ClientApiError } from "@/lib/client-api";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";

type LoginRes = { ok: boolean; needOtp?: boolean; needVerify?: boolean; challengeId?: string; role?: string; message?: string };

function AdminLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next")?.startsWith("/admin") ? sp.get("next")! : "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (role?: string) => {
    if (role === "GATE_STAFF") {
      setError("Akun staf gate tidak punya akses panel admin. Gunakan aplikasi scanner di /scanner.");
      fetch("/api/auth/logout", { method: "POST" });
      setChallenge(null);
      return;
    }
    if (role === "ATTENDEE") {
      setError("Akun ini bukan akun admin.");
      fetch("/api/auth/logout", { method: "POST" });
      return;
    }
    router.replace(next);
    router.refresh();
  };

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginRes>("/api/auth/login", { json: { email, password } });
      if (r.needOtp && r.challengeId) {
        setChallenge(r.challengeId);
        setInfo(`Kode 6 digit sudah dikirim ke ${email}. Berlaku 5 menit.`);
      } else if (r.needVerify) setError("Email akun ini belum terverifikasi.");
      else finish(r.role);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Gagal login.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginRes>("/api/auth/login-2fa", { json: { challengeId: challenge, code } });
      finish(r.role);
    } catch (err) {
      const ce = err as ClientApiError;
      setError(ce.message);
      if (ce.data?.code === "CHALLENGE_EXPIRED" || ce.data?.code === "OTP_LOCKED") {
        setChallenge(null);
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-cimory-light px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
        <div className="bg-cimory-gradient px-7 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">E-Ticket Gathering</p>
          <h1 className="mt-1 text-2xl font-bold">Panel Admin</h1>
          <p className="mt-1 text-sm opacity-90">Login dengan verifikasi 2 langkah (OTP email).</p>
        </div>
        <div className="space-y-5 px-7 py-6">
          {error && <Alert tone="red">{error}</Alert>}
          {!challenge ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" htmlFor="password">
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner />} Lanjut
              </Button>
              <p className="text-center text-sm text-muted">
                Lupa password? Atur ulang lewat <a className="font-semibold text-cimory-blue underline" href="/lupa-password">halaman ini</a>.
              </p>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4">
              {info && <Alert tone="blue">{info}</Alert>}
              <Field label="Kode verifikasi" htmlFor="otp">
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl font-bold tracking-[0.5em]"
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                {busy && <Spinner />} Verifikasi & Masuk
              </Button>
              <button type="button" className="w-full text-sm font-semibold text-cimory-blue" onClick={() => { setChallenge(null); setCode(""); setInfo(null); }}>
                Kembali ke login
              </button>
            </form>
          )}
          <p className="border-t border-line pt-4 text-center text-sm text-muted">
            Staf gate? Buka <a className="font-semibold text-cimory-blue underline" href="/scanner">aplikasi scanner</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
