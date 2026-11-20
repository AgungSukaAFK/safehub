// CONTOH boilerplate. Excel satu dokumen: sheet Pengajuan (ringkasan), Barang, Approval.
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { buildWorkbook, excelFileName, xlsxResponse } from "@/lib/excel";
import { getPengajuanDetail, type PengajuanItem } from "@/lib/pengajuan";
import { printFileName } from "@/lib/print";
import { APPROVAL_STEP_STATUS, APPROVAL_TYPE_LABELS, DOCUMENT_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { ApprovalStepView } from "@/lib/approval-types";

export async function GET(_req: Request, ctx: RouteContext<"/pengajuan/[id]/ekspor">) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Tidak ditemukan.", { status: 404 });
  const supabase = await createClient();
  const d = await getPengajuanDetail(supabase, id, access.userId);
  if (!d) return new Response("Tidak ditemukan.", { status: 404 });

  const info: [string, string | number | null][] = [
    ["Nomor", d.code ?? "Draft"],
    ["Judul", d.title],
    ["Status", DOCUMENT_STATUS[d.status]?.label ?? d.status],
    ["Perusahaan", d.companyCode],
    ["Departemen", d.departmentName],
    ["Pemohon", d.requester?.name ?? null],
    ["Dibuat", d.createdAt],
    ["Dibutuhkan", d.neededDate],
    ["Keterangan", d.description],
    ["Total (Rp)", d.total],
  ];
  const buffer = await buildWorkbook(
    [
      { name: "Pengajuan", columns: [{ header: "Kolom", value: (r: (typeof info)[number]) => r[0] }, { header: "Nilai", value: (r: (typeof info)[number]) => r[1] }], rows: info },
      {
        name: "Barang",
        rows: d.items,
        columns: [
          { header: "No", type: "number", value: (r: PengajuanItem) => r.lineNo },
          { header: "Nama Barang", value: (r: PengajuanItem) => r.itemName },
          { header: "Part Number", value: (r: PengajuanItem) => r.partNumber },
          { header: "Jumlah", type: "number", value: (r: PengajuanItem) => r.qty },
          { header: "Satuan", value: (r: PengajuanItem) => r.unit },
          { header: "Harga Satuan (Rp)", type: "money", value: (r: PengajuanItem) => r.unitPrice },
          { header: "Subtotal (Rp)", type: "money", value: (r: PengajuanItem) => r.subtotal },
          { header: "Catatan", value: (r: PengajuanItem) => r.note },
        ],
      },
      {
        name: "Approval",
        rows: [...d.steps, ...d.previousRounds.flat()],
        columns: [
          { header: "Putaran", type: "number", value: (r: ApprovalStepView) => r.round },
          { header: "Langkah", type: "number", value: (r: ApprovalStepView) => r.stepNo },
          { header: "Tipe", value: (r: ApprovalStepView) => APPROVAL_TYPE_LABELS[r.type] ?? r.type },
          { header: "Approver", value: (r: ApprovalStepView) => r.approver.name },
          { header: "Status", value: (r: ApprovalStepView) => APPROVAL_STEP_STATUS[r.status]?.label ?? r.status },
          { header: "Waktu", type: "datetime", value: (r: ApprovalStepView) => r.decidedAt },
          { header: "Catatan", value: (r: ApprovalStepView) => r.note },
        ],
      },
    ],
    { title: `Pengajuan ${d.code ?? d.title}`, scope: d.companyCode, filters: "Satu dokumen", exportedBy: { name: access.profile.fullName, email: access.email } },
  );
  await cctv({ category: "export", action: "export.excel", summary: `Mengunduh Excel pengajuan ${d.code ?? "draft"}`, entity: "pengajuan", recordId: d.id, recordLabel: d.code ?? undefined });
  return xlsxResponse(buffer, excelFileName(printFileName(d.code ?? "Pengajuan-Draft")));
}
