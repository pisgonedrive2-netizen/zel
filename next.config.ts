import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tek global CSS chunk — route başına gereksiz preload uyarılarını azaltır
  experimental: {
    cssChunking: "strict",
  },
};

export default nextConfig;
