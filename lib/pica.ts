// Loader tindakan PICA (satu sumber untuk detail temuan & tab Tindakan kejadian). Hak baca = RLS.
import "server-only";
import { fileNameOf } from "@/lib/pica-rules";
import { getPeople } from "@/lib/people";
import type { Person } from "@/lib/person-types";
import type { ServerClient } from "@/lib/supabase/server";

type PersonBrief = Pick<Person, "id" | "name" | "avatarUrl" | "jobTitle">;

export type EvidenceRound = {
  round: number;
  note: string | null;
  files: { path: string; name: string }[];
  submittedAt: string;
  submittedBy: PersonBrief | null;
  decision: "accepted" | "returned" | null;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: PersonBrief | null;
};

export type PicaAction = {
  id: string;
  code: string;
  title: string;
  kind: "corrective" | "preventive";
  status: string;
  round: number;
  returned: boolean;
  dueDate: string;
  requiredEvidence: string | null;
  causeRef: string | null;
  closedAt: string | null;
  effectivenessDate: string | null;
  effectivenessNote: string | null;
  createdAt: string;
  createdById: string | null;
  pic: PersonBrief | null;
  verifier: PersonBrief | null;
  /** putaran terbaru dulu */
  evidence: EvidenceRound[];
};

const brief = (p: Person | undefined): PersonBrief | null => (p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl, jobTitle: p.jobTitle } : null);

export async function listActions(supabase: ServerClient, parent: { incidentId?: string; findingId?: string }): Promise<PicaAction[]> {
  let q = supabase
    .from("pica_actions")
    .select(
      "id, code, title, kind, status, round, returned, due_date, required_evidence, cause_ref, closed_at, effectiveness_date, effectiveness_note, created_at, created_by, pic_id, verifier_id",
    );
  q = parent.incidentId ? q.eq("incident_id", parent.incidentId) : q.eq("finding_id", parent.findingId!);
  const { data, error } = await q.order("kind").order("created_at");
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];

  const { data: ev } = await supabase
    .from("pica_evidence")
    .select("action_id, round, note, files, submitted_at, submitted_by, decision, decision_note, decided_at, decided_by")
    .in(
      "action_id",
      rows.map((r) => r.id),
    )
    .order("round", { ascending: false });
  const evidence = ev ?? [];
  const people = await getPeople(supabase, [
    ...rows.flatMap((r) => [r.pic_id, r.verifier_id]),
    ...evidence.flatMap((e) => [e.submitted_by, e.decided_by]),
  ]);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    kind: r.kind as PicaAction["kind"],
    status: r.status,
    round: r.round,
    returned: r.returned,
    dueDate: r.due_date,
    requiredEvidence: r.required_evidence,
    causeRef: r.cause_ref,
    closedAt: r.closed_at,
    effectivenessDate: r.effectiveness_date,
    effectivenessNote: r.effectiveness_note,
    createdAt: r.created_at,
    createdById: r.created_by,
    pic: brief(people.get(r.pic_id)),
    verifier: brief(people.get(r.verifier_id)),
    evidence: evidence
      .filter((e) => e.action_id === r.id)
      .map((e) => ({
        round: e.round,
        note: e.note,
        files: (e.files ?? []).map((path: string) => ({ path, name: fileNameOf(path) })),
        submittedAt: e.submitted_at,
        submittedBy: brief(e.submitted_by ? people.get(e.submitted_by) : undefined),
        decision: (e.decision as EvidenceRound["decision"]) ?? null,
        decisionNote: e.decision_note,
        decidedAt: e.decided_at,
        decidedBy: brief(e.decided_by ? people.get(e.decided_by) : undefined),
      })),
  }));
}

/** Ringkasan progres tindakan per induk: `closed/total` (kolom "Tindakan" di daftar). */
export async function actionProgress(supabase: ServerClient, column: "incident_id" | "finding_id", ids: string[]) {
  const map = new Map<string, { closed: number; total: number }>();
  if (!ids.length) return map;
  const { data } = await supabase.from("pica_actions").select(`${column}, status`).in(column, ids);
  for (const r of (data ?? []) as Record<string, string>[]) {
    const k = r[column];
    const cur = map.get(k) ?? { closed: 0, total: 0 };
    cur.total++;
    if (r.status === "closed") cur.closed++;
    map.set(k, cur);
  }
  return map;
}
