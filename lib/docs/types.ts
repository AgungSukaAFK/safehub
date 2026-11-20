// Tipe Dokumentasi (frontend-guide §20.3). Semua isi halaman /dokumentasi adalah DATA (lib/docs/content.ts);
// komponennya generik. Mock UI tiap langkah juga data (`MockBlock`), jadi app baru cukup menulis isi.
import type { LucideIcon } from "lucide-react";

/** Kunci peta status yang dipakai app (StatusBadge yang sama dengan halaman asli). */
export type StatusMapKey = "document" | "approval" | "support" | "feedback";

export type RoleId = string;

export type DocRole = {
  id: RoleId;
  label: string;
  /** kalimat di pemilih peran: "Saya Pemohon" */
  pick?: string;
  desc: string;
  icon: LucideIcon;
  /** kelas warna chip (bg/text/border, dengan varian dark) */
  color: string;
  /** false = tidak bisa dipilih di hero (mis. "Sistem") */
  selectable?: boolean;
};

export type MockBlock =
  | { kind: "field"; label: string; value: string; highlight?: boolean }
  | { kind: "row"; title: string; sub?: string; status?: { map: StatusMapKey; value: string }; highlight?: boolean }
  | { kind: "buttons"; items: { label: string; variant?: "primary" | "outline" | "danger"; pulse?: boolean }[] }
  | { kind: "note"; text: string; tone?: "info" | "success" | "warning" }
  | { kind: "notification"; title: string; body: string }
  | { kind: "chat"; text: string; mine?: boolean; name?: string }
  | { kind: "path"; items: { label: string; state: "done" | "current" | "todo" | "rejected" }[] };

export type StepVisual = { window: string; blocks: MockBlock[] };

export type FlowStep = {
  /** label pendek di indikator */
  short: string;
  title: string;
  icon: LucideIcon;
  actors: RoleId[];
  summary: string;
  /** "Menu → Sub menu" */
  menu?: string;
  details: string[];
  status?: { map: StatusMapKey; from?: string; to: string };
  tip?: string;
  visual: StepVisual;
};

export type Flow = { id: string; title: string; subtitle: string; steps: FlowStep[] };

/** Tahap gambaran besar → lompat ke langkah tertentu di sebuah alur. */
export type JourneyStage = { title: string; desc: string; icon: LucideIcon; flow: string; step: number };

export type GlossaryGroup = { title: string; map: StatusMapKey; items: { value: string; desc: string }[] };

export type Faq = { q: string; a: string };

export type DocsContent = {
  intro: { title: string; desc: string };
  roles: DocRole[];
  journey: JourneyStage[];
  flows: Flow[];
  glossary: GlossaryGroup[];
  faq: Faq[];
};
