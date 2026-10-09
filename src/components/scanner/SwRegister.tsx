"use client";

import { useEffect } from "react";

/** Daftarkan service worker scanner (scope /scanner) agar aplikasi tetap terbuka saat offline. */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/scanner" }).catch(() => {});
  }, []);
  return null;
}
