import type { Metadata } from "next";
import { ProsePage } from "@/components/site/prose-page";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Kebijakan Privasi" updated="8 Oktober 2026">
      <p>
        Kebijakan ini menjelaskan data pribadi apa yang kami proses, untuk apa, dan berapa lama, sesuai Undang-Undang No. 27 Tahun 2022 tentang
        Pelindungan Data Pribadi (UU PDP). Dengan mendaftar, Anda memberikan persetujuan eksplisit atas pemrosesan berikut.
      </p>
      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li><b>Data akun:</b> email, nama lengkap sesuai identitas, dan password (disimpan dalam bentuk hash).</li>
        <li><b>Data identitas:</b> jenis identitas (KTP, SIM, atau Paspor) dan nomor identitas.</li>
        <li><b>Data tiket & check-in:</b> kategori, waktu klaim, waktu dan gate check-in.</li>
      </ul>
      <h2>Mengapa identitas diminta</h2>
      <ul>
        <li><b>Verifikasi di gate:</b> tiket atas nama sendiri, jadi petugas mencocokkan nama dan 4 digit terakhir nomor identitas dengan kartu fisik Anda.</li>
        <li><b>Pencegahan calo:</b> satu identitas hanya dapat memegang satu tiket aktif per event, meskipun memakai beberapa akun.</li>
      </ul>
      <h2>Bagaimana nomor identitas disimpan</h2>
      <ul>
        <li>Nomor identitas lengkap <b>tidak pernah disimpan</b>.</li>
        <li>Kami hanya menyimpan <b>hash satu arah (HMAC)</b> untuk mengecek keunikan, dan <b>4 digit terakhir</b> untuk dicocokkan di gate.</li>
        <li>QR tiket tidak berisi nama atau nomor identitas, sehingga foto QR yang tersebar tidak membocorkan data pribadi.</li>
      </ul>
      <h2>Siapa yang dapat melihat data Anda</h2>
      <ul>
        <li>Petugas gate hanya melihat data tiket yang sedang dipindai (nama, kategori, jenis identitas, 4 digit terakhir).</li>
        <li>Admin penyelenggara dapat melihat daftar peserta event yang dikelolanya. Setiap akses dan perubahan data peserta tercatat di audit log.</li>
      </ul>
      <h2>Retensi</h2>
      <ul>
        <li>4 digit terakhir nomor identitas pada tiket dan data perangkat check-in dianonimkan <b>30 hari setelah acara selesai</b>.</li>
        <li>Akun yang tidak diverifikasi dalam 24 jam dihapus otomatis.</li>
        <li>Anda dapat meminta penghapusan akun kapan saja melalui penyelenggara.</li>
      </ul>
      <h2>Hak Anda</h2>
      <p>Anda berhak mengakses, memperbaiki, dan meminta penghapusan data pribadi Anda, serta menarik persetujuan (yang berarti akun tidak lagi dapat dipakai untuk klaim tiket).</p>
    </ProsePage>
  );
}
