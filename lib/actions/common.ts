"use server";

// Server Action umum yang dipakai komponen kit (kartu profil, riwayat aktivitas).
import { actionAccess } from "@/lib/auth";
import { getPeople } from "@/lib/people";
import type { LogEntry, Person } from "@/lib/person-types";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Tabel yang punya `<entity>_logs` dan boleh dibaca lewat ActivityLogDialog (RLS tetap berlaku). */
const LOG_ENTITIES = [
  "pengajuan",
  "members",
  "approval_templates",
  "department_heads",
  "areas",
  "master_items",
  "contractors",
  "incidents",
  "findings",
  "pica_actions",
  "inspections",
  "observations",
  "inspection_templates",
  "work_hours",
  "kpi_definitions",
  "tsp_programs",
  "tsp_realizations",
  "safety_activities",
  "tsp_evaluations",
  "reminder_rules",
  "reports",
  "employees",
  "competencies",
  "certificates",
  "mcu_records",
  "site_permits",
  "position_requirements",
  "trainings",
  "contractor_permits",
  "contractor_contracts",
  "csms_assessments",
  "contractor_documents",
  "pjo_pja_appointments",
] as const;
type LogEntity = (typeof LOG_ENTITIES)[number];

export async function getPersonCardAction(userId: string): Promise<Person | null> {
  if (!isUuid(userId) || !(await actionAccess("viewer"))) return null;
  const supabase = await createClient();
  return (await getPeople(supabase, [userId])).get(userId) ?? null;
}

/** Riwayat aktivitas satu dokumen; id orang di dalam `changes` ikut diterjemahkan ke nama. */
export async function loadActivityLogAction(
  entity: string,
  recordId: string,
): Promise<{ entries: LogEntry[]; people: Record<string, string> } | { error: string }> {
  if (!(LOG_ENTITIES as readonly string[]).includes(entity) || !isUuid(recordId)) return { error: "Riwayat tidak tersedia." };
  if (!(await actionAccess("viewer"))) return { error: "Anda tidak punya izin untuk melihat riwayat ini." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(`${entity as LogEntity}_logs`)
    .select("id, at, action, note, changes, actor_id")
    .eq("record_id", recordId)
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (error) return { error: "Riwayat gagal dimuat. Coba lagi." };

  const rows = (data ?? []) as { id: number; at: string; action: string; note: string | null; changes: Record<string, unknown> | null; actor_id: string | null }[];
  // kumpulkan uuid di nilai changes (mis. department_id, approver) untuk diterjemahkan
  const uuids = new Set<string>();
  const scan = (v: unknown) => {
    if (typeof v === "string" && isUuid(v)) uuids.add(v);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === "object") Object.values(v).forEach(scan);
  };
  rows.forEach((r) => {
    if (r.actor_id) uuids.add(r.actor_id);
    scan(r.changes);
  });
  const people = await getPeople(supabase, [...uuids]);
  // departemen juga sering muncul sebagai uuid
  const deptIds = [...uuids].filter((u) => !people.has(u));
  const depts = deptIds.length
    ? ((await supabase.schema("public").from("departments").select("id, name").in("id", deptIds)).data ?? [])
    : [];

  const names: Record<string, string> = {};
  people.forEach((p, id) => (names[id] = p.name));
  depts.forEach((d) => (names[d.id] = d.name));

  return {
    people: names,
    entries: rows.map((r) => {
      const a = r.actor_id ? people.get(r.actor_id) : null;
      return {
        id: r.id,
        at: r.at,
        action: r.action,
        note: r.note,
        changes: r.changes,
        actor: a ? { id: a.id, name: a.name, avatarUrl: a.avatarUrl } : null,
      };
    }),
  };
}
