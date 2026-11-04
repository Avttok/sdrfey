import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // CSVs de leads chegam a alguns MB
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
