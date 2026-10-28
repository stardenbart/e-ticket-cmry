"use client";

// Kandang "Grow your Cow, Grow your Country": sapi bergerak sesuai kondisi (senang berjalan-jalan, sedih
// lesu, sakit berbaring) dan bereaksi pada setiap interaksi (makan, dielus, dibersihkan, obat, panen, baju).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { useServerNow } from "@/components/site/use-server-now";
import { fmtDuration } from "@/components/games/tts";
import type { FarmView } from "@/lib/ternak/service";
import { FarmGuide } from "./guide";

type Feed = { name: string; grade: string; price: number; kg: number; emoji: string; desc: string };
type Catalog = {
  feeds: Record<string, Feed>;
  medicine: { name: string; price: number; emoji: string; desc: string };
  outfits: Record<string, { name: string; price: number; aff: number; emoji: string }>;
  milk: readonly { ml: number; grade: string; price: number }[];
  schedule: string[];
};
type Fx = { kind: "eat" | "pet" | "clean" | "medicine" | "harvest" | "outfit"; id: number; emoji?: string; label?: string } | null;

const COIN = "🪙";

export function Farm({ initial, catalog, ended, notStarted }: { initial: FarmView; catalog: Catalog; ended: boolean; notStarted: boolean }) {
  const [farm, setFarm] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [fx, setFx] = useState<Fx>(null);
  const [guide, setGuide] = useState(false);
  const now = useServerNow(1000);
  const frozen = ended || notStarted;

  const reload = useCallback(async () => {
    try {
      const r = await api<{ farm: FarmView }>("/api/ternak");
      setFarm(r.farm);
    } catch {}
  }, []);

  // Segarkan kondisi saat jadwal berganti (makan → panen, dst.) dan tiap 60 detik.
  const boundary = farm.window?.end ?? farm.next?.start;
  useEffect(() => {
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);
  useEffect(() => {
    if (!boundary || !now) return;
    const ms = new Date(boundary).getTime() - now;
    if (ms <= 0 || ms > 6 * 3600_000) return;
    const t = setTimeout(reload, ms + 1500);
    return () => clearTimeout(t);
  }, [boundary, now, reload]);

  async function run(key: string, body: Record<string, unknown>, effect: NonNullable<Fx>["kind"], emoji?: string) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api<{ farm: FarmView; result: { note: string; spent: number; earned: number; milk?: { ml: number; grade: string; price: number } } }>("/api/ternak/action", {
        method: "POST",
        json: body,
      });
      setFx({ kind: effect, id: Date.now(), emoji, label: r.result.milk ? `${r.result.milk.ml} ml · Grade ${r.result.milk.grade}` : undefined });
      setFarm(r.farm);
      const delta = r.result.earned ? ` (+${r.result.earned} koin)` : r.result.spent ? ` (−${r.result.spent} koin)` : "";
      setMsg({ tone: "ok", text: `${r.result.note}${delta}` });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof ClientApiError ? e.message : "Gagal. Periksa koneksi lalu coba lagi." });
      if (e instanceof ClientApiError) reload();
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.kind === "harvest" ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [fx]);

  const win = farm.window;
  const feeding = win?.kind === "feed";
  const harvesting = win?.kind === "harvest";
  const left = (iso: string | undefined) => (iso && now ? fmtDuration(Math.max(0, new Date(iso).getTime() - now)) : "–");
  const status = [
    farm.sick && { t: "Sakit", c: "border-red-400/70 text-red-300" },
    !farm.sick && farm.mood === "sedih" && feeding && !farm.fedNow && { t: "Lapar", c: "border-amber-300/70 text-amber-200" },
    farm.dirt >= 2 && { t: "Kandang kotor", c: "border-amber-300/70 text-amber-200" },
    !farm.sick && farm.mood === "senang" && { t: "Sehat & bahagia", c: "border-green-400/70 text-green-300" },
  ].filter(Boolean) as { t: string; c: string }[];

  return (
    <div data-ff className="space-y-4 text-white">
      {/* Dompet + gelar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 px-4 py-3">
        <div>
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Moo-coins</p>
          <p className="font-digits text-2xl font-black tabular-nums">
            {COIN} {farm.coins.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Gelar peternak</p>
          <p className="font-bold">
            {farm.title.emoji} {farm.title.name}
          </p>
        </div>
      </div>

      {/* Panggung sapi */}
      <section className="relative overflow-hidden rounded-[18px] border border-[#ff2e9f]/40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(157,77,255,.35),transparent_60%),linear-gradient(#0b0428,#120840_60%,#0a2a2a)] shadow-[0_0_28px_rgba(255,46,159,.35)]">
        <div className="flex items-start justify-between p-4">
          <div>
            <h2 className="mv-title text-2xl">{farm.name}</h2>
            <p className="text-sm text-[#dbe4ff]">
              {farm.stage} · <b className="font-digits text-white">{farm.kg.toLocaleString("id-ID")} kg</b>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl tracking-[2px]" aria-label={`${farm.hearts} dari 5 hati`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < farm.hearts ? "text-[#ff2e9f] drop-shadow-[0_0_6px_#ff2e9f]" : "text-white/25"}>
                  ♥
                </span>
              ))}
            </p>
            <p className="text-xs text-white/60">Afeksi {farm.affection}/100</p>
          </div>
        </div>

        <div className="relative mx-auto h-[250px] w-full max-w-[460px] sm:h-[290px]">
          {/* padang rumput neon */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(transparent,rgba(25,230,255,.15))]" />
          <div aria-hidden className="absolute inset-x-6 bottom-6 h-[2px] bg-[#19e6ff] shadow-[0_0_12px_#19e6ff]" />
          {/* kotoran */}
          <div className="absolute bottom-4 left-4 flex gap-1 text-2xl" aria-label={`${farm.dirt} tumpukan kotoran`}>
            {Array.from({ length: farm.dirt }, (_, i) => (
              <span key={i} className={fx?.kind === "clean" ? "animate-[ffPoof_.6s_forwards]" : "animate-[ffStink_2s_ease-in-out_infinite]"} style={{ animationDelay: `${i * 0.3}s` }}>
                💩
              </span>
            ))}
          </div>
          <Cow farm={farm} fx={fx} />
          <FxLayer fx={fx} />
        </div>

        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {status.map((s) => (
            <span key={s.t} className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.c}`}>
              {s.t}
            </span>
          ))}
          {farm.wear && (
            <span className="rounded-full border border-[#9d4dff]/70 px-3 py-1 text-xs font-semibold text-[#d9c2ff]">
              {catalog.outfits[farm.wear].emoji} {catalog.outfits[farm.wear].name}
            </span>
          )}
        </div>
      </section>

      {frozen && (
        <p className="rounded-xl border border-amber-300/60 bg-[#0f0730]/90 p-3 text-sm font-semibold text-amber-200">
          {ended ? "Periode games sudah berakhir — kondisi sapi dibekukan untuk penentuan pemenang." : "Peternakan belum dibuka. Sapi mulai dipelihara saat periode games dimulai."}
        </p>
      )}

      {/* Jadwal */}
      <div className="rounded-xl border border-white/10 bg-[#0f0730]/80 px-4 py-3 text-sm">
        {win ? (
          <p>
            <b className="text-[#19e6ff]">{win.kind === "feed" ? (win.slot === 1 ? "Makan siang" : "Makan sore") : "Panen susu"}</b> sedang berlangsung · sisa{" "}
            <b className="font-digits tabular-nums">{left(win.end)}</b>
          </p>
        ) : (
          <p>
            Berikutnya: <b className="text-[#19e6ff]">{farm.next?.label}</b> dalam <b className="font-digits tabular-nums">{left(farm.next?.start)}</b>
          </p>
        )}
        <p className="mt-1 text-xs text-white/60">{catalog.schedule.join(" · ")} WIB</p>
      </div>

      {msg && (
        <p role="status" className={`rounded-xl px-4 py-2 text-sm font-semibold ${msg.tone === "ok" ? "bg-green-500/15 text-green-200" : "bg-red-500/15 text-red-200"}`}>
          {msg.text}
        </p>
      )}

      {/* Aksi */}
      <section className="rounded-xl border border-[#19e6ff]/30 bg-[#0f0730]/85 p-4">
        <h3 className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Beri makan</h3>
        <p className="mt-1 text-xs text-white/60">
          {farm.sick ? "Sapi sakit tidak mau makan — obati dulu." : feeding ? (farm.fedNow ? "Sudah makan di jadwal ini. 👍" : "Pilih pakan untuk jadwal ini.") : "Hanya saat jadwal makan siang & sore."}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Object.entries(catalog.feeds).map(([k, f]) => {
            const can = !frozen && feeding && !farm.fedNow && !farm.sick && farm.coins >= f.price;
            return (
              <button
                key={k}
                type="button"
                disabled={!can || !!busy}
                onClick={() => run(`feed:${k}`, { type: "feed", feed: k }, "eat", f.emoji)}
                className="rounded-xl border border-white/15 bg-[#07031a] p-3 text-left transition enabled:hover:border-[#ff2e9f]/70 disabled:opacity-45"
              >
                <p className="font-bold">
                  {f.emoji} {f.name}
                </p>
                <p className="text-xs text-[#19e6ff]">
                  {f.grade} · +{f.kg} kg · {COIN} {f.price}
                </p>
                <p className="mt-1 text-xs text-white/60">{f.desc}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActBtn label="Bersihkan" emoji="🧹" hint={farm.dirt ? `${farm.dirt} tumpukan` : "Sudah bersih"} disabled={frozen || !farm.dirt || !!busy} onClick={() => run("clean", { type: "clean" }, "clean")} />
          <ActBtn label="Elus" emoji="🤚" hint={farm.petToday ? "Besok lagi" : "+1 afeksi/hari"} disabled={frozen || farm.petToday || !!busy} onClick={() => run("pet", { type: "pet" }, "pet")} />
          <ActBtn
            label={catalog.medicine.name}
            emoji={catalog.medicine.emoji}
            hint={farm.sick ? `${COIN} ${catalog.medicine.price}` : "Untuk sapi sakit"}
            disabled={frozen || !farm.sick || farm.coins < catalog.medicine.price || !!busy}
            onClick={() => run("medicine", { type: "medicine" }, "medicine")}
            danger={farm.sick}
          />
          <ActBtn
            label="Panen susu"
            emoji="🥛"
            hint={farm.harvestedToday ? "Sudah dipanen" : harvesting ? "Sekarang!" : "19.00–23.59"}
            disabled={frozen || !harvesting || farm.harvestedToday || farm.sick || !!busy}
            onClick={() => run("harvest", { type: "harvest" }, "harvest")}
          />
        </div>
      </section>

      {/* Toko baju */}
      <section className="rounded-xl border border-[#9d4dff]/40 bg-[#0f0730]/85 p-4">
        <h3 className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#d9c2ff]">Butik Sapi</h3>
        <p className="mt-1 text-xs text-white/60">Baju menambah afeksi sekali beli — tapi mahal. Pastikan masih ada koin untuk obat!</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Object.entries(catalog.outfits).map(([k, o]) => {
            const owned = farm.outfits.includes(k as never);
            const wearing = farm.wear === k;
            return (
              <button
                key={k}
                type="button"
                disabled={frozen || !!busy || (!owned && farm.coins < o.price)}
                onClick={() =>
                  owned
                    ? run(`wear:${k}`, { type: "wear", outfit: wearing ? null : k }, "outfit", o.emoji)
                    : confirm(`Beli ${o.name} seharga ${o.price} koin?`) && run(`buy:${k}`, { type: "buyOutfit", outfit: k }, "outfit", o.emoji)
                }
                className={`rounded-xl border p-3 text-left transition disabled:opacity-45 ${wearing ? "border-[#ff2e9f] bg-[#ff2e9f]/10" : "border-white/15 bg-[#07031a] enabled:hover:border-[#9d4dff]"}`}
              >
                <p className="font-bold">
                  {o.emoji} {o.name}
                </p>
                <p className="text-xs text-[#d9c2ff]">{owned ? (wearing ? "Sedang dipakai · ketuk untuk lepas" : "Dimiliki · ketuk untuk pakai") : `${COIN} ${o.price.toLocaleString("id-ID")} · +${o.aff} afeksi`}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Catatan */}
      <section className="rounded-xl border border-white/10 bg-[#0f0730]/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Catatan kandang</h3>
          <button type="button" onClick={() => setGuide(true)} className="text-sm font-semibold text-[#19e6ff] underline">
            Panduan
          </button>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {farm.log.length === 0 && <li className="text-white/50">Belum ada catatan.</li>}
          {farm.log.map((l, i) => (
            <li key={i} className={l.tone === "bad" ? "text-red-200" : l.tone === "good" ? "text-[#dbe4ff]" : "text-white/70"}>
              <span className="mr-2 text-xs text-white/40">{new Date(l.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              {l.text}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          Butuh koin? <Link href="/games" className="font-semibold text-[#19e6ff] underline">Main games</Link> — poinmu jadi Moo-coins.
        </p>
      </section>

      {guide && <FarmGuide catalog={catalog} onClose={() => setGuide(false)} />}
      <FarmKeyframes />
    </div>
  );
}

function ActBtn({ label, emoji, hint, disabled, onClick, danger }: { label: string; emoji: string; hint: string; disabled: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-3 text-center transition disabled:opacity-45 ${danger ? "border-red-400/70 bg-red-500/10 enabled:animate-pulse" : "border-white/15 bg-[#07031a] enabled:hover:border-[#19e6ff]"}`}
    >
      <span className="block text-2xl">{emoji}</span>
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-[11px] text-white/60">{hint}</span>
    </button>
  );
}

