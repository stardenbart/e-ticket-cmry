"use client";

import { useEffect, useState } from "react";

/**
 * Di http:// browser memblokir kamera live dan service worker (aplikasi tidak bisa dibuka ulang saat
 * offline). Scanner tetap jalan lewat Foto QR / scanner genggam; beri tahu staf batasannya.
 */
export function SecureContextNotice() {
  const [insecure, setInsecure] = useState(false);
  useEffect(() => setInsecure(!window.isSecureContext), []);
  if (!insecure) return null;
  return (
    <div role="status" className="bg-amber-400/15 px-4 py-2 text-center text-xs font-semibold text-amber-200">
      Mode http://: scan memakai Foto QR atau scanner genggam. Jangan tutup/refresh tab ini saat offline.
    </div>
  );
}
