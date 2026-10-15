import { PageHero } from "@/components/site/ornaments";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "FAQ" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Siapa yang bisa klaim tiket?", a: "Hanya karyawan yang terdaftar di daftar karyawan CMD Employee Gathering 2026 (karyawan CMD dan OS). Tiket gratis dan kuota tiap kategori terbatas." },
  {
    q: "Bagaimana format NIK yang benar?",
    a: (
      <>
        Karyawan CMD: <b>04.xxxx</b> (contoh 04.0018 atau 04.12345). Karyawan OS (outsourcing): <b>A1.xx.xxxx</b> (contoh A1.23.4567). x adalah angka; jumlah digit tiap NIK boleh berbeda. Tulis lengkap dengan titiknya.
      </>
    ),
  },
  {
    q: "Apa yang harus disiapkan sebelum pemesanan dibuka?",
    a: (
      <>
        <Link href="/daftar">Daftar akun</Link> dengan NIK, nama lengkap <b>HURUF KAPITAL sesuai KTP</b>, email aktif, dan password. Saat klaim, Anda mengisi ulang nama, NIK, dan ukuran baju &mdash; sistem mencocokkannya dengan daftar karyawan.
      </>
    ),
  },
  { q: "Nama saya ditolak padahal NIK benar?", a: "Nama harus sama dengan data karyawan (HURUF KAPITAL, sesuai KTP). Spasi ganda dan tanda baca seperti titik atau koma diabaikan, tetapi huruf atau kata yang berbeda tetap ditolak. Jika data karyawan Anda keliru, hubungi panitia." },
  { q: "Ukuran baju apa saja yang tersedia?", a: "2S, 3S, 4S, XS, S, M, L, XL, XXL, 3XL, 4XL, dan 5XL. Pilih saat klaim tiket." },
  {
    q: "Bagaimana antrean bekerja?",
    a: "Tombol Masuk Antrean aktif 10 menit sebelum pemesanan dibuka. Semua yang masuk sebelum jam buka diacak urutannya tepat saat dibuka, jadi tidak perlu berlomba di detik terakhir. Saat giliran tiba, Anda punya 5 menit untuk mengisi data dan menekan Klaim Tiket.",
  },
  { q: "Apakah membuka banyak tab menambah peluang?", a: "Tidak. Satu akun hanya punya satu posisi antrean. Membuka tab lain atau me-refresh tidak mengubah posisi Anda." },
  { q: "Bisakah saya punya lebih dari satu tiket?", a: "Tidak. Satu NIK hanya bisa memegang satu tiket, meskipun mendaftar dengan beberapa akun." },
  { q: "Email tiket tidak masuk, bagaimana?", a: "Cek folder spam/promosi. QR selalu tersedia di menu Tiket Saya, dan Anda bisa menekan Kirim ulang email (maksimal 3 kali per jam)." },
  { q: "Bisakah tiket diberikan ke orang lain?", a: "Tidak. Tiket atas nama pemilik NIK dan dicocokkan dengan ID card karyawan di gate. Jika tidak bisa hadir, batalkan tiket sebelum batas waktu agar slot bisa dipakai rekan lain." },
  { q: "Bagaimana cara masuk di hari acara?", a: "Tunjukkan QR dari Tiket Saya (gunakan Mode layar terang) atau dari email, lalu tunjukkan ID card karyawan. Petugas mencocokkan nama dan NIK. Satu QR hanya bisa dipakai sekali." },
  { q: "Ponsel saya mati atau layar retak, bagaimana?", a: "Petugas dapat mencari tiket Anda berdasarkan nama atau NIK. Anda tetap wajib menunjukkan ID card karyawan." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 sm:pt-20">
      <PageHero title="Pertanyaan Umum" subtitle="Semua yang perlu Anda tahu tentang pemesanan tiket CMD Employee Gathering 2026." />
      <div className="mt-4 space-y-4">
        {FAQ.map((f, i) => (
          <details key={i} className="group rounded-2xl border border-line bg-white p-5 open:shadow-sm" open={i === 0}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-bold text-white">
              {f.q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9afcff] to-[#f714f7] font-bold text-[#062a52] transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <div className="rich-text mt-2 text-[15px] text-[#e6ebff]">{f.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
