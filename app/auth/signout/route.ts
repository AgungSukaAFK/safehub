// [starter-standar] direkonstruksi: keluar. POST saja (GET bisa dipicu prefetch/link).
import { NextResponse, type NextRequest } from "next/server";
import { cctv } from "@/lib/cctv";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    // dicatat SEBELUM signOut (cctv butuh sesi user)
    await cctv({ category: "auth", action: "auth.logout", summary: "Keluar dari app" }, { immediate: true });
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", request.url), { status: 303 });
}
