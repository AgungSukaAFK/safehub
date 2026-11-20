import type { Metadata } from "next";
import { DocsView } from "@/components/docs/docs-view";
import { requireAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "Dokumentasi" };

// Dokumentasi (frontend-guide §20.3): data-driven. Isi per app di lib/docs/content.ts.
// DOCS berisi komponen ikon, jadi diimpor langsung oleh DocsView (client), tidak dioper dari server.
export default async function DokumentasiPage() {
  await requireAccess("viewer");
  return <DocsView />;
}
