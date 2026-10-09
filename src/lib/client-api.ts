"use client";

export type ApiErr = { code: string; message: string; fields?: { path: string; message: string }[]; [k: string]: unknown };

export class ClientApiError extends Error {
  constructor(public status: number, public data: ApiErr) {
    super(data.message);
  }
}

/** fetch JSON ke API internal. Lempar ClientApiError dengan pesan berbahasa Indonesia. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      method: rest.method ?? (json !== undefined ? "POST" : "GET"),
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError(0, { code: "NETWORK", message: "Koneksi terputus. Periksa jaringan Anda lalu coba lagi." });
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ClientApiError(res.status, data.error ?? { code: "HTTP_" + res.status, message: "Terjadi kesalahan. Coba lagi." });
  return data as T;
}

/** Offset jam server − jam perangkat (ms), dari endpoint /api/time. */
let offsetPromise: Promise<number> | null = null;
export function serverOffset(): Promise<number> {
  if (!offsetPromise) {
    offsetPromise = (async () => {
      const samples: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        try {
          const r = await fetch("/api/time", { cache: "no-store" });
          const { now } = (await r.json()) as { now: number };
          const t1 = Date.now();
          samples.push(now - (t0 + t1) / 2);
        } catch {}
      }
      samples.sort((a, b) => a - b);
      return samples.length ? samples[Math.floor(samples.length / 2)] : 0;
    })();
  }
  return offsetPromise;
}
