"use client";

// Sheet form generik untuk entri master/data kecil (karyawan, sertifikat, MCU, permit, mitra, ...): daftar field
// deklaratif → satu Server Action. Validasi zod di action; pesan per field kembali lewat fieldErrors.
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";

export type QuickField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: SelectOption[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  /** field hanya tampil bila fungsi ini mengembalikan true (mis. bergantung isian lain) */
  show?: (values: Record<string, string>) => boolean;
};

export function QuickSheet({
  trigger,
  eyebrow,
  title,
  description,
  fields,
  initial,
  submitLabel = "Simpan",
  onSubmit,
  onDone,
}: {
  trigger: ReactElement;
  eyebrow?: string;
  title: string;
  description?: string;
  fields: QuickField[];
  /** nilai awal per field (string; kosong = "") */
  initial?: Record<string, string | number | null | undefined>;
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<FormState>;
  /** dipanggil setelah sukses (mis. router.push); default: refresh halaman */
  onDone?: (res: FormState) => void;
}) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, String(initial?.[f.name] ?? "")])));
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const submit = async () => {
    setPending(true);
    const res = await onSubmit(v);
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      if (onDone) onDone(res);
      else router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          {eyebrow && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {fields
            .filter((f) => !f.show || f.show(v))
            .map((f) => {
              const id = `qs-${f.name}`;
              const set = (val: string) => setV((p) => ({ ...p, [f.name]: val }));
              return (
                <Field key={f.name} label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={err(f.name)}>
                  {f.type === "select" ? (
                    <SearchableSelect id={id} value={v[f.name] || null} onValueChange={(x) => set(x ?? "")} options={f.options ?? []} placeholder={f.placeholder ?? "Pilih"} />
                  ) : f.type === "textarea" ? (
                    <Textarea id={id} rows={3} value={v[f.name]} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} className="text-base md:text-sm" />
                  ) : (
                    <Input
                      id={id}
                      type={f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      value={v[f.name]}
                      maxLength={f.maxLength}
                      placeholder={f.placeholder}
                      onChange={(e) => set(e.target.value)}
                      className="text-base md:text-sm"
                    />
                  )}
                </Field>
              );
            })}
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} {submitLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
