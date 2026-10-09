"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, ButtonLink, Card, Spinner, cx } from "@/components/ui";
import type { AltCategory } from "@/lib/site/category-context";
import { AltCategories } from "@/components/site/alt-categories";
import { useServerNow } from "@/components/site/use-server-now";
import { MvImg } from "@/components/site/ornaments";

type Summary = {
  eventName: string;
  categoryName: string;
  categoryDescription: string;
  categoryColor: string;
  date: string;
  venue: string;
  banner: string | null;
  holderName: string;
  idType: string;
  idLast4: string;
  email: string;
  termsHtml: string;
};

type Stored = { token: string; expiresAt: number; serverNow: number };
type Result = { code: string; message: string; ticketId?: string };

const FAIL_TITLE: Record<string, string> = {
  SOLD_OUT: "Kuota habis",
  CLOSED: "Pemesanan ditutup",
  ALREADY_HAS_TICKET: "Anda sudah punya tiket",
  IDENTITY_ALREADY_USED: "Identitas sudah dipakai",
  PROFILE_INCOMPLETE: "Profil belum lengkap",
  ADMISSION_EXPIRED: "Waktu klaim habis",
  ADMISSION_USED: "Token antrean sudah dipakai",
  INVALID_ADMISSION: "Token antrean tidak valid",
};

