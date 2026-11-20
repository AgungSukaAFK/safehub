import type { NextConfig } from "next";

// cacheComponents sengaja MATI: pola standar Lourdes (requireAccess di layout, loader server
// dinamis per request) memakai rendering dinamis klasik. Lihat CLAUDE.md "Arsitektur singkat".
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["exceljs", "web-push"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
