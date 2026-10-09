import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/scanner/SwRegister";

export const metadata: Metadata = {
  title: "Scanner Gate",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Scanner Gate", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#020617", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <SwRegister />
      {children}
    </div>
  );
}
