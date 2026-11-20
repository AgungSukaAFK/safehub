/** Hasil Server Action (aman diimpor client). Pembuatnya ada di lib/action-state.ts (server). */
export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: Record<string, unknown>;
  /** Penanda waktu supaya pesan yang sama tetap memicu toast lagi */
  ts: number;
};

export const INITIAL_FORM_STATE: FormState = { status: "idle", ts: 0 };
