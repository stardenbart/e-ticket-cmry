"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateTime, utcToZonedLocal, zonedLocalToUtc } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageTitle, Spinner } from "@/components/ui";
import { Td, Th, useToast } from "./kit";

type Lock = { lockAt: string | null; locked: boolean };
type Row = {
  user_id: string;
  rank: number;
  name: string;
  dept: string | null;
  tts_score: number;
  tts_ms: number | null;
  moordle: number;
  moordle_days: number;
  snake: number;
  flappy: number;
  dino: number;
  race: number;
  total: number;
};

const TZ = "Asia/Jakarta";

const fmtMs = (ms: number | null) => {
  if (ms == null) return "–";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function GamesLock() {
  const [lock, setLock] = useState<Lock | null>(null);
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const { toast, toastNode } = useToast();

  const load = () => {
    api<Lock>("/api/admin/games-lock")
      .then((l) => {
        setLock(l);
        setLocal(l.lockAt ? utcToZonedLocal(l.lockAt, TZ) : "");
      })
      .catch((e) => setErr(e.message));
    api<{ rows: Row[] }>("/api/games/leaderboard")
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  };
  useEffect(load, []);

  async function save(lockAt: string | null, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      const l = await api<Lock>("/api/admin/games-lock", { method: "PUT", json: { lockAt } });
      setLock(l);
      setLocal(l.lockAt ? utcToZonedLocal(l.lockAt, TZ) : "");
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
    if (!local) return;
    save(zonedLocalToUtc(local, TZ).toISOString(), "Tenggat games disimpan.");
  };
  const lockNow = () => {
    if (window.confirm("Tutup semua games sekarang? Peserta tidak bisa bermain lagi dan leaderboard dibekukan.")) save(new Date().toISOString(), "Games ditutup.");
  };
  const unlock = () => {
    if (window.confirm("Buka kembali games tanpa tenggat?")) save(null, "Games dibuka kembali.");
  };

  return (
    <div className="space-y-6">
      {toastNode}
      <PageTitle
        title="Games"
        subtitle="Atur tenggat games. Setelah tenggat lewat, peserta tidak bisa bermain atau mengirim skor, dan leaderboard dibekukan untuk menetapkan pemenang."
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
            <Badge tone="red">Ditutup sejak {fmtDateTime(lock.lockAt!)}</Badge>
          ) : lock.lockAt ? (
            <Badge tone="amber">Dibuka — ditutup otomatis {fmtDateTime(lock.lockAt)}</Badge>
          ) : (
            <Badge tone="green">Dibuka, tanpa tenggat</Badge>
          )}
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field label="Tenggat (WIB)" htmlFor="g-lock" hint="Games otomatis ditutup pada waktu ini.">
            <Input id="g-lock" type="datetime-local" required value={local} onChange={(x) => setLocal(x.target.value)} className="w-64" />
          </Field>
          <Button type="submit" disabled={busy || !local}>
            {busy && <Spinner />} Simpan tenggat
          </Button>
          <Button type="button" variant="danger" className="text-lg font-bold" onClick={lockNow} disabled={busy || !!lock?.locked}>
            Tutup sekarang
          </Button>
          <Button type="button" variant="ghost" onClick={unlock} disabled={busy || !lock?.lockAt}>
            Hapus tenggat / buka kembali
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Leaderboard {lock?.locked ? "(final)" : "(sementara)"}</h2>
          <a href="/games#leaderboard" target="_blank" className="text-sm font-semibold text-cimory-blue hover:underline">
            Lihat di halaman peserta ↗
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Nama</Th>
                <Th className="text-right">TTS</Th>
                <Th className="text-right">Moordle</Th>
                <Th className="text-right">Ular</Th>
                <Th className="text-right">Flappy</Th>
                <Th className="text-right">Dino</Th>
                <Th className="text-right">Balap</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <Td className="text-muted">Memuat…</Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td className="text-muted">Belum ada pemain.</Td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-line">
                    <Td className="font-bold">{r.rank}</Td>
                    <Td>
                      <p className="font-semibold">{r.name}</p>
                      {r.dept && <p className="text-xs text-muted">{r.dept}</p>}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.tts_score} <span className="text-xs text-muted">({fmtMs(r.tts_ms)})</span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.moordle} <span className="text-xs text-muted">({r.moordle_days} hari)</span>
                    </Td>
                    <Td className="text-right tabular-nums">{r.snake}</Td>
                    <Td className="text-right tabular-nums">{r.flappy}</Td>
                    <Td className="text-right tabular-nums">{r.dino}</Td>
                    <Td className="text-right tabular-nums">{r.race}</Td>
                    <Td className="text-right font-black tabular-nums">{r.total}</Td>
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
