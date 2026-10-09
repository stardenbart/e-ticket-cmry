import { PageHero } from "@/components/site/ornaments";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "FAQ" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Apakah tiketnya berbayar?", a: "Tidak. Semua tiket gratis dan berbasis registrasi. Kuota tiap kategori terbatas dan dibuka pada jam yang sudah ditentukan." },
  {
    q: "Apa yang harus disiapkan sebelum war tiket?",
    a: (
      <>
        Daftar akun dengan email aktif, lalu lengkapi <Link href="/profil">profil identitas</Link> (nama sesuai identitas, jenis dan nomor identitas). Tanpa profil lengkap, Anda tidak bisa masuk antrean.
      </>
    ),
  },
  {
    q: "Bagaimana antrean bekerja?",
    a: "Tombol Masuk Antrean aktif 10 menit sebelum kategori dibuka. Semua yang masuk sebelum jam buka diacak urutannya tepat saat dibuka, jadi tidak perlu berlomba di detik terakhir. Yang masuk setelah jam buka diantrekan sesuai waktu server. Sistem meloloskan antrean secara bertahap; saat giliran tiba, Anda punya 5 menit untuk menekan Klaim Tiket.",
  },
  { q: "Apakah membuka banyak tab menambah peluang?", a: "Tidak. Satu akun hanya punya satu posisi antrean per event. Membuka tab lain atau me-refresh tidak mengubah posisi Anda." },
  { q: "Kenapa angka sisa kuota berubah-ubah?", a: "Angka sisa kuota diperbarui setiap 1–2 detik dan hanya bersifat informasi. Hasil klaim ditentukan oleh server saat Anda menekan Klaim Tiket, sehingga kuota tidak pernah terlewati." },
  { q: "Bisakah saya punya lebih dari satu tiket?", a: "Tidak. Satu akun hanya bisa memegang satu tiket per event, dan satu nomor identitas hanya bisa dipakai untuk satu tiket per event." },
  { q: "Email tiket tidak masuk, bagaimana?", a: "Cek folder spam/promosi. QR selalu tersedia di menu Tiket Saya, dan Anda bisa menekan Kirim ulang email (maksimal 3 kali per jam)." },
  { q: "Bisakah tiket diberikan ke orang lain?", a: "Tidak. Tiket atas nama pemilik akun dan dicocokkan dengan identitas fisik di gate. Jika tidak bisa hadir, batalkan tiket sebelum batas waktu agar slot bisa dipakai orang lain." },
  { q: "Bagaimana cara masuk di hari acara?", a: "Tunjukkan QR dari Tiket Saya (gunakan Mode layar terang) atau dari email, lalu serahkan kartu identitas asli. Petugas mencocokkan nama dan 4 digit terakhir nomor identitas. Satu QR hanya bisa dipakai sekali." },
  { q: "Ponsel saya mati atau layar retak, bagaimana?", a: "Petugas dapat mencari tiket Anda berdasarkan nama atau ID tiket. Anda tetap wajib menunjukkan identitas asli." },
  { q: "Bisakah saya mengubah nama setelah klaim?", a: "Setelah ada tiket aktif, nama dan identitas dikunci. Perubahan hanya bisa dilakukan lewat permintaan ke admin penyelenggara dan tercatat di audit log." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 sm:pt-20">
      <PageHero title="Pertanyaan Umum" subtitle="Semua yang perlu Anda tahu tentang war tiket dan masuk ke venue." />
      <div className="mt-4 space-y-4">
        {FAQ.map((f, i) => (
          <details key={i} className="group rounded-2xl border border-line bg-white p-5 open:shadow-sm" open={i === 0}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-bold text-white">
              {f.q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#22e5ff] to-[#ff2bd6] font-bold text-[#0d0f3a] transition group-open:rotate-45" aria-hidden>
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
