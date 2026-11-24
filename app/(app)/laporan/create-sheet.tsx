"use client";

// "Buat Laporan": pilih template + periode (site mengikuti pemilih site). Tulis lewat RPC report_create (HSE/admin).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { FormState } from "@/lib/form-state";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { createReportAction } from "./actions";

export function CreateReportSheet({
  siteId,
  siteName,
  templates,
  companies,
  defaultCompany,
  defaultPeriod,
  maxPeriod,
}: {
  siteId: string;
  siteName: string;
  templates: SelectOption[];
  companies: SelectOption[];
  defaultCompany: string | null;
  /** YYYY-MM: bulan lalu (laporan disusun setelah bulan berakhir) */
  defaultPeriod: string;
  /** YYYY-MM: bulan berjalan (batas atas) */
  maxPeriod: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [v, setV] = useState({ template_id: "", period: defaultPeriod, company_code: defaultCompany });
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const submit = async () => {
    setPending(true);
    const res = await createReportAction({ ...v, location_id: siteId });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      router.push(`/laporan/${(res.data as { id: string }).id}`);
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <Plus /> Buat Laporan
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Laporan periode</p>
          <SheetTitle>Buat Laporan</SheetTitle>
          <SheetDescription>{siteName}. Satu laporan = satu site, satu template, satu bulan. Angka diambil dari modul secara langsung.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {companies.length > 1 && (
            <Field label="Perusahaan" htmlFor="rp-company" required error={err("company_code")}>
              <SearchableSelect id="rp-company" value={v.company_code} onValueChange={(x) => setV((p) => ({ ...p, company_code: x }))} options={companies} placeholder="Pilih perusahaan" />
            </Field>
          )}
          <Field label="Template" htmlFor="rp-tpl" required error={err("template_id")}>
            <SearchableSelect id="rp-tpl" value={v.template_id || null} onValueChange={(x) => setV((p) => ({ ...p, template_id: x ?? "" }))} options={templates} placeholder="Pilih template laporan" />
          </Field>
          <Field label="Periode" htmlFor="rp-period" required error={err("period")} hint="Tidak boleh bulan depan.">
            <Input id="rp-period" type="month" value={v.period} max={maxPeriod} onChange={(e) => setV((p) => ({ ...p, period: e.target.value }))} className="text-base md:text-sm" />
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Buat Laporan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
