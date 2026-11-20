import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccessCard, AppearanceCard, MemberInfoCard, NotificationCard, ProfileDataCard } from "./profile-cards";

export const metadata: Metadata = { title: "Profil Saya" };

// Profil saya (frontend-guide §15.3): Data Profil → Tampilan → Notifikasi → Akses Saya → data members.
export default async function ProfilPage() {
  const access = await requireAccess("viewer");
  const supabase = await createClient();
  const [p, m] = await Promise.all([
    supabase.schema("public").from("profiles").select("nrp_gmi, nrp_gis").eq("id", access.userId).maybeSingle(),
    supabase.from("members").select("team, approval_limit").eq("user_id", access.userId).maybeSingle(),
  ]);
  const nrp = p.data?.nrp_gmi ?? p.data?.nrp_gis ?? null;
  const member = m.data ? { team: m.data.team, approvalLimit: m.data.approval_limit === null ? null : Number(m.data.approval_limit) } : null;

  return (
    <>
      <PageHeader title="Profil Saya" description="Data diri, tampilan, notifikasi, dan akses Anda." />
      <ProfileDataCard nrp={nrp} />
      <div className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-6">
        <AppearanceCard />
        <AccessCard />
      </div>
      <NotificationCard />
      <MemberInfoCard member={member} />
    </>
  );
}
