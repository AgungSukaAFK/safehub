import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/app-config";

/** Hanya halaman publik yang boleh diindeks. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${APP_URL}/selamat-datang` }];
}
