"use server";

// Master Data (rancangan §4.13): CRUD generik admin untuk master milik app. Tulis langsung ke tabel
// dengan sesi user; RLS (admin) + trigger guard/log menjaga di DB. Log & CCTV kategori config ditulis
// trigger log_changes. Tidak ada hapus: nonaktifkan.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { isEditableKind, MASTER_CONFIG, MASTER_SCHEMAS, MASTER_TABLES } from "@/lib/master-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export async function saveMasterAction(kind: string, id: string | null, input: Record<string, unknown>): Promise<FormState> {
  if (!(await actionAccess("admin"))) return NOT_ALLOWED;
  if (!isEditableKind(kind)) return fail("Jenis master ini tidak bisa diubah di app.");
  if (id !== null && !isUuid(id)) return NOT_ALLOWED;

  const parsed = MASTER_SCHEMAS[kind].safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const t = MASTER_TABLES[kind];
  const values: Record<string, unknown> = { ...parsed.data };
  if (id) delete values.code; // kode tetap (guard DB juga menolak)
  else if (t.itemKind) values.kind = t.itemKind;

  const supabase = await createClient();
  const q = supabase.from(t.table);
  const { data, error } = id
    ? await q.update(values as never).eq("id", id).select("id")
    : await q.insert(values as never).select("id");
  if (error) {
    if (error.code === "23505") return fail(`${MASTER_CONFIG[kind].label} dengan nama/kode ini sudah ada.`, { name: ["Sudah dipakai"] });
    return dbError(error);
  }
  if (!data?.length) return fail("Perubahan tidak tersimpan. Muat ulang halaman lalu coba lagi.");
  revalidatePath("/master");
  return ok(id ? `${MASTER_CONFIG[kind].label} diperbarui.` : `${MASTER_CONFIG[kind].label} ditambahkan.`);
}
