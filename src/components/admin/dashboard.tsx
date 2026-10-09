"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Button, Card, PageTitle } from "@/components/ui";
import { EventStatusChip, QuotaBar, Stat, Td, Th, useToast } from "./kit";

type Cat = { id: string; name: string; quota: number; claimed: number; remaining: number; checked_in: number; cancelled: number; queue: number; is_closed: boolean };
type Data = {
  generatedAt: string;
  totals: { quota: number; claimed: number; checkedIn: number; queue: number; emailBacklog: number; emailFailed: number; conflicts: number; mismatches: number };
  events: { id: string; name: string; start_at: string; timezone: string; status: string; categories: Cat[] }[];
  emailFailed: { id: string; holder_name: string; email: string; event_name: string; issued_at: string }[];
  conflicts: { id: string; ticket_id: string; gate: string; scanned_at: string; reason: string | null; holder_name: string | null; event_name: string; staff_name: string | null; checked_in_at: string | null; checked_in_gate: string | null }[];
  mismatches: { category_id: string; name: string; event_name: string; claimed: number; actual: number }[];
};

export function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      setData(await api<Data>("/api/admin/dashboard"));
      setError(null);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Gagal memuat dashboard.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function resend(id: string) {
    try {
      await api(`/api/admin/tickets/${id}`, { json: { action: "resend" } });
      toast({ tone: "ok", text: "Email diantrekan ulang." });
      load();
    } catch (e) {
      toast({ tone: "err", text: (e as Error).message });
    }
  }

  async function resolve(id: string) {
    try {
      await api(`/api/admin/checkins/${id}`, { method: "POST" });
      toast({ tone: "ok", text: "Konflik ditandai sudah ditinjau." });
      load();
    } catch (e) {
      toast({ tone: "err", text: (e as Error).message });
    }
  }

  if (!data)
    return (
      <div>
        <PageTitle title="Dashboard" />
        {error ? <Alert tone="red">{error}</Alert> : <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>}
      </div>
    );

  const t = data.totals;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard"
        subtitle={<>Diperbarui otomatis tiap 10 detik · terakhir {fmtDateTime(data.generatedAt)}</>}
        action={<Button variant="secondary" onClick={load}>Muat ulang</Button>}
      />
      {error && <Alert tone="amber">{error} Menampilkan data terakhir.</Alert>}

      {data.mismatches.length > 0 && (
        <Alert tone="red" title={`⚠ Rekonsiliasi kuota TIDAK cocok di ${data.mismatches.length} kategori`}>
          <ul className="mt-1 list-disc pl-5">
            {data.mismatches.map((m) => (
              <li key={m.category_id}>
                {m.event_name} / {m.name}: claimed = {m.claimed}, tiket aktif = {m.actual}
              </li>
            ))}
          </ul>
          <p className="mt-1">Periksa audit log segera.</p>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tiket diklaim" value={`${fmtNumber(t.claimed)} / ${fmtNumber(t.quota)}`} hint={`Sisa ${fmtNumber(t.quota - t.claimed)}`} />
        <Stat label="Check-in" value={fmtNumber(t.checkedIn)} tone="green" />
        <Stat label="Antrean aktif" value={fmtNumber(t.queue)} />
        <Stat label="Rekonsiliasi" value={t.mismatches === 0 ? "✓ Cocok" : `✕ ${t.mismatches} selisih`} tone={t.mismatches === 0 ? "green" : "red"} />
        <Stat label="Backlog email" value={fmtNumber(t.emailBacklog)} tone={t.emailBacklog > 100 ? "red" : "blue"} hint="Alert bila > 100" />
        <Stat label="Email gagal" value={fmtNumber(t.emailFailed)} tone={t.emailFailed ? "red" : "green"} />
        <Stat label="Konflik check-in" value={fmtNumber(t.conflicts)} tone={t.conflicts ? "red" : "green"} hint="Belum ditinjau" />
        <Stat label="Event aktif" value={fmtNumber(data.events.length)} />
      </div>

      <section className="min-w-0 space-y-3">
        <h2 className="text-lg font-bold">Per event</h2>
        {data.events.length === 0 && <Card className="p-6 text-muted">Belum ada event yang dipublikasi.</Card>}
        {data.events.map((e) => {
          const claimed = e.categories.reduce((s, c) => s + c.claimed, 0);
          const quota = e.categories.reduce((s, c) => s + c.quota, 0);
          const checked = e.categories.reduce((s, c) => s + c.checked_in, 0);
          return (
            <Card key={e.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <Link href={`/admin/events/${e.id}`} className="font-bold text-cimory-blue hover:underline">
                    {e.name}
                  </Link>
                  <p className="text-sm text-muted">{fmtDateTime(e.start_at, e.timezone)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="tabular-nums">
                    <b>{fmtNumber(claimed)}</b>/{fmtNumber(quota)} diklaim · <b>{fmtNumber(checked)}</b> check-in
                  </span>
                  <EventStatusChip status={e.status} />
                  <Link className="font-semibold text-cimory-blue hover:underline" href={`/admin/events/${e.id}/peserta`}>
                    Peserta →
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <Th>Kategori</Th>
                      <Th className="w-1/3">Klaim / kuota</Th>
                      <Th>Sisa</Th>
                      <Th>Check-in</Th>
                      <Th>Batal</Th>
                      <Th>Antrean</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.categories.map((c) => (
                      <tr key={c.id}>
                        <Td>
                          {c.name}
                          {c.is_closed && <span className="ml-2 text-xs text-muted">(ditutup)</span>}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <QuotaBar claimed={c.claimed} quota={c.quota} />
                            <span className="whitespace-nowrap tabular-nums text-xs">
                              {fmtNumber(c.claimed)}/{fmtNumber(c.quota)}
                            </span>
                          </div>
                        </Td>
                        <Td className={c.quota && c.remaining / c.quota < 0.1 ? "font-bold text-cimory-red-dark" : ""}>
                          {fmtNumber(c.remaining)}
                          {c.quota && c.remaining / c.quota < 0.1 ? (c.remaining === 0 ? " · Habis" : " · Hampir habis") : ""}
                        </Td>
                        <Td>{fmtNumber(c.checked_in)}</Td>
                        <Td>{fmtNumber(c.cancelled)}</Td>
                        <Td>{fmtNumber(c.queue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold">Konflik check-in (offline)</h2>
          {data.conflicts.length === 0 ? (
            <Card className="p-5 text-sm text-muted">✓ Tidak ada konflik yang perlu ditinjau.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <Th>Tiket</Th>
                    <Th>Scan kedua</Th>
                    <Th>Check-in sah</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.conflicts.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <p className="font-semibold">{c.holder_name ?? "—"}</p>
                        <p className="text-xs text-muted">{c.event_name}</p>
                      </Td>
                      <Td>
                        {fmtDateTime(c.scanned_at)}
                        <p className="text-xs text-muted">
                          {c.gate} · {c.staff_name ?? "—"}
                        </p>
                      </Td>
                      <Td>
                        {c.checked_in_at ? fmtDateTime(c.checked_in_at) : "—"}
                        <p className="text-xs text-muted">{c.checked_in_gate}</p>
                      </Td>
                      <Td>
                        <Button variant="secondary" className="whitespace-nowrap px-3 py-1.5 text-sm" onClick={() => resolve(c.id)}>
                          Tandai ditinjau
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold">Email tiket gagal terkirim</h2>
          {data.emailFailed.length === 0 ? (
            <Card className="p-5 text-sm text-muted">✓ Semua email tiket terkirim.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <Th>Pemegang</Th>
                    <Th>Event</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.emailFailed.map((f) => (
                    <tr key={f.id}>
                      <Td>
                        <p className="font-semibold">{f.holder_name}</p>
                        <p className="text-xs text-muted">{f.email}</p>
                      </Td>
                      <Td>{f.event_name}</Td>
                      <Td>
                        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => resend(f.id)}>
                          Kirim ulang
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      </div>
      {toastNode}
    </div>
  );
}
