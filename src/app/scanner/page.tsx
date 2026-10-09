import ScannerApp from "@/components/scanner/ScannerApp";

// Halaman statis (tanpa data server) agar bisa di-cache service worker dan dibuka saat offline.
// Autentikasi & data diambil di klien.
export default function ScannerPage() {
  return <ScannerApp />;
}
