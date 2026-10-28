"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateTime, utcToZonedLocal, zonedLocalToUtc } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageTitle, Spinner } from "@/components/ui";
import { Td, Th, useToast } from "./kit";

type Lock = { startAt: string | null; lockAt: string | null; locked: boolean; notStarted: boolean };
type Row = {
  rank: number;
  user_id: string;
  name: string;
  dept: string | null;
  cow: string;
  hearts: number;
  kg: number;
  stage: string;
  bestGrade: string | null;
  milkTotal: number;
  title: { name: string; emoji: string };
  sick: boolean;
};

const TZ = "Asia/Jakarta";
const toLocal = (iso: string | null) => (iso ? utcToZonedLocal(iso, TZ) : "");
const toIso = (local: string) => (local ? zonedLocalToUtc(local, TZ).toISOString() : null);

export function GamesLock() {
  const [lock, setLock] = useState<Lock | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const { toast, toastNode } = useToast();

  const apply = (l: Lock) => {
    setLock(l);
    setStart(toLocal(l.startAt));
    setEnd(toLocal(l.lockAt));
  };
  const load = () => {
    api<Lock>("/api/admin/games-lock").then(apply).catch((e) => setErr(e.message));
    api<{ rows: Row[] }>("/api/games/leaderboard")
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  };
  useEffect(load, []);

  async function save(startAt: string | null, lockAt: string | null, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      apply(await api<Lock>("/api/admin/games-lock", { method: "PUT", json: { startAt, lockAt } }));
      toast({ tone: "ok", text: msg });
      load();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save(toIso(start), toIso(end), "Periode games disimpan.");
  };
  const endNow = () => {
    if (window.confirm("Akhiri periode games sekarang? Kondisi sapi dibekukan dan leaderboard disembunyikan dari peserta.")) save(toIso(start), new Date().toISOString(), "Periode games diakhiri.");
  };

  return (
    <div className="space-y-6">
      {toastNode}
      <PageTitle
        title="Games"
        subtitle="Atur periode Grow your Cow, Grow your Country. Di luar periode, games & kandang tertutup. Setelah berakhir, kondisi sapi dibekukan dan leaderboard/pemenang hanya bisa dilihat admin."
      />
      <Card className="p-5">
        {err && (
          <Alert tone="red" className="mb-3">
            {err}
          </Alert>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-semibold">Status:</span>
          {!lock ? (
            <Spinner />
          ) : lock.locked ? (
            <Badge tone="red">Berakhir sejak {fmtDateTime(lock.lockAt!)}</Badge>
          ) : lock.notStarted ? (
            <Badge tone="amber">Belum dimulai — buka {fmtDateTime(lock.startAt!)}</Badge>
          ) : (
            <Badge tone="green">Berlangsung{lock.lockAt ? ` — berakhir ${fmtDateTime(lock.lockAt)}` : ", tanpa batas akhir"}</Badge>
          )}
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field label="Mulai (WIB)" htmlFor="g-start">
            <Input id="g-start" type="datetime-local" value={start} onChange={(x) => setStart(x.target.value)} className="w-60" />
          </Field>
          <Field label="Selesai (WIB)" htmlFor="g-end">
            <Input id="g-end" type="datetime-local" value={end} onChange={(x) => setEnd(x.target.value)} className="w-60" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy && <Spinner />} Simpan periode
          </Button>
          <Button type="button" variant="danger" className="text-lg font-bold" onClick={endNow} disabled={busy || !!lock?.locked}>
            Akhiri sekarang
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Leaderboard peternak {lock?.locked ? "(final)" : "(sementara)"}</h2>
          <a href="/games/pemenang" target="_blank" className="text-sm font-semibold text-cimory-blue hover:underline">
            Buka halaman pemenang (podium) ↗
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Peternak</Th>
                <Th>Sapi</Th>
                <Th className="text-center">Hati</Th>
                <Th className="text-right">Berat</Th>
                <Th className="text-center">Susu terbaik</Th>
                <Th className="text-right">Total susu</Th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <Td className="text-muted">Memuat…</Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td className="text-muted">Belum ada peternak.</Td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-line">
                    <Td className="font-bold">{r.rank}</Td>
                    <Td>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-muted">
                        {r.title.emoji} {r.title.name}
                        {r.dept ? ` · ${r.dept}` : ""}
                      </p>
                    </Td>
                    <Td>
                      {r.cow} <span className="text-xs text-muted">({r.stage}{r.sick ? ", sakit" : ""})</span>
                    </Td>
                    <Td className="text-center text-cimory-red">{"♥".repeat(r.hearts)}</Td>
                    <Td className="text-right tabular-nums">{r.kg.toLocaleString("id-ID")} kg</Td>
                    <Td className="text-center">{r.bestGrade ?? "–"}</Td>
                    <Td className="text-right tabular-nums">{(r.milkTotal / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} L</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
