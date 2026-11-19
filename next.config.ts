import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // CSVs de leads chegam a alguns MB
  experimental: { staleTimes: { dynamic: 30, static: 300 }, serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
