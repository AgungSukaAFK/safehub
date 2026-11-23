"use client";

// Form template checklist: butir = satu baris per butir (maks. 100). Tulis lewat RPC inspection_template_save.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { saveTemplateAction } from "../actions";

export function TemplateForm({
  id,
  initial,
  types,
  categories,
}: {
  id: string | null;
  initial: { name: string; typeCode: string; objectLabel: string; findingCategory: string; isActive: boolean; items: string[] };
  types: SelectOption[];
  categories: SelectOption[];
}) {
  const router = useRouter();
  const online = useOnline();
  const [v, setV] = useState({ ...initial, text: initial.items.join("\n") });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const items = v.text.split("\n").map((t) => t.trim()).filter(Boolean);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const save = async () => {
    setPending(true);
    const res = await saveTemplateAction(id, { type_code: v.typeCode, name: v.name, object_label: v.objectLabel, finding_category: v.findingCategory, is_active: v.isActive, items });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      router.push("/inspeksi/template");
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="col-span-12 mx-auto w-full max-w-3xl space-y-4">
      <Content title={id ? "Ubah Template" : "Template Baru"} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama template" htmlFor="tp-name" required error={err("name")} className="sm:col-span-2">
            <Input id="tp-name" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Jenis inspeksi" htmlFor="tp-type" required error={err("type_code")}>
            <SearchableSelect id="tp-type" value={v.typeCode || null} onValueChange={(x) => set("typeCode", x ?? "")} options={types} placeholder="Pilih jenis" />
          </Field>
          <Field label="Label objek" htmlFor="tp-object" hint="Mis. Nomor APAR. Opsional">
            <Input id="tp-object" value={v.objectLabel} maxLength={60} onChange={(e) => set("objectLabel", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Kategori temuan otomatis" htmlFor="tp-cat" required error={err("finding_category")} hint="Dipakai saat butir tidak sesuai dijadikan temuan">
            <SearchableSelect id="tp-cat" value={v.findingCategory || null} onValueChange={(x) => set("findingCategory", x ?? "")} options={categories} placeholder="Pilih kategori" />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm font-medium">Template aktif</span>
            <Switch checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} aria-label="Template aktif" />
          </label>
        </div>
      </Content>
      <Content title="Butir Checklist" description={`${items.length} butir · satu baris per butir, maks. 100`} size="lg">
        <Field label="Daftar butir" htmlFor="tp-items" error={err("items")} hint="Urutan baris = urutan di checklist. Hapus baris untuk menghapus butir.">
          <Textarea id="tp-items" rows={14} value={v.text} onChange={(e) => set("text", e.target.value)} className="font-mono text-base md:text-sm" />
        </Field>
      </Content>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/inspeksi/template")}>
          Batal
        </Button>
        <Button type="button" onClick={save} disabled={pending || !online || items.length === 0 || !v.name.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan Template
        </Button>
      </div>
    </div>
  );
}
