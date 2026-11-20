import type { Metadata } from "next";
import { NoOffline } from "@/components/pwa/pwa-support";
import Link from "next/link";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { countFeedbackByStatus, feedbackChips, listFeedback, parseFeedbackParams } from "@/lib/feedback";
import { FEEDBACK_STATUS, FEEDBACK_STATUSES } from "@/lib/feedback-rules";
import { STATUS_CLASSES } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";
import { FeedbackAdmin } from "./feedback-admin";

export const metadata: Metadata = { title: "Kelola Feedback" };

// Kelola Feedback (admin app): hitungan per status di atas list standar.
export default async function FeedbackKelolaPage({ searchParams }: PageProps<"/feedback/kelola">) {
  await requireAccess("admin");
  const sp = await searchParams;
  const f = parseFeedbackParams(sp);
  const supabase = await createClient();
  const [{ rows, total }, counts] = await Promise.all([listFeedback(supabase, f), countFeedbackByStatus(supabase)]);
  const chips = feedbackChips(f);
  const openId = typeof sp.id === "string" && isUuid(sp.id) ? sp.id : null;

  return (
    <>
      {/* data orang lain / percakapan pribadi: jangan disimpan untuk offline */}
      <NoOffline />
      <PageHeader title="Kelola Feedback" description="Laporan bug dan saran dari pengguna app ini." />
      <div className="col-span-12 grid grid-cols-3 gap-3">
        {FEEDBACK_STATUSES.map((s) => {
          const active = f.status.length === 1 && f.status[0] === s;
          return (
            <Link
              key={s}
              href={active ? "/feedback/kelola" : `/feedback/kelola?status=${s}`}
              aria-current={active ? "true" : undefined}
              className={cn("rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40", active && "ring-2 ring-primary")}
            >
              <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", STATUS_CLASSES[FEEDBACK_STATUS[s].color].soft)}>{FEEDBACK_STATUS[s].label}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{counts[s]}</span>
            </Link>
          );
        })}
      </div>
      <Content>
        <FeedbackAdmin rows={rows} total={total} page={f.page} size={f.size} chips={chips} filtered={!!(f.q || chips.length)} openId={openId} />
      </Content>
    </>
  );
}
