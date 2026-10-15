// Service worker situs peserta (scope /), agar bisa dipasang ke layar utama Android.
//  - /_next/static/*, /images/*, /icons/* : cache-first (berkas statis)
//  - navigasi halaman : selalu ke jaringan; bila offline tampilkan /offline
//  - /api, /admin, /scanner : tidak disentuh (scanner punya service worker sendiri di /sw.js)
// Halaman berisi data pribadi (tiket, profil) sengaja TIDAK disimpan di cache.
const VERSION = "site-v1";
const OFFLINE = "/offline";
const SHELL = [OFFLINE, "/app.webmanifest", "/icons/app-192.png", "/icons/app-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("site-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") cache.put(req, res.clone());
  return res;
}

async function pageOrOffline(req) {
  try {
    return await fetch(req);
  } catch (e) {
    const fb = await caches.match(OFFLINE);
    if (fb) return fb;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/admin") || p.startsWith("/scanner")) return;

  if (p.startsWith("/_next/static/") || p.startsWith("/images/") || p.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") event.respondWith(pageOrOffline(req));
});
