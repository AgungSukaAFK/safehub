// Blok Beranda "Isu Terbuka" (D8): temuan bersumber Rapat/MOM yang belum ditutup. Sumber sama dengan bagian Isu Terbuka di Laporan Periode.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Content } from "@/components/list/content";
import { formatDate } from "@/lib/format";
import { todayWibIso } from "@/lib/k3";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function IssuesBlock({ supabase, site }: { supabase: ServerClient; site: SiteChoice }) {
  const today = todayWibIso();
  let q = supabase.from("findings").select("id, code, title, due_date, status").eq("source_kind", "meeting").neq("status", "closed").order("due_date").limit(200);
  if (site) q = q.eq("location_id", site);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const overdue = rows.filter((r) => r.due_date < today).length;
  return (
    <Content
      className="col-span-12 min-w-0"
      title="Isu Terbuka"
      description="Temuan bersumber Rapat/MOM yang belum ditutup"
      cardAction={
        <Link href="/temuan?sumber=meeting" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Buka di Temuan <ArrowRight className="size-4" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Tidak ada isu terbuka.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            <strong className="text-xl tabular-nums">{rows.length}</strong> terbuka
            {overdue > 0 && <span className="ml-2 font-medium text-red-700 dark:text-red-400">· {overdue} lewat due date</span>}
          </p>
          <ul className="space-y-1 text-sm">
            {rows.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b py-1">
                <Link href={`/temuan/${r.id}`} className="underline underline-offset-2">{r.code} · {r.title}</Link>
                <span className={cn("text-muted-foreground", r.due_date < today && "font-medium text-red-700 dark:text-red-400")}>Due {formatDate(r.due_date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Content>
  );
}
