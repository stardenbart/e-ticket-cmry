"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Kamera belakang + dekode QR. Pakai BarcodeDetector bila tersedia, selain itu jsQR di canvas.
 * `paused` menghentikan dekode (mis. saat layar hasil tampil) tanpa mematikan kamera.
 */
export function CameraScanner({ paused, onDetect }: { paused: boolean; onDetect: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const cbRef = useRef(onDetect);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);

  pausedRef.current = paused;
  cbRef.current = onDetect;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastScan = 0;
    let detector: Detector | null = null;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (BD) {
      try {
        detector = new BD({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
    }

    const emit = (text: string) => {
      const now = Date.now();
      // Abaikan QR yang sama dalam 3 detik (kamera masih mengarah ke QR yang sama).
      if (text === lastRef.current.text && now - lastRef.current.at < 3000) return;
      lastRef.current = { text, at: now };
      cbRef.current(text);
    };

    const loop = async (ts: number) => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && !pausedRef.current && ts - lastScan > 150) {
        lastScan = ts;
        try {
          if (detector) {
            const codes = await detector.detect(v);
            if (codes[0]?.rawValue) emit(codes[0].rawValue);
          } else {
            const c = canvasRef.current!;
            const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.floor(v.videoWidth * scale);
            c.height = Math.floor(v.videoHeight * scale);
            const g = c.getContext("2d", { willReadFrequently: true })!;
            g.drawImage(v, 0, 0, c.width, c.height);
            const img = g.getImageData(0, 0, c.width, c.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) emit(code.data);
          }
        } catch {
          // frame gagal didekode — lanjut frame berikutnya
        }
      }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Browser tidak mendukung kamera. Gunakan input manual di bawah.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTorch({ on: false, track });
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan input manual."
            : "Kamera tidak dapat dibuka. Gunakan input manual di bawah.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    if (!torch) return;
    const on = !torch.on;
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ ...torch, on });
    } catch {}
  };

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black sm:aspect-video">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {/* bingkai bidik */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative size-[62%] max-h-72 max-w-72">
          {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
            <span key={c} className={`absolute size-10 border-white ${c}`} />
          ))}
          {!paused && !error && <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-cimory-red/80" />}
        </div>
      </div>
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-slate-900/90 p-6 text-center text-sm text-white">
          <p>{error}</p>
        </div>
      )}
      {paused && !error && <div className="absolute inset-0 bg-black/50" />}
      {torch && (
        <button
          type="button"
          onClick={toggleTorch}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white"
          aria-pressed={torch.on}
        >
          {torch.on ? "Senter: nyala" : "Senter: mati"}
        </button>
      )}
    </div>
  );
}
