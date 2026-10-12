"use client";

import { useEffect, useState } from "react";

/**
 * Kamera, enkripsi manifest (WebCrypto) dan service worker hanya diizinkan browser di HTTPS
 * (atau localhost). Tampilkan peringatan jelas bila scanner dibuka lewat HTTP biasa.
 */
export function SecureContextNotice() {
  const [insecure, setInsecure] = useState(false);
  useEffect(() => setInsecure(!window.isSecureContext), []);
  if (!insecure) return null;
  return (
    <div role="alert" className="bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-slate-950">
      Scanner butuh koneksi HTTPS: kamera dan mode offline diblokir browser di alamat http://. Hubungi admin untuk alamat HTTPS.
    </div>
  );
}
