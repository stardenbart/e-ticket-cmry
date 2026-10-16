import type { Metadata } from "next";
import { ProsePage } from "@/components/site/prose-page";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Kebijakan Privasi" updated="15 Oktober 2026">
      <p>
        Kebijakan ini menjelaskan data pribadi apa yang kami proses, untuk apa, dan berapa lama, sesuai Undang-Undang No. 27 Tahun 2022 tentang
        Pelindungan Data Pribadi (UU PDP). Dengan mendaftar, Anda memberikan persetujuan eksplisit atas pemrosesan berikut.
      </p>
      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li><b>Data karyawan:</b> NIK, nama pegawai, departemen, dan kategori (CMD/OS) dari daftar karyawan penyelenggara.</li>
        <li><b>Data akun:</b> NIK, nama lengkap sesuai Kartu Karyawan, email, dan password (disimpan dalam bentuk hash).</li>
        <li><b>Data tiket &amp; check-in:</b> kategori tiket, ukuran baju, waktu klaim, serta waktu dan gate check-in.</li>
      </ul>
      <p>Kami <b>tidak</b> meminta atau menyimpan nomor identitas pribadi (KTP, SIM, atau Paspor); identitas yang dipakai hanya NIK dan Kartu Karyawan.</p>
      <h2>Untuk apa data dipakai</h2>
      <ul>
        <li><b>Kelayakan:</b> NIK dan nama dicocokkan dengan daftar karyawan agar hanya karyawan yang berhak dapat mengklaim tiket.</li>
        <li><b>Satu NIK satu tiket:</b> mencegah satu orang memegang beberapa tiket melalui beberapa akun.</li>
        <li><b>Verifikasi di gate:</b> petugas mencocokkan nama dan NIK di tiket dengan Kartu Karyawan.</li>
        <li><b>Logistik acara:</b> ukuran baju dipakai panitia untuk menyiapkan kaos acara.</li>
        <li>QR tiket tidak berisi nama atau NIK, sehingga foto QR yang tersebar tidak membocorkan data pribadi.</li>
      </ul>
      <h2>Siapa yang dapat melihat data Anda</h2>
      <ul>
        <li>Petugas gate hanya melihat data tiket yang sedang dipindai (nama, NIK, departemen, kategori tiket).</li>
        <li>Admin penyelenggara dapat melihat dan mengekspor daftar karyawan, akun, dan peserta. Setiap akses dan perubahan data tercatat di audit log.</li>
      </ul>
      <h2>Retensi</h2>
      <ul>
        <li>Data perangkat check-in dianonimkan <b>30 hari setelah acara selesai</b>.</li>
        <li>Anda dapat meminta penghapusan akun kapan saja melalui penyelenggara.</li>
      </ul>
      <h2>Hak Anda</h2>
      <p>Anda berhak mengakses, memperbaiki, dan meminta penghapusan data pribadi Anda, serta menarik persetujuan (yang berarti akun tidak lagi dapat dipakai untuk klaim tiket).</p>
    </ProsePage>
  );
}
