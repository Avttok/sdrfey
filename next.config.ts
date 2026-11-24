import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Next injeta scripts inline; o resto é travado (sem iframes alheios, sem <object>, formulários só para o próprio site).
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
];

const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const config: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // a lista de arquivos da tela de carregamento lê .next/static em tempo de execução
  outputFileTracingIncludes: { "/api/precache": ["./.next/static/**/*", "./.next/BUILD_ID"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // o service worker nunca fica preso em cache: atualizações chegam na próxima abertura
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  poweredByHeader: false,
  // endereço antigo do primeiro acesso
  async redirects() { return [{ source: "/trocar-senha", destination: "/primeiro-acesso", permanent: false }]; },
  // CSVs de leads chegam a alguns MB
  experimental: { staleTimes: { dynamic: 30, static: 300 }, serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
