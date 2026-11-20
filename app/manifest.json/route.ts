// Manifest PWA (frontend-guide §22.1). Route handler (bukan file statis) supaya nama app ikut
// lib/app-config.ts: satu sumber, tanpa placeholder kedua. Dikecualikan dari proxy (tanpa login).
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "@/lib/app-config";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id: "/",
      name: APP_NAME,
      short_name: APP_SHORT_NAME,
      description: APP_DESCRIPTION,
      lang: "id",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#18181b",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
  );
}
