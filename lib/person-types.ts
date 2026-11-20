/** Data orang yang aman dikirim ke client (kartu profil, avatar, approval, log). */
export type Person = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  company: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  location: string | null;
};

/** Format nilai kolom di Riwayat Aktivitas (FIELD_LABELS per domain). */
export type FieldFormat = "text" | "rupiah" | "number" | "date" | "datetime" | "person" | "status" | "list" | "boolean";

export type FieldLabel = {
  label: string;
  format?: FieldFormat;
  /** untuk format "status": peta nilai → label */
  statuses?: Record<string, { label: string }>;
};

export type LogEntry = {
  id: number;
  at: string;
  action: string;
  note: string | null;
  changes: Record<string, unknown> | null;
  actor: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};
