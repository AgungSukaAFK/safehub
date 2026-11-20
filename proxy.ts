// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Kecualikan aset statis, SW, manifest, dan halaman offline (wajib, supaya bisa di-precache
    // tanpa di-redirect ke login; frontend-guide §22.2).
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|~offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
