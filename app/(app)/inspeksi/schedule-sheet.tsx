"use client";

// "Jadwalkan Inspeksi" (prototipe ScheduleModal) sebagai Sheet. Tulis lewat Server Action → RPC
// inspection_schedule (DB memeriksa fungsi HSE/Pengawas/PJO, area dalam site, pemeriksa aktif).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { FormState } from "@/lib/form-state";
import { nowWibLocal } from "@/lib/kejadian-rules";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { scheduleInspectionAction } from "./actions";

export type TemplateOption = { id: string; name: string; typeCode: string; objectLabel: string | null };

/** `datetime-local` WIB → ISO dengan offset +07:00 (disimpan UTC di DB). */
const wibToIso = (v: string) => (v ? `${v.length === 16 ? `${v}:00` : v}+07:00` : "");

export function ScheduleSheet({
  siteId,
  siteName,
  templates,
  areas,
  people,
  companies,
  defaultCompany,
  defaultInspectorId,
  defaultDate,
}: {
  siteId: string;
  siteName: string;
  templates: TemplateOption[];
  areas: SelectOption[];
  people: SelectOption[];
  companies: SelectOption[];
  defaultCompany: string | null;
  defaultInspectorId: string | null;
  /** YYYY-MM-DD, tanggal awal pemilih */
  defaultDate: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const [v, setV] = useState({
    template_id: "",
    area_id: "",
    planned_at: `${defaultDate}T08:00`,
    inspector_id: defaultInspectorId ?? "",
    object_text: "",
    company_code: defaultCompany,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const tpl = templates.find((t) => t.id === v.template_id);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const submit = async () => {
    setPending(true);
    const res = await scheduleInspectionAction({ ...v, location_id: siteId, planned_at: wibToIso(v.planned_at) });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      setV((p) => ({ ...p, template_id: "", object_text: "" }));
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <CalendarPlus /> Jadwalkan Inspeksi
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Jadwal baru</p>
          <SheetTitle>Jadwalkan Inspeksi</SheetTitle>
          <SheetDescription>{siteName}. Pemeriksa menerima notifikasi dan tugas di Tugas Saya.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {companies.length > 1 && (
            <Field label="Perusahaan" htmlFor="sc-company" required error={err("company_code")}>
              <SearchableSelect id="sc-company" value={v.company_code} onValueChange={(x) => set("company_code", x)} options={companies} placeholder="Pilih perusahaan" />
            </Field>
          )}
          <Field label="Jenis inspeksi" htmlFor="sc-tpl" required error={err("template_id")}>
            <SearchableSelect id="sc-tpl" value={v.template_id || null} onValueChange={(x) => set("template_id", x ?? "")} options={templates.map((t) => ({ value: t.id, label: t.name }))} placeholder="Pilih jenis inspeksi" />
          </Field>
          <Field label="Lokasi" htmlFor="sc-area" required error={err("area_id")}>
            <SearchableSelect id="sc-area" value={v.area_id || null} onValueChange={(x) => set("area_id", x ?? "")} options={areas} placeholder="Pilih lokasi" />
          </Field>
          <Field label={tpl?.objectLabel ?? "Objek"} htmlFor="sc-object" hint="Opsional. Contoh: APAR #07, LV-12" error={err("object_text")}>
            <Input id="sc-object" value={v.object_text} maxLength={120} onChange={(e) => set("object_text", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Tanggal & waktu" htmlFor="sc-when" required error={err("planned_at")}>
            <Input id="sc-when" type="datetime-local" value={v.planned_at} min={nowWibLocal().slice(0, 10) + "T00:00"} onChange={(e) => set("planned_at", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Pemeriksa" htmlFor="sc-insp" required error={err("inspector_id")}>
            <SearchableSelect id="sc-insp" value={v.inspector_id || null} onValueChange={(x) => set("inspector_id", x ?? "")} options={people} placeholder="Pilih pemeriksa" />
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan Jadwal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