/** Sapi + gelembung emoji. Gerak dasar mengikuti kondisi; interaksi memicu animasi singkat. */
export function Cow({ farm, fx, size = "lg" }: { farm: Pick<FarmView, "sprite" | "mood" | "emoji" | "wear" | "name">; fx?: Fx; size?: "lg" | "sm" }) {
  const base = farm.mood === "senang" ? "ffWander 9s ease-in-out infinite" : farm.mood === "sedih" ? "ffSway 3.6s ease-in-out infinite" : "ffSick 4s ease-in-out infinite";
  const react = fx?.kind === "eat" ? "ffMunch .25s ease-in-out 6" : fx?.kind === "pet" ? "ffHop .45s ease-out 2" : fx?.kind === "medicine" ? "ffHeal 1.4s ease-out" : fx?.kind === "outfit" ? "ffSpin .9s ease-in-out" : fx?.kind === "harvest" ? "ffHop .45s ease-out" : fx?.kind === "clean" ? "ffShake .5s ease-in-out 2" : "";
  const bubble = fx?.kind === "eat" ? "😋" : fx?.kind === "pet" ? "🥰" : fx?.kind === "clean" ? "✨" : fx?.kind === "medicine" ? "😌" : fx?.kind === "harvest" ? "🥛" : fx?.kind === "outfit" ? "😎" : farm.emoji;
  const outfit = farm.wear ? { bandana: "🎀", bomber: "🧥", jubah: "👑" }[farm.wear] : null;
  const h = size === "lg" ? "h-[200px] sm:h-[235px]" : "h-[110px]";
  return (
    <div className="absolute inset-x-0 bottom-5 flex justify-center" style={{ animation: fx ? undefined : base }}>
      <div className="relative" style={{ animation: react || undefined }}>
        <div className="origin-bottom" style={{ transform: `scale(${farm.sprite.scale})`, animation: farm.mood === "sakit" ? undefined : "ffBreathe 3s ease-in-out infinite" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={farm.sprite.src} alt={`Sapi ${farm.name ?? ""} (${farm.mood})`} className={`${h} w-auto select-none drop-shadow-[0_8px_14px_rgba(0,0,0,.55)] ${farm.mood === "sakit" ? "brightness-90 saturate-75" : ""}`} draggable={false} />
        </div>
        {outfit && <span className={`absolute ${size === "lg" ? "left-[38%] top-[2%] text-4xl" : "left-[38%] top-0 text-xl"} drop-shadow-[0_0_8px_rgba(255,46,159,.8)]`}>{outfit}</span>}
        <span
          key={bubble + (fx?.id ?? "")}
          className={`absolute -top-2 right-0 grid place-items-center rounded-full border border-white/30 bg-white/90 shadow-lg ${size === "lg" ? "size-12 text-2xl" : "size-8 text-base"}`}
          style={{ animation: farm.mood === "sakit" && !fx ? "ffFloat 2.4s ease-in-out infinite" : "ffPop .4s ease-out" }}
          aria-hidden
        >
          {bubble}
        </span>
      </div>
    </div>
  );
}

function FxLayer({ fx }: { fx: Fx }) {
  if (!fx) return null;
  const parts = (emoji: string, n: number, anim: string) =>
    Array.from({ length: n }, (_, i) => (
      <span key={`${fx.id}-${i}`} className="absolute text-2xl" style={{ left: `${30 + ((i * 37) % 40)}%`, bottom: "40%", animation: `${anim} 1.4s ease-out ${i * 0.12}s both` }}>
        {emoji}
      </span>
    ));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {fx.kind === "eat" && (
        <span className="absolute text-4xl" style={{ left: "10%", bottom: "20%", animation: "ffToss .7s ease-in forwards" }}>
          {fx.emoji}
        </span>
      )}
      {fx.kind === "pet" && parts("💕", 6, "ffRise")}
      {fx.kind === "clean" && parts("✨", 7, "ffRise")}
      {fx.kind === "medicine" && parts("💚", 5, "ffRise")}
      {fx.kind === "outfit" && parts("🎉", 8, "ffBurst")}
      {fx.kind === "harvest" && (
        <div className="absolute inset-x-0 top-6 flex flex-col items-center" style={{ animation: "ffMilk 2.4s ease-out both" }}>
          <span className="text-5xl drop-shadow-[0_0_14px_#fff]">🥛</span>
          <span className="mt-1 rounded-full bg-white px-3 py-1 text-sm font-black text-[#12082b]">{fx.label}</span>
        </div>
      )}
    </div>
  );
}

export function FarmKeyframes() {
  return (
    <style>{`
      @keyframes ffBreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.025)}}
      @keyframes ffWander{0%,100%{transform:translateX(-14%)}45%{transform:translateX(14%)}50%{transform:translateX(14%) scaleX(-1)}95%{transform:translateX(-14%) scaleX(-1)}}
      @keyframes ffSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) translateY(2px)}}
      @keyframes ffSick{0%,100%{transform:translateY(0);opacity:.9}50%{transform:translateY(3px);opacity:.75}}
      @keyframes ffMunch{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(4px) rotate(2deg)}}
      @keyframes ffHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-26px)}}
      @keyframes ffShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      @keyframes ffSpin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}
      @keyframes ffHeal{0%{filter:drop-shadow(0 0 0 #12c98a)}50%{filter:drop-shadow(0 0 22px #12c98a)}100%{filter:drop-shadow(0 0 0 #12c98a)}}
      @keyframes ffPop{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
      @keyframes ffFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes ffRise{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:1}100%{transform:translateY(-120px) scale(1.2);opacity:0}}
      @keyframes ffBurst{0%{transform:translate(0,0) scale(.4);opacity:0}30%{opacity:1}100%{transform:translate(var(--x,0),-140px) rotate(200deg);opacity:0}}
      @keyframes ffToss{0%{transform:translate(0,0) scale(1)}60%{transform:translate(120px,-60px) scale(.9)}100%{transform:translate(160px,-10px) scale(.2);opacity:0}}
      @keyframes ffMilk{0%{transform:translateY(40px) scale(.5);opacity:0}20%{transform:translateY(0) scale(1.1);opacity:1}80%{opacity:1}100%{transform:translateY(-30px);opacity:0}}
      @keyframes ffStink{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes ffPoof{to{transform:scale(0) rotate(90deg);opacity:0}}
      @media (prefers-reduced-motion: reduce){[data-ff] *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
    `}</style>
  );
}
