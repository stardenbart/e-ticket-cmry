"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { OtpInput } from "@/components/site/otp-input";
import { ResendButton } from "@/components/site/resend-button";

export function VerifyForm({ initialEmail, next }: { initialEmail: string; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "blue" | "red"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  async function verify(value = code) {
    if (value.length !== 6 || !email) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/auth/verify-email", { json: { email, code: value } });
      setDone(true);
      router.push(`/profil?next=${encodeURIComponent(next)}&baru=1`);
      router.refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof ClientApiError ? e.message : "Verifikasi gagal." });
      setCode("");
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid size-16 animate-pop place-items-center rounded-full bg-green-50 text-3xl text-ok ring-1 ring-green-200" aria-hidden>✓</span>
        <p className="font-semibold">Email terverifikasi! Mengarahkan ke profil…</p>
      </div>
    );

  return (
    <div className="space-y-5">
      {!initialEmail && (
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} />
        </Field>
      )}
      <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} invalid={msg?.tone === "red"} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button onClick={() => verify()} disabled={busy || code.length !== 6 || !email} className="w-full">
        {busy && <Spinner />} Verifikasi
      </Button>
      <div className="flex flex-col items-center gap-1 text-center text-sm text-muted">
        <span>Tidak menerima email? Cek folder spam/promosi.</span>
        <ResendButton email={email} purpose="VERIFY_EMAIL" onMessage={setMsg} />
      </div>
    </div>
  );
}
