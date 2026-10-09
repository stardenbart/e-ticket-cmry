"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateShort } from "@/lib/format";
import { Alert, Button, Card, Field, Input, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useToast } from "./kit";

type Row = { domain: string; created_at: string };

export function BlockedDomains() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const load = () => api<{ domains: Row[] }>("/api/admin/blocked-domains").then((r) => setRows(r.domains)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const shown = useMemo(() => (rows ?? []).filter((r) => r.domain.includes(filter.toLowerCase())), [rows, filter]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ added: number }>("/api/admin/blocked-domains", { json: { domains: input } });
      toast({ tone: "ok", text: `${r.added} domain ditambahkan.` });
      setInput("");
      load();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: string) {
    if (!window.confirm(`Hapus ${d} dari daftar blokir?`)) return;
    try {
      await api(`/api/admin/blocked-domains?domain=${encodeURIComponent(d)}`, { method: "DELETE" });
      toast({ tone: "ok", text: `${d} dihapus.` });
      load();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Blokir Domain Email" subtitle="Registrasi dengan email dari domain sekali pakai di daftar ini ditolak. Subdomain ikut terblokir." />
      <Card className="p-5">
        {err && <Alert tone="red" className="mb-3">{err}</Alert>}
        <form onSubmit={add} className="space-y-3">
          <Field label="Tambah domain" htmlFor="d-input" hint="Satu atau beberapa domain, dipisah baris, spasi, atau koma.">
            <Textarea id="d-input" className="min-h-20 font-mono text-sm" placeholder={"mailinator.com\nyopmail.com"} value={input} onChange={(e) => setInput(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy || !input.trim()}>
            {busy && <Spinner />} Tambahkan
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Daftar blokir ({rows?.length ?? 0})</h2>
          <Input placeholder="Cari domain…" className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Cari domain" />
        </div>
        {!rows ? (
          <div className="skeleton h-40" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => (
              <li key={r.domain} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span>
                  <span className="font-mono text-sm">{r.domain}</span>
                  <span className="block text-xs text-muted">sejak {fmtDateShort(r.created_at)}</span>
                </span>
                <button className="text-sm font-semibold text-cimory-red-dark hover:underline" onClick={() => remove(r.domain)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {toastNode}
    </div>
  );
}
