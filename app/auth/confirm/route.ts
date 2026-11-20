// [starter-standar] direkonstruksi: verifikasi link email (reset password / undangan).
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  // /auth/password-baru sengaja diizinkan (getSafeNextPath menolak semua /auth)
  const next = nextParam === "/auth/password-baru" ? nextParam : (getSafeNextPath(nextParam) ?? "/");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const target = new URL(ok ? next : "/auth/login?pesan=link-tidak-valid", url.origin);
  return NextResponse.redirect(target);
}
