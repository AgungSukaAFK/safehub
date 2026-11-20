import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Hapus langganan Web Push perangkat ini (dipanggil saat Keluar & "Matikan di perangkat ini").
// RLS: user hanya bisa menghapus langganan miliknya.
export async function POST(request: Request) {
  const parsed = z.object({ endpoint: z.string().url().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
