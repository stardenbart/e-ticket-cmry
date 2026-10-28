"use client";

// Kandang "Grow your Cow, Grow your Country". Layar kandang (Barn) menampilkan sapi yang bergerak sendiri
// sesuai kondisinya; setiap interaksi (beri makan, elus, bersihkan pup, obat, perah susu, baju) memicu
// reaksi sapi di kandang. Di bawahnya: statistik, pesan "yang perlu dilakukan", dan tombol aksi besar.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { useServerNow } from "@/components/site/use-server-now";
import { fmtDuration } from "@/components/games/tts";
import type { FarmView } from "@/lib/ternak/service";
import { Barn, type BarnHandle, type StageKey } from "./barn";
import { FarmGuide } from "./guide";

type Feed = { name: string; grade: string; price: number; kg: number; emoji: string; desc: string };
type Catalog = {
  feeds: Record<string, Feed>;
  medicine: { name: string; price: number; emoji: string; desc: string };
  outfits: Record<string, { name: string; price: number; aff: number; emoji: string }>;
  milk: readonly { ml: number; grade: string; price: number }[];
  schedule: string[];
  maxKg: number;
  maxStock: number;
};
type Milk = { ml: number; grade: string; price: number };
type Result = { note: string; spent: number; earned: number; milk?: Milk };

const COIN = "🪙";
const MILK_TAPS = 5;
const OUTFIT_EMOJI: Record<string, string> = { bandana: "🎀", bomber: "🧥", jubah: "👑" };
const NEXT_STAGE: Record<Exclude<StageKey, "dewasa">, { kg: number; label: string }> = { pedet: { kg: 150, label: "Remaja" }, remaja: { kg: 300, label: "Dewasa" } };
const STAGE_FROM: Record<StageKey, number> = { pedet: 50, remaja: 150, dewasa: 300 };

