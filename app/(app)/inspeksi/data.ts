// Pilihan pemeriksa/PIC untuk halaman inspeksi: pengguna aktif app dengan fungsi yang boleh memeriksa.
import "server-only";
import type { SelectOption } from "@/components/form/searchable-select";
import { getK3People } from "@/lib/k3";
import type { ServerClient } from "@/lib/supabase/server";

/** Semua pengguna yang bisa dipilih sebagai pemeriksa (RPC memeriksa akses app; fungsi ditampilkan di deskripsi). */
export async function getInspeksiPeopleForPage(supabase: ServerClient): Promise<SelectOption[]> {
  const people = await getK3People(supabase);
  return people.map((p) => ({ value: p.value, label: p.label, description: p.description }));
}