export function ConfirmClaim({ categoryId, slug, heldTicketId, summary, alternatives }: { categoryId: string; slug: string; heldTicketId: string | null; summary: Summary; alternatives: AltCategory[] }) {
  const [adm, setAdm] = useState<Stored | null | undefined>(undefined);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const idemKey = useRef<string | null>(null);
  const now = useServerNow(1000);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`adm:${categoryId}`);
      setAdm(raw ? (JSON.parse(raw) as Stored) : null);
      // Kunci idempotensi dibuat sekali per token & dipakai ulang untuk retry.
      const k = `idem:${categoryId}`;
      let key = sessionStorage.getItem(k);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(k, key);
      }
      idemKey.current = key;
    } catch {
      setAdm(null);
      idemKey.current = crypto.randomUUID();
    }
  }, [categoryId]);

  async function claim() {
    if (!adm || !agree || busy) return;
    setBusy(true);
    setNetError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId, admissionToken: adm.token, idempotencyKey: idemKey.current, agree: true }),
      });
      const data = await res.json().catch(() => ({}));
      const r: Result = data.error ? { code: data.error.code, message: data.error.message } : data;
      if (res.status >= 500) {
        setNetError(r.message ?? "Server sedang sibuk. Coba tekan Klaim Tiket lagi — permintaan Anda aman diulang.");
        setBusy(false);
        return;
      }
      setResult(r);
      if (r.code !== "IN_PROGRESS") {
        try {
          sessionStorage.removeItem(`adm:${categoryId}`);
          sessionStorage.removeItem(`idem:${categoryId}`);
        } catch {}
      }
    } catch {
      // Jaringan putus: aman diulang dengan kunci idempotensi yang sama.
      setNetError("Koneksi terputus. Tekan Klaim Tiket lagi — tiket tidak akan terbit dua kali.");
    }
    setBusy(false);
  }

  if (result?.code === "SUCCESS" && result.ticketId) return <Success ticketId={result.ticketId} summary={summary} />;

  if (result)
    return (
      <Card className="animate-fade-up space-y-5 p-6">
        <div className="text-center">
          <MvImg name="cowWink" className="mx-auto h-28 w-auto" />
          <h1 className="mt-3 text-2xl font-bold">{FAIL_TITLE[result.code] ?? "Klaim gagal"}</h1>
          <p className="mt-1 text-muted">{result.message}</p>
        </div>
        {result.code === "ALREADY_HAS_TICKET" && result.ticketId ? (
          <ButtonLink href={`/tiket-saya/${result.ticketId}`} className="w-full">Lihat Tiket Saya</ButtonLink>
        ) : result.code === "PROFILE_INCOMPLETE" ? (
          <ButtonLink href={`/profil?next=/event/${slug}`} className="w-full">Lengkapi profil</ButtonLink>
        ) : result.code.startsWith("ADMISSION") || result.code === "INVALID_ADMISSION" ? (
          <ButtonLink href={`/event/${slug}`} className="w-full">Masuk antrean lagi</ButtonLink>
        ) : (
          <>
            <AltCategories slug={slug} items={alternatives} />
            <ButtonLink href={`/event/${slug}`} variant="secondary" className="w-full">Kembali ke halaman event</ButtonLink>
          </>
        )}
      </Card>
    );

  if (heldTicketId)
    return (
      <Card className="space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold">Anda sudah memegang tiket untuk event ini</h1>
        <p className="text-muted">Satu akun hanya bisa memegang satu tiket per event.</p>
        <ButtonLink href={`/tiket-saya/${heldTicketId}`} className="w-full">Lihat Tiket Saya</ButtonLink>
      </Card>
    );

  if (adm === undefined)
    return (
      <Card className="flex justify-center p-10">
        <Spinner className="size-8 text-cimory-blue" />
      </Card>
    );

  if (adm === null)
    return (
      <Card className="space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold">Giliran klaim tidak ditemukan</h1>
        <p className="text-muted">Halaman ini hanya bisa dibuka setelah giliran Anda di antrean tiba (di tab yang sama).</p>
        <ButtonLink href={`/antrean/${categoryId}`} className="w-full">Kembali ke antrean</ButtonLink>
      </Card>
    );

  const left = now == null ? null : adm.expiresAt - now;
  const expired = left != null && left <= 0;
  const mm = left != null ? Math.max(0, Math.floor(left / 60000)) : 5;
  const ss = left != null ? Math.max(0, Math.floor((left % 60000) / 1000)) : 0;
  const urgent = left != null && left < 60_000;

  return (
    <div className="space-y-4">
      <div className={cx("flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1", urgent ? "bg-red-50 ring-red-200" : "bg-blue-50 ring-blue-200")} role="timer" aria-live="off">
        <p className="text-sm font-semibold">{expired ? "Waktu klaim habis" : "Giliran Anda! Selesaikan klaim dalam"}</p>
        <p className={cx("text-2xl font-bold tabular-nums", urgent ? "text-cimory-red-dark" : "text-cimory-blue")}>
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </p>
      </div>

      <Card className="overflow-hidden">
        {summary.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={summary.banner} alt="" className="aspect-[3/1] w-full object-cover" />
        )}
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="font-hud text-xs font-bold uppercase tracking-[0.2em] text-[#22e5ff]">✦ Konfirmasi data</p>
            <h1 className="mt-1 text-2xl leading-tight sm:text-3xl">{summary.eventName}</h1>
            <p className="text-sm text-muted">
              {summary.date} · {summary.venue}
            </p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-2 font-bold">
              <span className="size-3 rounded-full" style={{ background: summary.categoryColor }} aria-hidden />
              {summary.categoryName}
              <span className="ml-auto text-sm font-bold text-cimory-blue">Gratis</span>
            </p>
            {summary.categoryDescription && <p className="mt-1 text-sm text-muted">{summary.categoryDescription}</p>}
          </div>
          <dl className="grid gap-3 rounded-xl bg-cimory-light p-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-muted">Nama di tiket</dt>
              <dd className="text-base font-bold">{summary.holderName}</dd>
            </div>
            <div>
              <dt className="text-muted">Identitas</dt>
              <dd className="font-semibold">
                {summary.idType} •••• {summary.idLast4}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Dikirim ke</dt>
              <dd className="truncate font-semibold">{summary.email}</dd>
            </div>
            <p className="text-xs text-muted sm:col-span-2">Nama diambil dari profil dan tidak bisa diubah di sini. Bawa identitas asli yang sama ke gate.</p>
          </dl>

          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-cimory-blue" />
              <span>
                Saya menyetujui Syarat &amp; Ketentuan event ini dan memahami bahwa tiket atas nama saya tidak dapat dipindahtangankan.{" "}
                <button type="button" onClick={() => setShowTerms((s) => !s)} className="font-semibold text-cimory-blue underline">
                  {showTerms ? "Sembunyikan S&K" : "Baca S&K"}
                </button>
              </span>
            </label>
            {showTerms && <div className="rich-text mt-3 max-h-60 overflow-y-auto rounded-xl border border-line p-4 text-sm" dangerouslySetInnerHTML={{ __html: summary.termsHtml || "<p>-</p>" }} />}
          </div>

          {netError && <Alert tone="amber">{netError}</Alert>}

          {expired ? (
            <ButtonLink href={`/antrean/${categoryId}`} className="w-full">Kembali ke antrean</ButtonLink>
          ) : (
            <button
              type="button"
              onClick={claim}
              disabled={!agree || busy}
              className="font-display inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(to_right_top,#ff2bd6,#7c3aed_55%,#312e81)] px-5 py-4 text-xl font-extrabold text-white shadow-[0_10px_30px_rgba(255,43,214,0.35)] ring-1 ring-[#22e5ff]/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Spinner /> : <span aria-hidden>✦</span>}
              {busy ? "Memproses klaim…" : "Klaim Tiket"}
            </button>
          )}
          {!agree && !expired && <p className="text-center text-xs text-muted">Centang persetujuan S&amp;K untuk mengaktifkan tombol.</p>}
        </div>
      </Card>
    </div>
  );
}

