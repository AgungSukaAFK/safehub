import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { normalizeFunctions } from "@/lib/functions";
import { PLANNED_REMINDER_KINDS, REMINDER_ORDER as ORDER, type ReminderKind } from "@/lib/pengingat-rules";
import { createClient } from "@/lib/supabase/server";
import { RuleCard, type RuleView } from "./rule-card";

export const metadata: Metadata = { title: "Pengaturan Pengingat" };

// Aturan pengingat (rancangan §4.12). Semua staf K3 boleh membaca; hanya admin app yang mengubah.
export default async function PengingatPage() {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminder_rules").select("id, kind, name, offsets, notify_assignee, notify_functions, is_active");
  if (error) throw error;
  const rules: RuleView[] = (data ?? [])
    .filter((r): r is typeof r & { kind: ReminderKind } => ORDER.includes(r.kind as ReminderKind))
    .map((r) => ({ id: r.id, kind: r.kind, name: r.name, offsets: r.offsets, notifyAssignee: r.notify_assignee, notifyFunctions: normalizeFunctions(r.notify_functions), isActive: r.is_active }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <>
      <PageHeader title="Pengaturan Pengingat" description={isAdmin ? "Atur kapan dan kepada siapa pengingat jatuh tempo dikirim" : "Aturan pengingat yang berlaku (hanya admin yang bisa mengubah)"} />
      <div className="col-span-12 space-y-4">
        {rules.map((r) => (
          <RuleCard key={r.id} rule={r} canEdit={isAdmin} />
        ))}
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Jenis berikut menyusul: {PLANNED_REMINDER_KINDS.join(", ")}.
        </p>
      </div>
    </>
  );
}
