"use client";

import { useRef, useState } from "react";
import { utcToZonedLocal, TZ_LABEL } from "@/lib/format";
import { Alert, Button, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { RichTextEditor } from "./rich-text";
import type { EventPayload } from "./event-types";
import type { SaveFn } from "./event-editor";
import type { useToast } from "./kit";

type ToastFn = ReturnType<typeof useToast>["toast"];

function SaveBar({ busy, dirty, onSave }: { busy: boolean; dirty: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex items-center justify-end gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
      {dirty && <span className="text-sm text-warn">● Ada perubahan yang belum disimpan</span>}
      <Button onClick={onSave} disabled={busy || !dirty}>
        {busy && <Spinner />} Simpan
      </Button>
    </div>
  );
}

function useForm<T extends Record<string, unknown>>(initial: T) {
  const [v, setV] = useState(initial);
  const [base] = useState(initial);
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((p) => ({ ...p, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  return { v, set, dirty };
}

export function InfoTab({ data, save }: { data: EventPayload; save: SaveFn }) {
  const e = data.event;
  const { v, set, dirty } = useForm({ name: e.name, slug: e.slug, event_type: e.event_type, organizer: e.organizer, description: e.description, terms: e.terms });
  const [busy, setBusy] = useState(false);
  const types = data.eventTypes.includes(e.event_type) ? data.eventTypes : [e.event_type, ...data.eventTypes];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nama event" htmlFor="name" hint={`${v.name.length}/100 karakter`}>
          <Input id="name" maxLength={100} value={v.name} onChange={(x) => set("name", x.target.value)} />
        </Field>
        <Field label="Slug URL" htmlFor="slug" hint={`/event/${v.slug || "…"} — huruf kecil, angka, tanda hubung. Harus unik.`}>
          <Input id="slug" value={v.slug} onChange={(x) => set("slug", x.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
        </Field>
        <Field label="Kategori acara" htmlFor="type">
          <Select id="type" value={v.event_type} onChange={(x) => set("event_type", x.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Nama penyelenggara" htmlFor="org">
          <Input id="org" maxLength={120} value={v.organizer} onChange={(x) => set("organizer", x.target.value)} />
        </Field>
      </div>
      <Field label="Deskripsi" htmlFor="desc" hint="HTML disanitasi otomatis saat disimpan (script & atribut berbahaya dibuang).">
        <RichTextEditor id="desc" label="Deskripsi" value={v.description} onChange={(h) => set("description", h)} minHeight={220} />
      </Field>
      <Field label="Syarat & Ketentuan" htmlFor="terms">
        <RichTextEditor id="terms" label="Syarat & Ketentuan" value={v.terms} onChange={(h) => set("terms", h)} />
      </Field>
      <SaveBar
        busy={busy}
        dirty={dirty}
        onSave={async () => {
          setBusy(true);
          await save(v);
          setBusy(false);
        }}
      />
    </div>
  );
}

export function MediaTab({ data, reload, toast }: { data: EventPayload; reload: () => Promise<void>; toast: ToastFn }) {
  const e = data.event;
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(kind: "banner" | "thumb" | "gallery", file: File) {
    if (file.size > 2 * 1024 * 1024) return toast({ tone: "err", text: "Ukuran gambar maksimal 2 MB." });
    setBusy(kind);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    try {
      const r = await fetch(`/api/admin/events/${e.id}/media`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Gagal mengunggah.");
      toast({ tone: "ok", text: "Gambar diunggah dan dikompresi ke WebP." });
      await reload();
    } catch (x) {
      toast({ tone: "err", text: (x as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function removeGallery(url: string) {
    const r = await fetch(`/api/admin/events/${e.id}/media`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    if (r.ok) await reload();
    else toast({ tone: "err", text: "Gagal menghapus gambar." });
  }

  return (
    <div className="space-y-8">
      <Alert tone="blue">Format JPG, PNG, atau WebP, maksimal 2 MB. Gambar dikompresi otomatis ke WebP.</Alert>
      <ImageSlot
        title="Banner utama"
        hint="Rasio 2:1, minimal 1440×720 px. Tampil di hero beranda & halaman detail."
        url={e.banner_url}
        aspect="aspect-[2/1]"
        busy={busy === "banner"}
        onPick={(f) => upload("banner", f)}
      />
      <ImageSlot title="Thumbnail kartu" hint="Rasio 1:1, minimal 400×400 px. Tampil di kartu event." url={e.thumb_url} aspect="aspect-square max-w-xs" busy={busy === "thumb"} onPick={(f) => upload("thumb", f)} />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Galeri (opsional)</h3>
            <p className="text-sm text-muted">Maksimal 8 gambar.</p>
          </div>
          <PickButton label="+ Tambah gambar" busy={busy === "gallery"} onPick={(f) => upload("gallery", f)} disabled={e.gallery.length >= 8} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {e.gallery.map((g) => (
            <div key={g} className="group relative overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g} alt="" className="aspect-video w-full object-cover" />
              <button onClick={() => removeGallery(g)} className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-cimory-red-dark shadow">
                Hapus
              </button>
            </div>
          ))}
          {e.gallery.length === 0 && <p className="col-span-full text-sm text-muted">Belum ada gambar galeri.</p>}
        </div>
      </div>
    </div>
  );
}

function PickButton({ label, busy, onPick, disabled }: { label: string; busy: boolean; onPick: (f: File) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(x) => {
          const f = x.target.files?.[0];
          if (f) onPick(f);
          x.target.value = "";
        }}
      />
      <Button type="button" variant="secondary" className="py-2 text-sm" disabled={busy || disabled} onClick={() => ref.current?.click()}>
        {busy && <Spinner />} {label}
      </Button>
    </>
  );
}

function ImageSlot({ title, hint, url, aspect, busy, onPick }: { title: string; hint: string; url: string | null; aspect: string; busy: boolean; onPick: (f: File) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mb-3 text-sm text-muted">{hint}</p>
        <div className={`${aspect} w-full overflow-hidden rounded-xl border border-dashed border-line bg-slate-50`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted">Belum ada gambar</div>
          )}
        </div>
      </div>
      <PickButton label={url ? "Ganti gambar" : "Unggah gambar"} busy={busy} onPick={onPick} />
    </div>
  );
}

export function TimeTab({ data, save }: { data: EventPayload; save: SaveFn }) {
  const e = data.event;
  const tz0 = e.timezone;
  const { v, set, dirty } = useForm({
    timezone: tz0,
    start_local: utcToZonedLocal(e.start_at, tz0),
    end_local: utcToZonedLocal(e.end_at, tz0),
    gate_open_local: e.gate_open_at ? utcToZonedLocal(e.gate_open_at, tz0) : "",
    venue: e.venue,
    address: e.address,
    city: e.city,
    lat: e.lat?.toString() ?? "",
    lng: e.lng?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tz = TZ_LABEL[v.timezone];
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  const hasMap = v.lat !== "" && v.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng);

  async function onSave() {
    setErr(null);
    if (v.end_local <= v.start_local) return setErr("Waktu selesai acara harus setelah waktu mulai.");
    if ((v.lat === "") !== (v.lng === "")) return setErr("Isi latitude dan longitude sekaligus, atau kosongkan keduanya.");
    setBusy(true);
    await save({ ...v, lat: v.lat === "" ? null : lat, lng: v.lng === "" ? null : lng });
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {err && <Alert tone="red">{err}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Zona waktu" htmlFor="tz" hint="Semua jam event & kategori ditampilkan dalam zona ini. Disimpan dalam UTC.">
          <Select id="tz" value={v.timezone} onChange={(x) => set("timezone", x.target.value)}>
            <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
            <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
            <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
          </Select>
        </Field>
        <Field label={`Gate dibuka (${tz})`} htmlFor="gate">
          <Input id="gate" type="datetime-local" value={v.gate_open_local} onChange={(x) => set("gate_open_local", x.target.value)} />
        </Field>
        <Field label={`Acara mulai (${tz})`} htmlFor="start">
          <Input id="start" type="datetime-local" value={v.start_local} onChange={(x) => set("start_local", x.target.value)} />
        </Field>
        <Field label={`Acara selesai (${tz})`} htmlFor="end" error={v.end_local && v.end_local <= v.start_local ? "Harus setelah waktu mulai." : undefined}>
          <Input id="end" type="datetime-local" value={v.end_local} onChange={(x) => set("end_local", x.target.value)} />
        </Field>
        <Field label="Nama venue" htmlFor="venue">
          <Input id="venue" value={v.venue} onChange={(x) => set("venue", x.target.value)} />
        </Field>
        <Field label="Kota" htmlFor="city">
          <Input id="city" value={v.city} onChange={(x) => set("city", x.target.value)} />
        </Field>
      </div>
      <Field label="Alamat" htmlFor="address">
        <Textarea id="address" className="min-h-20" value={v.address} onChange={(x) => set("address", x.target.value)} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Latitude" htmlFor="lat" hint="Titik peta, contoh -6.6976">
          <Input id="lat" inputMode="decimal" value={v.lat} onChange={(x) => set("lat", x.target.value)} />
        </Field>
        <Field label="Longitude" htmlFor="lng" hint="contoh 106.9516">
          <Input id="lng" inputMode="decimal" value={v.lng} onChange={(x) => set("lng", x.target.value)} />
        </Field>
      </div>
      {hasMap && (
        <iframe
          title="Peta lokasi"
          className="h-64 w-full rounded-xl border border-line"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.006},${lng + 0.01},${lat + 0.006}&layer=mapnik&marker=${lat},${lng}`}
        />
      )}
      <SaveBar busy={busy} dirty={dirty} onSave={onSave} />
    </div>
  );
}

export function SettingsTab({ data, save }: { data: EventPayload; save: SaveFn }) {
  const e = data.event;
  const { v, set, dirty } = useForm({ cancel_deadline_hours: e.cancel_deadline_hours, require_id_match: e.require_id_match, email_text: e.email_text });
  const [busy, setBusy] = useState(false);
  const days = v.cancel_deadline_hours / 24;
  return (
    <div className="space-y-5">
      <Field
        label="Batas pembatalan tiket (jam sebelum acara)"
        htmlFor="deadline"
        hint={`Peserta bisa membatalkan tiket sampai ${Number.isInteger(days) ? `H-${days}` : `${v.cancel_deadline_hours} jam sebelum acara`}. Isi 0 = sampai acara mulai.`}
      >
        <Input id="deadline" type="number" min={0} max={1440} className="max-w-48" value={v.cancel_deadline_hours} onChange={(x) => set("cancel_deadline_hours", Math.max(0, Number(x.target.value) || 0))} />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-line p-4">
        <input type="checkbox" className="mt-1 size-4" checked={v.require_id_match} onChange={(x) => set("require_id_match", x.target.checked)} />
        <span>
          <span className="font-semibold">Wajib cocok identitas di gate</span>
          <span className="block text-sm text-muted">Staf mencocokkan nama & 4 digit terakhir identitas dengan kartu fisik sebelum mengizinkan masuk.</span>
        </span>
      </label>
      <Field label="Teks tambahan di email tiket" htmlFor="emailtext" hint={`${v.email_text.length}/2000 — misalnya info parkir atau dress code.`}>
        <Textarea id="emailtext" maxLength={2000} value={v.email_text} onChange={(x) => set("email_text", x.target.value)} />
      </Field>
      <SaveBar
        busy={busy}
        dirty={dirty}
        onSave={async () => {
          setBusy(true);
          await save(v);
          setBusy(false);
        }}
      />
    </div>
  );
}

