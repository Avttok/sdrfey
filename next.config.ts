import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // endereço antigo do primeiro acesso
  async redirects() { return [{ source: "/trocar-senha", destination: "/primeiro-acesso", permanent: false }]; },
  // CSVs de leads chegam a alguns MB
  experimental: { staleTimes: { dynamic: 30, static: 300 }, serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
