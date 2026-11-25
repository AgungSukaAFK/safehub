import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/app-config";

// Halaman app TIDAK di-disallow: crawler harus bisa membaca noindex (default app/layout.tsx). Yang diindeks hanya landing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
