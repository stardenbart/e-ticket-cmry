import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

export default function TermsPage() {
  return (
    <ProsePage title="Syarat & Ketentuan" updated="15 Oktober 2026">
      <h2>1. Akun</h2>
      <ul>
        <li>Pendaftaran khusus karyawan yang ada di daftar karyawan, memakai NIK sendiri (CMD: 04.xxxx · OS: A1.xx.xxxx).</li>
        <li>Nama ditulis dengan HURUF KAPITAL sesuai Kartu Karyawan dan harus sama dengan data karyawan.</li>
        <li>Wajib memakai email aktif milik sendiri — tiket QR dikirim ke email tersebut. Email dari layanan sekali pakai tidak diterima.</li>
        <li>Anda bertanggung jawab menjaga kerahasiaan password. Panitia tidak pernah meminta password atau kode reset Anda.</li>
      </ul>
      <h2>2. Klaim tiket</h2>
      <ul>
        <li>Satu NIK hanya dapat memegang satu tiket aktif, di kategori mana pun, meskipun dari akun berbeda.</li>
        <li>Saat klaim, nama, NIK, dan ukuran baju diisi ulang dan dicocokkan dengan daftar karyawan. Ukuran baju tidak dapat diubah setelah klaim kecuali melalui panitia.</li>
        <li>Urutan klaim ditentukan oleh waktu server. Pengguna yang masuk antrean sebelum penjualan dibuka diacak urutannya saat dibuka.</li>
        <li>Klaim bersifat final setelah tombol Klaim Tiket berhasil diproses. Penggunaan bot, skrip otomatis, atau banyak akun dapat menyebabkan akun dinonaktifkan dan tiket dibatalkan.</li>
      </ul>
      <h2>3. Tiket</h2>
      <ul>
        <li>Tiket gratis, atas nama pemilik akun, dan <b>tidak dapat dipindahtangankan</b>.</li>
        <li>Tiket berupa QR yang dikirim ke email akun dan selalu tersedia di menu Tiket Saya.</li>
        <li>Jangan menyebarkan foto QR. Jika QR bocor, penyelenggara dapat menerbitkan ulang tiket sehingga QR lama tidak berlaku.</li>
      </ul>
      <h2>4. Pembatalan</h2>
      <ul>
        <li>Pemegang tiket dapat membatalkan tiket sebelum batas waktu yang ditentukan untuk masing-masing event (misalnya H-3). Slot akan dikembalikan ke kuota.</li>
        <li>Jika event dibatalkan penyelenggara, semua tiket otomatis dibatalkan dan pemegang tiket diberi tahu lewat email.</li>
      </ul>
      <h2>5. Masuk ke venue</h2>
      <ul>
        <li>Bawa Kartu Karyawan. Petugas akan mencocokkan nama dan NIK dengan data di tiket.</li>
        <li>Petugas berhak menolak masuk jika data tidak cocok. Satu QR hanya dapat dipakai untuk satu kali check-in.</li>
      </ul>
      <p>
        Pemrosesan data pribadi diatur dalam <Link href="/privasi">Kebijakan Privasi</Link>.
      </p>
    </ProsePage>
  );
}
