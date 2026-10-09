"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button, Field, Input, Spinner } from "@/components/ui";
import { Td, Th, type useToast } from "./kit";
import type { EventPayload } from "./event-types";
import type { SaveFn } from "./event-editor";

type ToastFn = ReturnType<typeof useToast>["toast"];

export function StaffTab({ data, save, reload, toast }: { data: EventPayload; save: SaveFn; reload: () => Promise<void>; toast: ToastFn }) {
  const e = data.event;
  const [gates, setGates] = useState<string[]>(e.gates);
  const [newGate, setNewGate] = useState("");
  const [savingGates, setSavingGates] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string[]>(e.gates.slice(0, 1));
  const [busy, setBusy] = useState(false);
  const gatesDirty = JSON.stringify(gates) !== JSON.stringify(e.gates);
  const usedGates = new Set(data.staff.flatMap((s) => s.gates));

  function addGate() {
    const g = newGate.trim();
    if (g && !gates.includes(g)) setGates([...gates, g]);
    setNewGate("");
  }

  async function invite(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ newAccount: boolean }>(`/api/admin/events/${e.id}/staff`, { json: { email, name: name || undefined, gates: pick } });
      toast({ tone: "ok", text: r.newAccount ? "Akun staf dibuat & undangan dikirim." : "Staf ditugaskan & email dikirim." });
      setEmail("");
      setName("");
      await reload();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string, mail: string) {
    if (!window.confirm(`Cabut akses ${mail} untuk event ini?`)) return;
    try {
      await api(`/api/admin/events/${e.id}/staff?userId=${userId}`, { method: "DELETE" });
      toast({ tone: "ok", text: "Akses staf dicabut." });
      await reload();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-bold">Daftar gate</h3>
        <p className="mb-3 text-sm text-muted">Contoh: Gate A, Gate B, VIP. Staf hanya bisa scan di gate yang ditugaskan.</p>
        <div className="flex flex-wrap gap-2">
          {gates.map((g) => (
            <span key={g} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-cimory-blue ring-1 ring-blue-200">
              {g}
              <button
                type="button"
                aria-label={`Hapus ${g}`}
                disabled={usedGates.has(g) || gates.length === 1}
                title={usedGates.has(g) ? "Masih dipakai staf" : undefined}
                className="text-cimory-blue/70 hover:text-cimory-red-dark disabled:opacity-30"
                onClick={() => setGates(gates.filter((x) => x !== g))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            placeholder="Nama gate baru"
            className="max-w-56"
            value={newGate}
            maxLength={40}
            onChange={(x) => setNewGate(x.target.value)}
            onKeyDown={(x) => x.key === "Enter" && (x.preventDefault(), addGate())}
          />
          <Button type="button" variant="secondary" className="py-2 text-sm" onClick={addGate}>
            Tambah
          </Button>
          <Button
            type="button"
            className="py-2 text-sm"
            disabled={!gatesDirty || savingGates}
            onClick={async () => {
              setSavingGates(true);
              await save({ gates }, "Daftar gate disimpan.");
              setSavingGates(false);
            }}
          >
            {savingGates && <Spinner />} Simpan gate
          </Button>
        </div>
      </section>

      <section>
        <h3 className="font-bold">Undang staf gate</h3>
        <p className="mb-3 text-sm text-muted">
          Akses berlaku sampai H+1 ({fmtDateTime(new Date(new Date(e.end_at).getTime() + 86400_000), e.timezone)}) lalu kedaluwarsa otomatis. Email baru dibuatkan akun
          staf; password diatur lewat Lupa Password.
        </p>
        <form onSubmit={invite} className="grid gap-4 rounded-xl border border-line p-4 md:grid-cols-[1fr_1fr]">
          <Field label="Email staf" htmlFor="s-email">
            <Input id="s-email" type="email" required value={email} onChange={(x) => setEmail(x.target.value)} />
          </Field>
          <Field label="Nama (untuk akun baru)" htmlFor="s-name">
            <Input id="s-name" value={name} onChange={(x) => setName(x.target.value)} />
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-semibold">Gate yang ditugaskan</legend>
            <div className="flex flex-wrap gap-3">
              {e.gates.map((g) => (
                <label key={g} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={pick.includes(g)} onChange={(x) => setPick(x.target.checked ? [...pick, g] : pick.filter((p) => p !== g))} />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy || !pick.length || !email}>
              {busy && <Spinner />} Undang / perbarui staf
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="mb-3 font-bold">Staf bertugas ({data.staff.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <Th>Staf</Th>
                <Th>Gate</Th>
                <Th>Berlaku sampai</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.staff.length === 0 && (
                <tr>
                  <Td className="text-muted">Belum ada staf.</Td>
                </tr>
              )}
              {data.staff.map((s) => {
                const expired = new Date(s.valid_until).getTime() < Date.now();
                return (
                  <tr key={s.user_id}>
                    <Td>
                      <p className="font-semibold">{s.full_name}</p>
                      <p className="text-xs text-muted">{s.email}</p>
                      {s.pending && <Badge tone="amber" className="mt-1">Belum atur password</Badge>}
                    </Td>
                    <Td>{s.gates.join(", ")}</Td>
                    <Td>
                      {fmtDateTime(s.valid_until, e.timezone)}
                      {expired && <Badge tone="slate" className="ml-2">Kedaluwarsa</Badge>}
                    </Td>
                    <Td className="text-right">
                      <button className="text-sm font-semibold text-cimory-red-dark hover:underline" onClick={() => remove(s.user_id, s.email)}>
                        Cabut akses
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
