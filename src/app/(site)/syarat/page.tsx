import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

export default function TermsPage() {
  return (
    <ProsePage title="Syarat & Ketentuan" updated="8 Oktober 2026">
      <h2>1. Akun</h2>
      <ul>
        <li>Pendaftaran gratis dan wajib memakai email aktif yang diverifikasi dengan kode OTP. Email dari layanan sekali pakai tidak diterima.</li>
        <li>Nama di akun harus sesuai dengan kartu identitas (KTP, SIM, atau Paspor) yang Anda daftarkan di profil.</li>
        <li>Anda bertanggung jawab menjaga kerahasiaan password dan kode OTP. Panitia tidak pernah meminta kode OTP.</li>
      </ul>
      <h2>2. Klaim tiket</h2>
      <ul>
        <li>Satu akun hanya dapat memegang satu tiket aktif per event, di kategori mana pun.</li>
        <li>Satu nomor identitas hanya dapat dipakai untuk satu tiket aktif per event, meskipun dari akun berbeda.</li>
        <li>Urutan klaim ditentukan oleh waktu server. Pengguna yang masuk antrean sebelum penjualan dibuka diacak urutannya saat dibuka.</li>
        <li>Klaim bersifat final setelah tombol Klaim Tiket berhasil diproses. Penggunaan bot, skrip otomatis, atau banyak akun dapat menyebabkan akun dinonaktifkan dan tiket dibatalkan.</li>
      </ul>
      <h2>3. Tiket</h2>
      <ul>
        <li>Tiket gratis, atas nama pemilik akun, dan <b>tidak dapat dipindahtangankan</b>.</li>
        <li>Tiket berupa QR yang dikirim ke email terverifikasi dan selalu tersedia di menu Tiket Saya.</li>
        <li>Jangan menyebarkan foto QR. Jika QR bocor, penyelenggara dapat menerbitkan ulang tiket sehingga QR lama tidak berlaku.</li>
      </ul>
      <h2>4. Pembatalan</h2>
      <ul>
        <li>Pemegang tiket dapat membatalkan tiket sebelum batas waktu yang ditentukan untuk masing-masing event (misalnya H-3). Slot akan dikembalikan ke kuota.</li>
        <li>Jika event dibatalkan penyelenggara, semua tiket otomatis dibatalkan dan pemegang tiket diberi tahu lewat email.</li>
      </ul>
      <h2>5. Masuk ke venue</h2>
      <ul>
        <li>Bawa kartu identitas asli yang sama dengan data di tiket. Petugas akan mencocokkan nama dan 4 digit terakhir nomor identitas.</li>
        <li>Petugas berhak menolak masuk jika identitas tidak cocok. Satu QR hanya dapat dipakai untuk satu kali check-in.</li>
      </ul>
      <p>
        Pemrosesan data pribadi diatur dalam <Link href="/privasi">Kebijakan Privasi</Link>.
      </p>
    </ProsePage>
  );
}
