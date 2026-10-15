import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "media-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "postgres", "ioredis", "nodemailer", "pdf-lib", "exceljs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          ...(isDev || process.env.COOKIE_SECURE === "false" ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
      // Service worker & manifest selalu dicek ulang agar pembaruan cepat sampai ke aplikasi terpasang.
      { source: "/sw-site.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/app.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/manifest+json" }] },
    ];
  },
};

export default nextConfig;
