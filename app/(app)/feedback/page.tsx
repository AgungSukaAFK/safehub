import type { Metadata } from "next";
import { Paperclip } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { safeFromPath } from "@/lib/safe-next-path";
import { latestAppVersion, listMyFeedback } from "@/lib/feedback";
import { FEEDBACK_STATUS, feedbackCategoryLabel } from "@/lib/feedback-rules";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Feedback" };

// Feedback (frontend-guide §20.4): kirim laporan bug / saran + daftar "Feedback saya" dengan status.
export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  await requireAccess("viewer");
  const sp = await searchParams;
  const supabase = await createClient();
  const [mine, version] = await Promise.all([listMyFeedback(supabase), latestAppVersion(supabase)]);

  return (
    <>
      <PageHeader title="Feedback" description="Laporkan bug atau beri saran untuk app ini. Admin app akan menindaklanjuti." />
      <Content size="md" title="Kirim feedback" className="lg:col-span-7">
        <FeedbackForm fromPage={safeFromPath(typeof sp.dari === "string" ? sp.dari : null)} version={version} />
      </Content>
      <Content size="md" title="Feedback saya" description="Status diperbarui admin; Anda mendapat notifikasi saat berubah." className="lg:col-span-5">
        {mine.length ? (
          <ul className="divide-y">
            {mine.map((f) => (
              <li key={f.id} className="space-y-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{feedbackCategoryLabel(f.category, f.categoryOther)}</span>
                  <StatusBadge value={f.status} map={FEEDBACK_STATUS} />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{f.text}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {formatDate(f.createdAt)}
                  {f.files > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="size-3" /> {f.files}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada feedback yang Anda kirim.</p>
        )}
      </Content>
    </>
  );
}