function Success({ ticketId, summary }: { ticketId: string; summary: Summary }) {
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setPrinted(true), reduce ? 0 : 1150);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-5 text-center">
      <div>
        <MvImg name="cowLove" alt="Maskot MOO bahagia" className="mv-float mx-auto mb-2 h-32 w-auto drop-shadow-[0_0_20px_rgba(255,43,214,0.5)]" />
        <h1 className="text-2xl leading-tight sm:text-4xl">Tiket berhasil diklaim!</h1>
        <p className="text-muted">Selamat, {summary.holderName.split(" ")[0]}. Sampai jumpa di acara!</p>
      </div>

      {/* Mesin cetak tiket */}
      <div className="relative mx-auto max-w-sm">
        <div className="relative z-10 mx-auto h-7 rounded-t-2xl border border-[#22e5ff]/60 bg-[linear-gradient(180deg,#513661,#0d0f3a)] shadow-[0_0_24px_rgba(232,28,255,0.35)]">
          <div className="absolute inset-x-6 bottom-1 h-1.5 rounded-full bg-black/40" aria-hidden />
        </div>
        <div className="relative overflow-hidden px-4 pb-2">
          <div className="mv-paper animate-print rounded-b-2xl border border-t-0 border-[#ff2bd6] bg-white shadow-xl" aria-live="polite">
            <div className="bg-cimory-gradient px-5 py-3 text-left text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">E-Ticket</p>
              <p className="truncate font-bold">{summary.eventName}</p>
            </div>
            <div className="grid place-items-center p-5">
              {printed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/tickets/${ticketId}?format=qr`} alt="QR tiket Anda" className="size-52 animate-pop rounded-lg" />
              ) : (
                <div className="skeleton size-52" aria-hidden />
              )}
            </div>
            <div className="border-t border-dashed border-line px-5 py-3 text-left text-sm">
              <p className="font-bold">{summary.holderName}</p>
              <p className="text-muted">
                {summary.categoryName} · {summary.date}
              </p>
            </div>
          </div>
        </div>
        {printed &&
          ["#22e5ff", "#ff2bd6", "#DDA6F2", "#A78BFA", "#F472B6", "#22e5ff"].map((c, i) => (
            <span key={i} className="confetti absolute top-4 size-2.5 rounded-sm" style={{ left: `${10 + i * 15}%`, background: c, animationDelay: `${i * 80}ms` }} aria-hidden />
          ))}
      </div>

      <Alert tone="green" title="QR sudah dikirim ke email Anda">
        Dikirim ke {summary.email}. Jika belum masuk dalam beberapa menit, cek folder spam/promosi. QR juga selalu tersedia di Tiket Saya.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href={`/tiket-saya/${ticketId}`}>Lihat Tiket Saya</ButtonLink>
        <a
          href={`/api/tickets/${ticketId}?format=pdf`}
          download
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#22e5ff]/50 px-5 py-3 font-semibold text-[#22e5ff] transition hover:bg-white/10 active:scale-[0.98]"
        >
          Unduh PDF
        </a>
      </div>
      <p className="text-sm text-muted">
        Bawa <b>{summary.idType} asli</b> (akhiran {summary.idLast4}) ke gate. <Link href="/faq" className="underline">Info masuk gate</Link>
      </p>
    </div>
  );
}
