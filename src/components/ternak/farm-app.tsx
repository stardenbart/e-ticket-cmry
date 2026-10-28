"use client";

// Pintu masuk kandang: beri nama sapi + baca panduan, lalu tampilkan kandang.
import { useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import type { FarmView } from "@/lib/ternak/service";
import { Farm, FarmKeyframes } from "./farm";
import { GuideContent } from "./guide";

type Catalog = Parameters<typeof Farm>[0]["catalog"];

export function FarmApp({ initial, catalog, ended, notStarted }: { initial: FarmView; catalog: Catalog; ended: boolean; notStarted: boolean }) {
  const [farm, setFarm] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (farm.name) return <Farm initial={farm} catalog={catalog} ended={ended} notStarted={notStarted} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ farm: FarmView }>("/api/ternak", { method: "POST", json: { name } });
      setFarm(r.farm);
    } catch (x) {
      setErr(x instanceof ClientApiError ? x.message : "Gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-ff className="space-y-4 text-white">
      <section className="relative overflow-hidden rounded-[18px] border border-[#ff2e9f]/40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(157,77,255,.35),transparent_60%),#0b0428] p-5 text-center shadow-[0_0_28px_rgba(255,46,159,.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/ternak/sapi-pedet-sehat.webp" alt="Pedet baru" className="mx-auto h-40 w-auto" style={{ animation: "ffHop 1.2s ease-in-out infinite" }} />
        <h2 className="mv-title mt-2 text-2xl">Pedet barumu sudah datang!</h2>
        <p className="mt-1 text-sm text-[#dbe4ff]">Beri nama dulu, lalu rawat dia dengan Moo-coins dari games.</p>
        {ended ? (
          <p className="mt-4 font-semibold text-amber-200">Periode games sudah berakhir.</p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-4 flex max-w-sm gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              required
              placeholder="Nama sapi, mis. Moorena"
              aria-label="Nama sapi"
              className="min-w-0 flex-1 rounded-full border border-white/20 bg-[#07031a] px-4 py-2.5 text-white outline-none focus:border-[#19e6ff]"
            />
            <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-[#ff2e9f] px-5 font-bold shadow-[0_0_14px_rgba(255,46,159,.6)] disabled:opacity-50">
              {busy ? "…" : "Mulai"}
            </button>
          </form>
        )}
        {err && <p className="mt-2 text-sm font-semibold text-amber-300">{err}</p>}
        <p className="mt-3 text-sm">
          Saldo awal: <b>🪙 {farm.coins.toLocaleString("id-ID")}</b>
        </p>
      </section>
      <section className="rounded-xl border border-[#19e6ff]/30 bg-[#0f0730]/85 p-5">
        <h2 className="mv-title text-xl">Panduan Peternak</h2>
        <GuideContent catalog={catalog} />
      </section>
      <FarmKeyframes />
    </div>
  );
}