export function Farm({ initial, catalog, ended, notStarted }: { initial: FarmView; catalog: Catalog; ended: boolean; notStarted: boolean }) {
  const [farm, setFarm] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [milking, setMilking] = useState<{ taps: number; busy: boolean } | null>(null);
  const [milkResult, setMilkResult] = useState<Milk | null>(null);
  const [scooped, setScooped] = useState<number[]>([]);
  const now = useServerNow(1000);
  const barn = useRef<BarnHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => setScooped([]), [farm.dirt]);
  useEffect(() => {
    if (!milkResult) return;
    const t = setTimeout(() => setMilkResult(null), 4200);
    return () => clearTimeout(t);
  }, [milkResult]);

  const showStage = () => {
    const st = stageRef.current?.getBoundingClientRect();
    if (st && (st.top < 70 || st.bottom > window.innerHeight)) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const say = (text: string, tone: "ok" | "warn" | "bad" | "info" = "warn") => {
    showStage();
    barn.current?.toast(text, tone);
  };

  async function run(key: string, body: Record<string, unknown>): Promise<Result | null> {
    setBusy(key);
    try {
      const r = await api<{ farm: FarmView; result: Result }>("/api/ternak/action", { method: "POST", json: body });
      showStage();
      setFarm(r.farm);
      return r.result;
    } catch (e) {
      say(e instanceof ClientApiError ? e.message : "Gagal. Periksa koneksi lalu coba lagi.", "bad");
      if (e instanceof ClientApiError) reload();
      return null;
    } finally {
      setBusy(null);
    }
  }

  const win = farm.window;
  const feeding = win?.kind === "feed";
  const harvesting = win?.kind === "harvest";
  const left = (iso: string | undefined) => (iso && now ? fmtDuration(Math.max(0, new Date(iso).getTime() - now)) : "–");
  const winLabel = win ? (win.kind === "feed" ? (win.slot === 1 ? "Makan siang" : "Makan sore") : "Perah susu") : "";

  // ---- aksi ----
  const lockedMsg = ended ? "Periode games sudah berakhir — sapi dibekukan." : "Peternakan belum dibuka.";
  const blockFeed = frozen ? lockedMsg : farm.sick ? `Sapi sakit tidak mau makan. Beri ${catalog.medicine.name} dulu.` : !feeding ? `Belum jadwal makan. ${catalog.schedule.slice(0, 2).join(" · ")} WIB.` : farm.fedNow ? "Sapi sudah makan di jadwal ini. 👍" : null;
  const blockMilk = frozen ? lockedMsg : farm.sick ? "Sapi sakit tidak menghasilkan susu. Obati dulu." : farm.harvestedToday ? "Susu hari ini sudah diperah. Besok lagi ya!" : !harvesting ? `Perah susu hanya pukul 19.00–23.59 WIB.` : null;
  const blockClean = frozen ? lockedMsg : !farm.dirt ? "Kandang sudah bersih. ✨" : null;
  const blockMed = frozen ? lockedMsg : !farm.sick ? "Sapi sehat, tidak perlu obat." : farm.coins < catalog.medicine.price ? `Moo-coins kurang — butuh ${catalog.medicine.price}. Main games dulu!` : null;

  async function feed(k: string) {
    const f = catalog.feeds[k];
    if (blockFeed) return say(blockFeed);
    const stock = farm.inv[k as keyof typeof farm.inv];
    if (!stock && farm.coins < f.price) return say(`Stok ${f.name} habis dan Moo-coins kurang (${f.price}). Main games dulu!`);
    setFeedOpen(false);
    const kg0 = farm.kg;
    const r = await run(`feed:${k}`, { type: "feed", feed: k });
    if (r) {
      const gain = Math.round(Math.min(f.kg, catalog.maxKg - kg0) * 10) / 10;
      barn.current?.feed(f.emoji, gain ? `+${gain} kg` : "Berat maksimal!");
      if (r.spent) barn.current?.float(`−${r.spent} ${COIN}`, "coin");
    }
  }
  async function buyFeed(k: string, qty: number) {
    const f = catalog.feeds[k];
    if (frozen) return say(lockedMsg);
    if (farm.coins < f.price * qty) return say(`Moo-coins kurang — ${qty}× ${f.name} = ${(f.price * qty).toLocaleString("id-ID")}.`);
    const r = await run(`buy:${k}:${qty}`, { type: "buyFeed", feed: k, qty });
    if (r) barn.current?.toast(`🛒 ${qty}× ${f.emoji} ${f.name} masuk lumbung`, "ok");
  }
  async function clean() {
    if (blockClean) return say(blockClean, blockClean.startsWith("Kandang") ? "ok" : "warn");
    setScooped([0, 1, 2]);
    barn.current?.sweep();
    if (!(await run("clean", { type: "clean" }))) setScooped([]);
  }
  async function scoop(i: number) {
    if (frozen) return say(lockedMsg);
    const next = [...scooped, i];
    setScooped(next);
    if (next.length < farm.dirt) return barn.current?.float("Bersih!", "gain");
    barn.current?.float("+2 afeksi", "heart");
    if (!(await run("clean", { type: "clean" }))) setScooped([]);
  }
  async function medicine() {
    if (blockMed) return say(blockMed, farm.sick ? "bad" : "ok");
    const r = await run("medicine", { type: "medicine" });
    if (r) barn.current?.heal();
  }
  async function pet() {
    const counted = !frozen && !farm.petToday;
    barn.current?.pet(counted);
    if (counted) await run("pet", { type: "pet" });
  }
  function startMilk() {
    if (blockMilk) return say(blockMilk);
    showStage();
    setMilkResult(null);
    setMilking({ taps: 0, busy: false });
  }
  async function milkTap() {
    if (!milking || milking.busy) return;
    barn.current?.squirt();
    const taps = milking.taps + 1;
    if (taps < MILK_TAPS) return setMilking({ taps, busy: false });
    setMilking({ taps, busy: true });
    const r = await run("harvest", { type: "harvest" });
    setMilking(null);
    if (r?.milk) {
      setMilkResult(r.milk);
      barn.current?.float(`+${r.milk.price} ${COIN}`, "coin");
    }
  }
  async function outfit(k: string, owned: boolean, wearing: boolean) {
    const o = catalog.outfits[k];
    if (frozen) return say(lockedMsg);
    if (!owned) {
      if (farm.coins < o.price) return say(`Moo-coins kurang — ${o.name} seharga ${o.price.toLocaleString("id-ID")}.`);
      if (!confirm(`Beli ${o.name} seharga ${o.price.toLocaleString("id-ID")} koin? (+${o.aff} afeksi)`)) return;
    }
    const r = await run(`outfit:${k}`, owned ? { type: "wear", outfit: wearing ? null : k } : { type: "buyOutfit", outfit: k });
    if (r && !wearing) barn.current?.outfit();
  }

  // ---- status & pesan ----
  const totalStock = farm.inv.asteroid + farm.inv.nebula + farm.inv.supernova;
  const badge = farm.sick
    ? { t: "Sakit", c: "bg-rose-100 text-rose-700 animate-pulse" }
    : farm.hungry
      ? { t: "Lapar", c: "bg-[#fef3c7] text-amber-800" }
      : farm.dirt >= 2
        ? { t: "Kandang kotor", c: "bg-[#fef3c7] text-amber-800" }
        : farm.mood === "sedih"
          ? { t: "Lesu", c: "bg-[#fef3c7] text-amber-800" }
          : { t: "Sehat", c: "bg-[#ffffffe6] text-emerald-700" };

  const todo: { tone: "ok" | "warn" | "bad"; text: React.ReactNode } = ended
    ? { tone: "warn", text: "Periode games sudah berakhir — kondisi sapi dibekukan untuk penentuan pemenang. Pemenang diumumkan di hari H acara!" }
    : notStarted
      ? { tone: "warn", text: "Peternakan belum dibuka. Sapi mulai dipelihara saat periode games dimulai." }
      : farm.sick
        ? { tone: "bad", text: <>Sapi sakit 🤒 — tidak mau makan & tidak menghasilkan susu. Tekan <b>Beri Obat</b> ({COIN} {catalog.medicine.price}).{farm.coins < catalog.medicine.price && " Koinmu belum cukup, main games dulu ya!"}</> }
        : feeding && !farm.fedNow
          ? { tone: "warn", text: <>Waktunya <b>{winLabel.toLowerCase()}</b>! Tekan <b>Beri Makan</b> lalu pilih pakan{totalStock ? "" : " — lumbungmu kosong, pakan akan dibeli langsung"} (sisa {left(win?.end)}).</> }
          : harvesting && !farm.harvestedToday
            ? { tone: "warn", text: <>Waktunya <b>perah susu</b>! Tekan <b>Perah Susu</b>, lalu ketuk ember {MILK_TAPS}× (sisa {left(win?.end)}).</> }
            : farm.dirt > 0
              ? { tone: "warn", text: <>Ada {farm.dirt} pup 💩 di kandang — <b>ketuk pupnya</b> atau tekan <b>Bersihkan</b> sebelum sapi sakit.</> }
              : !totalStock
                ? { tone: "warn", text: <>Lumbung pakan kosong. <b>Beli pakan</b> di Lumbung Pakan di bawah supaya siap saat jadwal makan.</> }
              : !farm.petToday
                ? { tone: "ok", text: <><b>Ketuk sapimu</b> untuk mengelus (+1 afeksi, sekali sehari).</> }
                : { tone: "ok", text: <>Semua beres! 👍 Berikutnya: <b>{farm.next?.label}</b> dalam {left(farm.next?.start)}. Sambil menunggu, kumpulkan koin dari games.</> };
  const todoTone = { ok: "bg-emerald-50 text-emerald-800 ring-emerald-200", warn: "bg-[#fffbeb] text-[#78350f] ring-[#fde68a]", bad: "bg-rose-50 text-rose-800 ring-rose-200" }[todo.tone];

  const stageKey = farm.sprite.stage.key as StageKey;
  const nx = stageKey === "dewasa" ? { kg: catalog.maxKg, label: "berat maksimal" } : NEXT_STAGE[stageKey];
  const maxed = farm.kg >= catalog.maxKg;
  const growth = Math.min(100, Math.max(0, ((farm.kg - STAGE_FROM[stageKey]) / (nx.kg - STAGE_FROM[stageKey])) * 100));
  const affColor = farm.hearts >= 4 ? "bg-rose-500" : farm.hearts >= 2 ? "bg-pink-400" : "bg-gray-400";

  return (
    <div data-ff className="space-y-4">
      {/* Dompet + gelar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 px-4 py-3 text-white">
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

      {/* ================= KANDANG ================= */}
      <section className="overflow-hidden rounded-3xl bg-[#fff] text-gray-800 shadow-xl ring-1 ring-black/5" aria-label="Kandang sapi">
        <header className="flex items-center justify-between gap-3 bg-[linear-gradient(100deg,#ff2e9f,#9d4dff_55%,#19e6ff)] px-4 py-3 text-white sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="mv-title truncate text-xl leading-tight sm:text-2xl">Kandang {farm.name}</h2>
            <p className="text-xs text-white/90 sm:text-sm">Ketuk sapi untuk mengelus · ketuk pup untuk membersihkan</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${badge.c}`} role="status">
            {badge.t}
          </span>
        </header>

        <div className="grid gap-3 p-3 sm:gap-4 sm:p-5">
          <div ref={stageRef} className="relative scroll-mt-24">
            <Barn
              ref={barn}
              name={farm.name ?? "Kandang"}
              stage={stageKey}
              scale={farm.sprite.scale}
              mood={farm.mood}
              src={farm.sprite.src}
              accessory={farm.wear ? { emoji: OUTFIT_EMOJI[farm.wear], spot: farm.wear === "bomber" ? "body" : "head" } : null}
              dirt={farm.dirt}
              scooped={scooped}
              milking={milking ? { ...milking, need: MILK_TAPS } : null}
              onPet={pet}
              onPoop={scoop}
              onMilkTap={milkTap}
            />
            {milkResult && <MilkReveal milk={milkResult} onClose={() => setMilkResult(null)} />}
          </div>

          {/* Statistik */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Tile label="Berat badan" tone="emerald">
              {farm.kg.toLocaleString("id-ID")} <span className="text-sm font-bold">kg</span>
            </Tile>
            <Tile label="Tahap" tone="sky">
              {farm.stage}
            </Tile>
            <Tile label={`Afeksi ${farm.affection}/100`} tone="rose">
              <span className="tracking-[1px]" aria-label={`${farm.hearts} dari 5 hati`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < farm.hearts ? "text-rose-500" : "text-gray-300"}>
                    ♥
                  </span>
                ))}
              </span>
            </Tile>
            <Tile label="Susu terbaik" tone="amber">
              {farm.bestMilk ? `${farm.bestMilk} ml` : "–"}
            </Tile>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Bar label="Afeksi" right={`${farm.hearts} ♥`} pct={farm.affection} color={affColor} hint="Naik: makan tepat waktu, elus, bersih, main game." />
            <Bar
              label={maxed ? "Berat maksimal tercapai! 🏆" : `Menuju ${nx.label}`}
              right={`${farm.kg.toLocaleString("id-ID")} / ${nx.kg} kg`}
              pct={growth}
              color={maxed ? "bg-amber-400" : "bg-sky-500"}
              hint={stageKey === "dewasa" ? "Sapi Dewasa: 5 ♥ + Konsentrat Supernova 2× sehari = peluang susu Grade S." : `Pakan lebih bagus = tumbuh lebih cepat. Berat maksimal ${catalog.maxKg} kg.`}
            />
          </div>

          {/* Pesan: yang perlu dilakukan sekarang */}
          <p className={`min-h-[2.75rem] rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${todoTone}`} aria-live="polite">
            {todo.text}
          </p>

          {/* Tombol aksi */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <BigBtn color="emerald" off={!!blockFeed} active={feedOpen} onClick={() => (blockFeed ? say(blockFeed) : setFeedOpen((o) => !o))} title="Beri Makan" hint={farm.fedNow ? "Sudah makan ✓" : feeding ? "Pilih pakan" : "Siang & sore"} />
            <BigBtn color="sky" off={!!blockMilk} active={!!milking} onClick={() => (milking ? setMilking(null) : startMilk())} title={milking ? "Batal Perah" : "Perah Susu"} hint={farm.harvestedToday ? "Sudah diperah ✓" : "19.00–23.59"} />
            <BigBtn color="amber" off={!!blockClean} onClick={clean} title="Bersihkan" hint={farm.dirt ? `${farm.dirt} pup 💩` : "Sudah bersih ✓"} busy={busy === "clean"} />
            <BigBtn color="rose" off={!!blockMed} onClick={medicine} title="Beri Obat" hint={`${catalog.medicine.emoji} ${COIN} ${catalog.medicine.price}`} busy={busy === "medicine"} pulse={farm.sick && !frozen} />
          </div>

          {feedOpen && !blockFeed && (
            <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <p className="mb-2 text-sm font-bold text-emerald-900">Pilih pakan untuk {winLabel.toLowerCase()}:</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(catalog.feeds).map(([k, f]) => {
                  const stock = farm.inv[k as keyof typeof farm.inv];
                  const poor = !stock && farm.coins < f.price;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => feed(k)}
                      disabled={!!busy}
                      aria-disabled={poor}
                      className={`rounded-xl bg-[#fff] p-3 text-left shadow-sm ring-1 ring-emerald-200 transition hover:ring-emerald-500 active:translate-y-px ${poor ? "opacity-50" : ""}`}
                    >
                      <p className="font-extrabold text-gray-900">
                        {f.emoji} {f.name}
                      </p>
                      <p className="text-xs font-semibold text-emerald-700">
                        {f.grade} · +{f.kg} kg
                      </p>
                      <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${stock ? "bg-emerald-600 text-[#fff]" : "bg-gray-200 text-gray-700"}`}>
                        {stock ? `Pakai stok (${stock})` : `Beli & beri · ${COIN} ${f.price}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] leading-relaxed text-gray-500">
            {win ? (
              <>
                <b className="text-gray-700">{winLabel}</b> sedang berlangsung · sisa <b className="tabular-nums">{left(win.end)}</b>
              </>
            ) : (
              <>
                Berikutnya <b className="text-gray-700">{farm.next?.label}</b> dalam <b className="tabular-nums">{left(farm.next?.start)}</b>
              </>
            )}{" "}
            · Jadwal WIB: {catalog.schedule.join(" · ")}
          </p>
        </div>
      </section>

      {/* Lumbung pakan */}
      <section className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/85 p-4 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Lumbung Pakan</h3>
          <p className="text-xs text-white/60">Beli kapan saja · maks {catalog.maxStock} per jenis</p>
        </div>
        <p className="mt-1 text-xs text-white/60">Stok dipakai otomatis saat kamu menekan Beri Makan di jadwal makan.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Object.entries(catalog.feeds).map(([k, f]) => {
            const stock = farm.inv[k as keyof typeof farm.inv];
            return (
              <div key={k} className="rounded-xl border border-white/15 bg-[#07031a] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">
                    {f.emoji} {f.name}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${stock ? "bg-[#19e6ff]/20 text-[#19e6ff]" : "bg-white/10 text-white/60"}`}>Stok {stock}</span>
                </div>
                <p className="text-xs text-[#19e6ff]">
                  {f.grade} · +{f.kg} kg · {COIN} {f.price}/porsi
                </p>
                <p className="mt-1 text-xs text-white/60">{f.desc}</p>
                <div className="mt-2 flex gap-2">
                  {[1, 5].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={frozen || !!busy || stock + q > catalog.maxStock}
                      onClick={() => buyFeed(k, q)}
                      className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-bold transition disabled:opacity-40 ${farm.coins < f.price * q ? "border-white/15 text-white/50" : "border-[#ff2e9f]/70 text-white enabled:hover:bg-[#ff2e9f]/20"}`}
                    >
                      {busy === `buy:${k}:${q}` ? "…" : `Beli ${q} · ${COIN} ${(f.price * q).toLocaleString("id-ID")}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Butik baju */}
      <section className="rounded-xl border border-[#9d4dff]/40 bg-[#0f0730]/85 p-4 text-white">
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
                disabled={frozen || !!busy}
                onClick={() => outfit(k, owned, wearing)}
                className={`rounded-xl border p-3 text-left transition disabled:opacity-45 ${wearing ? "border-[#ff2e9f] bg-[#ff2e9f]/10" : "border-white/15 bg-[#07031a] enabled:hover:border-[#9d4dff]"} ${!owned && farm.coins < o.price ? "opacity-60" : ""}`}
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
      <section className="rounded-xl border border-white/10 bg-[#0f0730]/80 p-4 text-white">
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
          Butuh koin?{" "}
          <Link href="/games" className="font-semibold text-[#19e6ff] underline">
            Main games
          </Link>{" "}
          — poinmu jadi Moo-coins.
        </p>
      </section>

      {guide && <FarmGuide catalog={catalog} onClose={() => setGuide(false)} />}
      <FarmKeyframes />
    </div>
  );
}

const TILE = {
  emerald: "bg-emerald-50 ring-emerald-100 [&>p:first-child]:text-emerald-700 text-emerald-900",
  sky: "bg-sky-50 ring-sky-100 [&>p:first-child]:text-sky-700 text-sky-900",
  rose: "bg-rose-50 ring-rose-100 [&>p:first-child]:text-rose-700 text-rose-900",
  amber: "bg-[#fffbeb] ring-[#fef3c7] [&>p:first-child]:text-amber-700 text-[#78350f]",
};
function Tile({ label, tone, children }: { label: string; tone: keyof typeof TILE; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-2.5 ring-1 sm:p-3 ${TILE[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-xl font-extrabold sm:text-2xl">{children}</p>
    </div>
  );
}

function Bar({ label, right, pct, color, hint }: { label: string; right: string; pct: number; color: string; hint: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-gray-700">{label}</span>
        <span className="font-bold tabular-nums text-gray-700">{right}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: "width .5s ease" }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
    </div>
  );
}

const BTN = {
  emerald: "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600 [&>span]:text-emerald-100",
  sky: "bg-sky-600 hover:bg-sky-700 focus-visible:outline-sky-600 [&>span]:text-sky-100",
  amber: "bg-amber-500 hover:bg-amber-600 focus-visible:outline-amber-500 [&>span]:text-[#fffbeb]",
  rose: "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600 [&>span]:text-rose-100",
};
function BigBtn({ color, title, hint, off, active, busy, pulse, onClick }: { color: keyof typeof BTN; title: string; hint: string; off: boolean; active?: boolean; busy?: boolean; pulse?: boolean; onClick: () => void }) {
  // Tetap bisa diketuk saat tidak tersedia — ketukan memunculkan alasan di kandang.
  return (
    <button
      type="button"
      aria-disabled={off}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-base font-extrabold text-white shadow transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${BTN[color]} ${off && !active ? "opacity-50" : ""} ${active ? "ring-4 ring-black/15" : ""} ${pulse ? "animate-pulse" : ""}`}
    >
      {busy ? "…" : title}
      <span className="block text-xs font-semibold">{hint}</span>
    </button>
  );
}

function MilkReveal({ milk, onClose }: { milk: Milk; onClose: () => void }) {
  const s = milk.grade === "S";
  return (
    <button type="button" onClick={onClose} className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-black/35" aria-label="Tutup hasil perah">
      <div className={`mx-4 rounded-2xl px-6 py-4 text-center shadow-2xl ${s ? "bg-gradient-to-b from-amber-100 to-yellow-300 ring-4 ring-amber-400" : "bg-[#fff]"}`} style={{ animation: "ffMilk 4.2s ease-out both" }}>
        <p className="text-5xl">🥛</p>
        <p className="mt-1 text-2xl font-black text-gray-900">Grade {milk.grade}</p>
        <p className="text-sm font-bold text-gray-700">
          {milk.ml} ml · +{milk.price} {COIN}
        </p>
        {s && <p className="mt-1 text-sm font-black text-amber-700">✨ SUSU LANGKA! ✨</p>}
      </div>
    </button>
  );
}

export function FarmKeyframes() {
  return (
    <style>{`
      @keyframes ffHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-26px)}}
      @keyframes ffFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes ffMilk{0%{transform:translateY(30px) scale(.5);opacity:0}10%{transform:translateY(0) scale(1.08);opacity:1}15%{transform:scale(1)}88%{opacity:1}100%{opacity:0}}
      @media (prefers-reduced-motion: reduce){[data-ff] *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
    `}</style>
  );
}
