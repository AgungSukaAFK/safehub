import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { textParam } from "@/lib/search-params";

// Daftar Pengajuan APD pindah ke tab "Pengajuan" di /apd (staf K3). Karyawan melihat pengajuannya di APD Saya.
export default async function ApdRequestsRedirect({ searchParams }: PageProps<"/apd/pengajuan">) {
  const access = await requireAccess("viewer");
  const staff = access.role === "admin" || access.platformAdmin || access.functions.some((f) => f !== "karyawan");
  if (!staff) redirect("/apd/saya");
  const sp = await searchParams;
  const qs = new URLSearchParams({ tab: "pengajuan" });
  for (const k of ["status", "q", "site"]) if (textParam(sp, k)) qs.set(k, textParam(sp, k));
  redirect(`/apd?${qs.toString()}`);
}
