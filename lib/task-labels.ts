// Label tugas workflow di Tugas Saya (aman client). Satu baris per `kind` dari my_tasks().
import { INCIDENT_STATUS } from "@/lib/kejadian-rules";
import { INSPECTION_STATUS } from "@/lib/inspeksi-rules";
import { ACTION_STATUS } from "@/lib/pica-rules";
import type { StatusDef } from "@/lib/status";

export const TASK_KIND_LABEL: Record<string, string> = {
  incident_classify: "Klasifikasi kejadian",
  incident_investigate: "Investigasi kejadian",
  incident_review: "Review kejadian",
  pica_do: "Kerjakan tindakan",
  pica_verify: "Verifikasi bukti",
  inspection_scheduled: "Inspeksi terjadwal",
  inspection_do: "Isi checklist inspeksi",
  inspection_verify: "Verifikasi inspeksi",
};

/** Peta status per jenis referensi (StatusBadge). */
export const TASK_STATUS_MAP: Record<string, Record<string, StatusDef>> = {
  incidents: INCIDENT_STATUS,
  pica_actions: ACTION_STATUS,
  inspections: INSPECTION_STATUS,
};
