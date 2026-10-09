"use client";
// Penyimpanan lokal scanner (IndexedDB):
//   kv      — deviceId, sesi terpilih (event & gate), CryptoKey per event (non-extractable), manifest terenkripsi
//   queue   — keputusan check-in yang belum tersinkron (offline)
//   history — riwayat scan perangkat ini
import type { Manifest, ManifestTicket } from "./validate";

const DB_NAME = "eticket-scanner";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        if (!d.objectStoreNames.contains("queue")) d.createObjectStore("queue", { keyPath: "clientId" });
        if (!d.objectStoreNames.contains("history")) d.createObjectStore("history", { keyPath: "clientId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export const kvGet = <T>(key: string) => tx<T | undefined>("kv", "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
export const kvSet = (key: string, value: unknown) => tx("kv", "readwrite", (s) => s.put(value, key));
export const kvDel = (key: string) => tx("kv", "readwrite", (s) => s.delete(key));
const kvKeys = () => tx<IDBValidKey[]>("kv", "readonly", (s) => s.getAllKeys());

// ---------------------------------------------------------------------------
// Perangkat & sesi
// ---------------------------------------------------------------------------
export async function deviceId(): Promise<string> {
  let id = await kvGet<string>("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    await kvSet("deviceId", id);
  }
  return id;
}

export type Selection = { eventId: string; gate: string; eventName: string; validUntil: string; endAt: string };
export const getSelection = () => kvGet<Selection>("selection");
export const setSelection = (s: Selection) => kvSet("selection", s);
export const clearSelection = () => kvDel("selection");

export type CachedUser = { id: string; name: string; email: string; role: string };
export const getCachedUser = () => kvGet<CachedUser>("user");
export const setCachedUser = (u: CachedUser) => kvSet("user", u);

// ---------------------------------------------------------------------------
// Manifest terenkripsi (AES-GCM, kunci non-extractable dari server per staf+event)
// ---------------------------------------------------------------------------
function b64urlToBytes(s: string) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function storeKey(eventId: string, rawB64url: string) {
  const key = await crypto.subtle.importKey("raw", b64urlToBytes(rawB64url), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  await kvSet(`key:${eventId}`, key);
  return key;
}

export const getKey = (eventId: string) => kvGet<CryptoKey>(`key:${eventId}`);

export async function saveManifest(m: Manifest) {
  const key = await getKey(m.event.id);
  if (!key) throw new Error("Kunci enkripsi manifest tidak ada.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(m)));
  await kvSet(`manifest:${m.event.id}`, { iv, data, validUntil: m.event.valid_until, endAt: m.event.end_at });
}

export async function loadManifest(eventId: string): Promise<Manifest | null> {
  const [key, blob] = await Promise.all([getKey(eventId), kvGet<{ iv: Uint8Array; data: ArrayBuffer }>(`manifest:${eventId}`)]);
  if (!key || !blob) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.iv as BufferSource }, key, blob.data);
    return JSON.parse(new TextDecoder().decode(plain)) as Manifest;
  } catch {
    return null;
  }
}

export async function deleteEventData(eventId: string) {
  await kvDel(`manifest:${eventId}`);
  await kvDel(`key:${eventId}`);
}

/** Hapus manifest yang sudah lewat H+1 (akhir acara + 1 hari) atau melewati batas akses staf. */
export async function purgeExpired(now = Date.now()) {
  const keys = (await kvKeys()).map(String).filter((k) => k.startsWith("manifest:"));
  for (const k of keys) {
    const blob = await kvGet<{ validUntil?: string; endAt?: string }>(k);
    const endPlus1 = blob?.endAt ? Date.parse(blob.endAt) + 86_400_000 : Infinity;
    const valid = blob?.validUntil ? Date.parse(blob.validUntil) : Infinity;
    if (now > Math.min(endPlus1, valid)) {
      const eventId = k.slice("manifest:".length);
      await deleteEventData(eventId);
      const sel = await getSelection();
      if (sel?.eventId === eventId) await clearSelection();
    }
  }
}

/** Logout: hapus semua data event, sesi & riwayat dari perangkat. deviceId dipertahankan. */
export async function wipeAll() {
  const keys = (await kvKeys()).map(String).filter((k) => k !== "deviceId");
  for (const k of keys) await kvDel(k);
  await tx("queue", "readwrite", (s) => s.clear());
  await tx("history", "readwrite", (s) => s.clear());
}

// ---------------------------------------------------------------------------
// Antrean offline & riwayat
// ---------------------------------------------------------------------------
export type CheckinPayload = {
  clientId: string;
  eventId: string;
  ticketId: string | null;
  version?: number;
  gate: string;
  decision: "ADMIT" | "REJECT";
  reason?: string;
  method: "QR" | "MANUAL";
  scannedAt: string;
  deviceId: string;
};

export type HistoryEntry = {
  clientId: string;
  at: string;
  eventId: string;
  gate: string;
  holderName?: string;
  categoryName?: string;
  outcome: "ADMITTED" | "REJECTED" | "CONFLICT" | "PENDING_ADMIT" | "PENDING_REJECT" | "INVALID";
  reason?: string;
  method: "QR" | "MANUAL";
  offline: boolean;
};

export const queueAdd = (p: CheckinPayload) => tx("queue", "readwrite", (s) => s.put(p));
export const queueAll = () => tx<CheckinPayload[]>("queue", "readonly", (s) => s.getAll());
export const queueDel = (clientId: string) => tx("queue", "readwrite", (s) => s.delete(clientId));
export const queueCount = () => tx<number>("queue", "readonly", (s) => s.count());

export const historyAdd = (h: HistoryEntry) => tx("history", "readwrite", (s) => s.put(h));
export async function historyAll(): Promise<HistoryEntry[]> {
  const all = await tx<HistoryEntry[]>("history", "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.at.localeCompare(a.at));
}
export async function historyUpdate(clientId: string, patch: Partial<HistoryEntry>) {
  const cur = await tx<HistoryEntry | undefined>("history", "readonly", (s) => s.get(clientId) as IDBRequest<HistoryEntry | undefined>);
  if (cur) await historyAdd({ ...cur, ...patch });
}

/** Terapkan check-in ke manifest lokal agar scan ulang di perangkat ini langsung merah. */
export function markLocalCheckin(m: Manifest, ticketId: string, gate: string, at: string): Manifest {
  const t: ManifestTicket | undefined = m.tickets[ticketId];
  if (!t) return m;
  return { ...m, tickets: { ...m.tickets, [ticketId]: { ...t, status: "CHECKED_IN", checked_in_at: at, checked_in_gate: gate } } };
}
