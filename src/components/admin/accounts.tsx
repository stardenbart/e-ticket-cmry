"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDateShort } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { Td, Th, useToast } from "./kit";

type Account = { id: string; email: string; full_name: string; role: string; disabled_at: string | null; created_at: string; pending: boolean };

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", EVENT_ADMIN: "Event Admin", GATE_STAFF: "Staf Gate" };

export function Accounts({ meId }: { meId: string }) {
  const [rows, setRows] = useState<Account[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("EVENT_ADMIN");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const load = () => api<{ accounts: Account[] }>("/api/admin/accounts").then((r) => setRows(r.accounts)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/accounts", { json: { email, fullName: name, role } });
      toast({ tone: "ok", text: "Akun dibuat. Minta pemilik mengatur password lewat Lupa Password." });
      setEmail("");
      setName("");
      load();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(a: Account, body: Record<string, unknown>, ok: string) {
    try {
      await api(`/api/admin/accounts/${a.id}`, { method: "PATCH", json: body });
      toast({ tone: "ok", text: ok });
      load();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Akun Admin" subtitle="Kelola akun admin & staf. Semua admin dan staf wajib 2FA lewat OTP email setiap login." />
      <Card className="p-5">
        <h2 className="mb-3 font-bold">Tambah akun admin</h2>
        {err && <Alert tone="red" className="mb-3">{err}</Alert>}
        <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_1fr_200px_auto] md:items-end">
          <Field label="Email" htmlFor="a-email">
            <Input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Nama lengkap" htmlFor="a-name">
            <Input id="a-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Peran" htmlFor="a-role">
            <Select id="a-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="EVENT_ADMIN">Event Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy && <Spinner />} Tambah
          </Button>
        </form>
      </Card>
      {!rows ? (
        <div className="skeleton h-64" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <Th>Akun</Th>
                <Th>Peran</Th>
                <Th>Status</Th>
                <Th>Dibuat</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const self = a.id === meId;
                return (
                  <tr key={a.id}>
                    <Td>
                      <p className="font-semibold">
                        {a.full_name} {self && <span className="text-xs font-normal text-muted">(Anda)</span>}
                      </p>
                      <p className="text-xs text-muted">{a.email}</p>
                    </Td>
                    <Td>
                      {self ? (
                        ROLE_LABEL[a.role]
                      ) : (
                        <Select
                          aria-label={`Peran ${a.email}`}
                          className="!py-1.5 text-sm"
                          value={a.role}
                          onChange={(e) => {
                            if (window.confirm(`Ubah peran ${a.email} menjadi ${ROLE_LABEL[e.target.value]}? Sesi aktifnya akan dicabut.`))
                              patch(a, { role: e.target.value }, "Peran diubah.");
                          }}
                        >
                          {Object.entries(ROLE_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Td>
                    <Td>
                      {a.disabled_at ? <Badge tone="red">Nonaktif</Badge> : a.pending ? <Badge tone="amber">Belum atur password</Badge> : <Badge tone="green">Aktif</Badge>}
                    </Td>
                    <Td>{fmtDateShort(a.created_at)}</Td>
                    <Td className="text-right">
                      {!self && (
                        <button
                          className={`text-sm font-semibold hover:underline ${a.disabled_at ? "text-cimory-blue" : "text-cimory-red-dark"}`}
                          onClick={() => patch(a, { disabled: !a.disabled_at }, a.disabled_at ? "Akun diaktifkan." : "Akun dinonaktifkan & sesinya dicabut.")}
                        >
                          {a.disabled_at ? "Aktifkan" : "Nonaktifkan"}
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {toastNode}
    </div>
  );
}
