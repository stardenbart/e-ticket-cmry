import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const dynamic = "force-static";

// Ditampilkan service worker situs saat HP tidak terhubung ke internet.
export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 pt-28 pb-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/app-192.png" alt="" width={96} height={96} className="mb-5 size-24 rounded-3xl" />
      <h1 className="font-hud text-2xl font-bold uppercase tracking-[0.12em] text-white">Tidak ada koneksi</h1>
      <p className="mt-3 text-[#cbd5e1]">Periksa sinyal atau Wi-Fi Anda, lalu coba lagi. Klaim tiket dan e-ticket membutuhkan internet.</p>
      <a href="/" className="font-hud mt-6 inline-flex h-11 items-center rounded-full border-2 border-[#9afcff] px-6 font-bold uppercase tracking-[0.12em] text-[#9afcff]">
        Coba lagi
      </a>
    </section>
  );
}
