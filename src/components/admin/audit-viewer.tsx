"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Alert, Button, Card, Input, PageTitle, Select } from "@/components/ui";
import { Td, Th } from "./kit";

type Row = { id: string; actor_email: string | null; action: string; entity: string; entity_id: string | null; before: unknown; after: unknown; ip: string | null; at: string };
type Res = { rows: Row[]; total: number; page: number; pageSize: number; entities: string[] };

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return <span className="text-muted">—</span>;
  const show = (v: unknown) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
  return (
    <table className="w-full text-xs">
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <td className="pr-2 font-semibold text-muted">{k}</td>
            <td className="max-w-56 break-all pr-2 text-cimory-red-dark line-through decoration-1">{k in b ? show(b[k]) : ""}</td>
            <td className="max-w-56 break-all text-ok">{k in a ? show(a[k]) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditViewer({ superAdmin }: { superAdmin: boolean }) {
  const [f, setF] = useState({ entity: "", action: "", actor: "", entityId: "", from: "", to: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ ...applied, page: String(page) });
    try {
      setRes(await api<Res>(`/api/admin/audit?${qs}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [applied, page]);
  useEffect(() => {
    load();
  }, [load]);

  const pages = res ? Math.max(1, Math.ceil(res.total / res.pageSize)) : 1;
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <PageTitle
        title="Audit Log"
        subtitle={superAdmin ? "Log global, append-only (tidak bisa diubah atau dihapus)." : "Log aksi terkait event, kategori, tiket, staf, dan check-in. Append-only."}
      />
      {err && <Alert tone="red" className="mb-4">{err}</Alert>}
      <form
        className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(f);
        }}
      >
        <Select value={f.entity} onChange={(e) => set("entity", e.target.value)} aria-label="Entitas">
          <option value="">Semua entitas</option>
          {res?.entities.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Input placeholder="Aksi (mis. quota)" value={f.action} onChange={(e) => set("action", e.target.value)} aria-label="Aksi" />
        <Input placeholder="Email pelaku" value={f.actor} onChange={(e) => set("actor", e.target.value)} aria-label="Pelaku" />
        <Input placeholder="ID entitas" value={f.entityId} onChange={(e) => set("entityId", e.target.value)} aria-label="ID entitas" />
        <Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} aria-label="Dari tanggal" />
        <Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} aria-label="Sampai tanggal" />
        <Button type="submit">Terapkan</Button>
      </form>
      {!res ? (
        <div className="skeleton h-72" />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">{fmtNumber(res.total)} entri</p>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Pelaku</Th>
                  <Th>Aksi</Th>
                  <Th>Entitas</Th>
                  <Th className="w-[44%]">Sebelum → sesudah</Th>
                </tr>
              </thead>
              <tbody>
                {res.rows.length === 0 && (
                  <tr>
                    <Td className="text-muted">Tidak ada entri.</Td>
                  </tr>
                )}
                {res.rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{fmtDateTime(r.at)}</Td>
                    <Td>
                      {r.actor_email ?? <span className="text-muted">sistem</span>}
                      {r.ip && <p className="text-xs text-muted">{r.ip}</p>}
                    </Td>
                    <Td className="font-mono text-xs">{r.action}</Td>
                    <Td>
                      {r.entity}
                      {r.entity_id && (
                        <button
                          className="block font-mono text-[11px] text-cimory-blue hover:underline"
                          onClick={() => {
                            const n = { ...f, entityId: r.entity_id! };
                            setF(n);
                            setApplied(n);
                            setPage(1);
                          }}
                        >
                          {r.entity_id.slice(0, 18)}
                        </button>
                      )}
                    </Td>
                    <Td>
                      <DiffView before={r.before} after={r.after} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button variant="secondary" className="py-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Sebelumnya
              </Button>
              <span>
                Halaman {page} / {pages}
              </span>
              <Button variant="secondary" className="py-2" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Berikutnya →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
