import { redirect } from "next/navigation";

// "Approval Saya" digabung ke Tugas Saya (rancangan §4.11). Tautan lama (notifikasi, bookmark) tetap jalan.
export default function ApprovalPage() {
  redirect("/tugas");
}
