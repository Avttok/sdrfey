import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Next injeta scripts inline; o resto é travado (sem iframes alheios, sem <object>, formulários só para o próprio site).
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
];

const config: NextConfig = {
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
  poweredByHeader: false,
  // endereço antigo do primeiro acesso
  async redirects() { return [{ source: "/trocar-senha", destination: "/primeiro-acesso", permanent: false }]; },
  // CSVs de leads chegam a alguns MB
  experimental: { staleTimes: { dynamic: 30, static: 300 }, serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
