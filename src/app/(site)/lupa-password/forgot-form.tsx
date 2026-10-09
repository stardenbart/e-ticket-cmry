"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { OtpInput } from "@/components/site/otp-input";
import { PasswordInput } from "@/components/site/password-input";
import { ResendButton } from "@/components/site/resend-button";

export function ForgotForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "blue" | "red"; text: string } | null>(null);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ message: string }>("/api/auth/forgot", { json: { email: email.trim() } });
      setMsg({ tone: "blue", text: r.message });
      setStep("reset");
    } catch (err) {
      const e = err instanceof ClientApiError ? err : null;
      setMsg({ tone: "red", text: e?.message ?? "Gagal mengirim kode." });
      if (e?.data.code === "COOLDOWN") setStep("reset");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMsg({ tone: "red", text: "Password minimal 8 karakter." });
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/auth/reset", { json: { email: email.trim(), code, password } });
      router.push("/login?reset=1");
    } catch (err) {
      setMsg({ tone: "red", text: err instanceof ClientApiError ? err.message : "Gagal mengubah password." });
      setBusy(false);
    }
  }

  if (step === "email")
    return (
      <form onSubmit={request} className="space-y-4">
        <p className="text-sm text-muted">Masukkan email akun Anda. Kami akan mengirim kode 6 digit untuk mengatur ulang password.</p>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
        </Field>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" disabled={busy || !email} className="w-full">
          {busy && <Spinner />} Kirim kode
        </Button>
      </form>
    );

  return (
    <form onSubmit={reset} className="space-y-4">
      <p className="text-sm text-muted">
        Kode dikirim ke <span className="font-semibold text-ink">{email}</span> (jika terdaftar).
      </p>
      <OtpInput value={code} onChange={setCode} disabled={busy} />
      <Field label="Password baru" htmlFor="password" hint="Minimal 8 karakter. Semua sesi login lain akan dikeluarkan.">
        <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" disabled={busy || code.length !== 6 || password.length < 8} className="w-full">
        {busy && <Spinner />} Simpan password baru
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="font-semibold text-cimory-blue hover:underline" onClick={() => { setStep("email"); setMsg(null); }}>
          Ganti email
        </button>
        <ResendButton email={email.trim()} purpose="RESET_PASSWORD" onMessage={setMsg} />
      </div>
    </form>
  );
}
