"use client";

// Tab Klasifikasi & Dampak: dampak (baca semua yang berhak), cedera & perawatan (TERBATAS: HSE/HR),
// kerugian (komersial), APD. HSE mengubah lewat satu form (RPC incident_classify).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Field } from "@/components/form-bits";
import { CurrencyInput } from "@/components/form/currency-input";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { StatusBadge } from "@/components/detail/status-badge";
import { RestrictedData } from "@/components/restricted-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/format";
import type { KejadianDetail } from "@/lib/kejadian";
import { formatDate } from "@/lib/format";
import { BODY_PARTS, ILLNESSES, INJURIES, INJURY_CLASS_LABEL, INJURY_CLASSES, OCCUPATIONAL, PPE_ITEMS, SHIFTS, TREATMENT_ITEMS, TREATMENT_LABEL, TREATMENT_REFERRALS, TREATMENTS } from "@/lib/kejadian-rules";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { classifyIncidentAction } from "../actions";
import type { DetailMasters } from "./kejadian-detail";

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "-" : String(v));

export function ClassifyPanel({ doc, masters, canEdit }: { doc: KejadianDetail; masters: DetailMasters; canEdit: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const [editing, setEditing] = useState(doc.status === "reported" && canEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const r = doc.restricted;
  const [v, setV] = useState({
    category: doc.category ?? doc.reportedCategory,
    injury_class: doc.injuryClass ?? "",
    severity: doc.severity ?? "",
    potential_severity: doc.potentialSeverity ?? "",
    ppe: doc.ppe,
    damage_description: doc.damageDescription ?? "",
    estimated_cost: doc.estimatedCost != null ? String(doc.estimatedCost) : "",
    injury_type: r?.injuryType ?? "",
    body_parts: r?.bodyParts ?? [],
    treatment: r?.treatment ?? "",
    facility: r?.facility ?? "",
    lost_days: r?.lostDays != null ? String(r.lostDays) : "",
    restricted_days: r?.restrictedDays != null ? String(r.restrictedDays) : "",
    shift: doc.shift ?? "",
    overtime: doc.overtime == null ? "" : doc.overtime ? "true" : "false",
    activity: doc.activity ?? "",
    occupational: doc.occupational ?? "",
    victim_employee_id: doc.victim?.id ?? "",
    illnesses: r?.illnesses ?? [],
    injuries: r?.injuries ?? [],
    treatment_items: r?.treatmentItems ?? [],
    victim_address: r?.victimAddress ?? "",
    victim_phone: r?.victimPhone ?? "",
    victim_birth_date: r?.victimBirthDate ?? "",
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const active = (list: DetailMasters["categories"], current: string | null) => list.filter((c) => c.isActive || c.value === current).map((c) => ({ value: c.value, label: c.label }));
  const label = (list: { value: string; label: string }[], x: string | null) => list.find((c) => c.value === x)?.label ?? x;
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const save = async () => {
    setSaving(true);
    const res = await classifyIncidentAction(doc.id, {
      category: v.category,
      injury_class: v.injury_class,
      severity: v.severity,
      potential_severity: v.potential_severity,
      ppe: v.ppe,
      damage_description: v.damage_description,
      estimated_cost: num(v.estimated_cost),
      shift: v.shift,
      overtime: v.overtime === "" ? null : v.overtime === "true",
      activity: v.activity,
      occupational: (v.occupational || null) as "occupational" | "re_treatment" | "non_occupational" | null,
      victim_employee_id: v.victim_employee_id || null,
      restricted: {
        injury_type: v.injury_type,
        body_parts: v.body_parts,
        treatment: v.treatment || null,
        facility: v.facility,
        lost_days: num(v.lost_days),
        restricted_days: num(v.restricted_days),
        illnesses: v.illnesses,
        injuries: v.injuries,
        treatment_items: v.treatment_items,
        victim_address: v.victim_address,
        victim_phone: v.victim_phone,
        victim_birth_date: v.victim_birth_date || null,
      },
    });
    setSaving(false);
    setErrors(res.fieldErrors ?? {});
    if (res.status === "ok") {
      toast.success(res.message);
      setEditing(false);
      router.refresh();
    } else toast.error(res.message);
  };
  const e = (k: string) => errors[k]?.[0];

  const header = canEdit && (
    <div className="flex justify-end">
      {editing ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            <X /> Batal
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !online}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} Simpan Klasifikasi
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> {doc.category ? "Ubah" : "Klasifikasi"}
        </Button>
      )}
    </div>
  );

  if (editing)
    return (
      <>
        {header}
        {doc.status === "reported" && <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Kategori dari pelapor: <strong>{label(masters.categories, doc.reportedCategory)}</strong>. Kategori final yang Anda pilih dipakai untuk KPI.</p>}
        <Content title="Klasifikasi Dampak" size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategori final" htmlFor="cl-cat" required error={e("category")}>
              <SearchableSelect id="cl-cat" value={v.category || null} onValueChange={(x) => set("category", x ?? "")} options={active(masters.categories, doc.category)} placeholder="Pilih kategori" />
            </Field>
            <Field label="Kelas cedera" htmlFor="cl-class" required error={e("injury_class")}>
              <SearchableSelect id="cl-class" value={v.injury_class || null} onValueChange={(x) => set("injury_class", x ?? "")} options={INJURY_CLASSES.map((c) => ({ value: c.value, label: c.label }))} placeholder="Pilih kelas" />
            </Field>
            <Field label="Tingkat keparahan (aktual)" htmlFor="cl-sev" required error={e("severity")}>
              <SearchableSelect id="cl-sev" value={v.severity || null} onValueChange={(x) => set("severity", x ?? "")} options={active(masters.risks, doc.severity)} placeholder="Pilih" />
            </Field>
            <Field label="Potensi keparahan" htmlFor="cl-pot" required error={e("potential_severity")}>
              <SearchableSelect id="cl-pot" value={v.potential_severity || null} onValueChange={(x) => set("potential_severity", x ?? "")} options={active(masters.risks, doc.potentialSeverity)} placeholder="Pilih" />
            </Field>
          </div>
        </Content>
        <Content title="Data Kejadian & Korban" description="Kolom Laporan Investigasi (GMI.MR.F.013-001)." size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Karyawan korban (Manpower)" htmlFor="cl-victim" hint="No. karyawan, jabatan, tanggal masuk, dan lama bekerja diambil dari Manpower." className="sm:col-span-2">
              <SearchableSelect id="cl-victim" value={v.victim_employee_id || null} onValueChange={(x) => set("victim_employee_id", x ?? "")} options={masters.employees} placeholder="Pilih karyawan (opsional)" />
            </Field>
            <Field label="Shift" htmlFor="cl-shift">
              <Input id="cl-shift" list="cl-shift-list" value={v.shift} maxLength={40} onChange={(x) => set("shift", x.target.value)} className="text-base md:text-sm" />
              <datalist id="cl-shift-list">{SHIFTS.map((x) => <option key={x} value={x} />)}</datalist>
            </Field>
            <Field label="Overtime" htmlFor="cl-ot">
              <select id="cl-ot" value={v.overtime} onChange={(x) => set("overtime", x.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Belum diisi</option>
                <option value="true">Ya</option>
                <option value="false">Tidak</option>
              </select>
            </Field>
            <Field label="Apa yang dilakukan korban saat kejadian" htmlFor="cl-act" className="sm:col-span-2">
              <Textarea id="cl-act" rows={2} maxLength={1000} value={v.activity} onChange={(x) => set("activity", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Occupational" htmlFor="cl-occ">
              <select id="cl-occ" value={v.occupational} onChange={(x) => set("occupational", x.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Belum diisi</option>
                {OCCUPATIONAL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </Content>
        <RestrictedData functions={["hse", "hr"]} restricted={false} title="Cedera & Perawatan">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipGroup legend="Sakit" options={ILLNESSES} value={v.illnesses} onChange={(x) => set("illnesses", x)} />
            <ChipGroup legend="Cidera" options={INJURIES} value={v.injuries} onChange={(x) => set("injuries", x)} />
            <ChipGroup legend="Treatment" options={[...TREATMENT_ITEMS, ...TREATMENT_REFERRALS]} value={v.treatment_items} onChange={(x) => set("treatment_items", x)} />
            <Field label="Jenis cedera" htmlFor="cl-inj" className="sm:col-span-2">
              <Input id="cl-inj" value={v.injury_type} maxLength={200} onChange={(x) => set("injury_type", x.target.value)} placeholder="Contoh: Memar dan luka ringan" className="text-base md:text-sm" />
            </Field>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Bagian tubuh</legend>
              <div className="flex flex-wrap gap-1.5">
                {BODY_PARTS.map((b) => {
                  const on = v.body_parts.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("body_parts", on ? v.body_parts.filter((x) => x !== b) : [...v.body_parts, b])}
                      className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent")}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Perawatan" htmlFor="cl-treat">
              <SearchableSelect id="cl-treat" value={v.treatment || null} onValueChange={(x) => set("treatment", x ?? "")} options={TREATMENTS.map((t) => ({ value: t.value, label: t.label }))} placeholder="Pilih" />
            </Field>
            <Field label="Fasilitas" htmlFor="cl-fac">
              <Input id="cl-fac" value={v.facility} maxLength={200} onChange={(x) => set("facility", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Hari kerja hilang" htmlFor="cl-lost">
              <Input id="cl-lost" type="number" inputMode="numeric" min={0} value={v.lost_days} onChange={(x) => set("lost_days", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Hari kerja terbatas" htmlFor="cl-rest">
              <Input id="cl-rest" type="number" inputMode="numeric" min={0} value={v.restricted_days} onChange={(x) => set("restricted_days", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">Data pribadi korban di bawah boleh dikosongkan; bagian itu bisa diisi tangan setelah laporan dicetak.</p>
            <Field label="Alamat korban" htmlFor="cl-addr" className="sm:col-span-2">
              <Input id="cl-addr" value={v.victim_address} maxLength={300} onChange={(x) => set("victim_address", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="No. telepon rumah/keluarga" htmlFor="cl-phone">
              <Input id="cl-phone" value={v.victim_phone} maxLength={40} onChange={(x) => set("victim_phone", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Tanggal lahir" htmlFor="cl-dob">
              <Input id="cl-dob" type="date" value={v.victim_birth_date} onChange={(x) => set("victim_birth_date", x.target.value)} className="text-base md:text-sm" />
            </Field>
          </div>
        </RestrictedData>
        <Content title="Kerusakan / Kerugian" size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deskripsi" htmlFor="cl-dmg" className="sm:col-span-2">
              <Textarea id="cl-dmg" rows={3} maxLength={1000} value={v.damage_description} onChange={(x) => set("damage_description", x.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Estimasi biaya" htmlFor="cl-cost">
              <CurrencyInput id="cl-cost" value={v.estimated_cost} onValueChange={(x) => set("estimated_cost", x)} />
            </Field>
          </div>
        </Content>
        <Content title="APD yang Dipakai" size="lg">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PPE_ITEMS.map((p) => {
              const on = !!v.ppe[p.value];
              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("ppe", { ...v.ppe, [p.value]: !on })}
                  className={cn("flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors", on ? "border-green-600 bg-green-50 dark:bg-green-950/30" : "hover:bg-accent")}
                >
                  <span>{p.label}</span>
                  <span className={cn("text-xs font-medium", on ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{on ? "✓ Dipakai" : "✕ Tidak dipakai"}</span>
                </button>
              );
            })}
          </div>
        </Content>
      </>
    );

  // ---------------------------------------------------------------- baca
  const risk = (x: string | null) => (x ? <StatusBadge value={x} map={masters.riskMap} /> : "-");
  return (
    <>
      {header}
      {!doc.category && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Belum diklasifikasi HSE. Kategori dari pelapor: {label(masters.categories, doc.reportedCategory)}.</p>}
      <Content title="Klasifikasi Dampak" size="lg">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Kategori final" value={doc.category ? label(masters.categories, doc.category) : "-"} />
          <Item label="Kelas cedera" value={doc.injuryClass ? INJURY_CLASS_LABEL[doc.injuryClass] : "-"} />
          <Item label="Tingkat keparahan" value={risk(doc.severity)} />
          <Item label="Potensi keparahan" value={risk(doc.potentialSeverity)} />
        </dl>
      </Content>
      <Content title="Data Kejadian & Korban" size="lg">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Karyawan korban" value={doc.victim ? `${doc.victim.name} · ${doc.victim.code} · ${doc.victim.jobTitle}` : "-"} />
          <Item label="Shift / Overtime" value={`${dash(doc.shift)} / ${doc.overtime == null ? "-" : doc.overtime ? "Ya" : "Tidak"}`} />
          <Item label="Aktivitas saat kejadian" value={dash(doc.activity)} />
          <Item label="Occupational" value={OCCUPATIONAL.find((o) => o.value === doc.occupational)?.label ?? "-"} />
        </dl>
      </Content>
      <RestrictedData functions={["hse", "hr"]} restricted={!doc.canSeeRestricted} title="Cedera & Perawatan">
        {r ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="Jenis cedera" value={dash(r.injuryType)} />
            <Item label="Bagian tubuh" value={r.bodyParts.length ? r.bodyParts.join(", ") : "-"} />
            <Item label="Perawatan" value={r.treatment ? TREATMENT_LABEL[r.treatment] : "-"} />
            <Item label="Fasilitas" value={dash(r.facility)} />
            <Item label="Hari kerja hilang" value={r.lostDays != null ? `${r.lostDays} hari` : "-"} />
            <Item label="Hari kerja terbatas" value={r.restrictedDays != null ? `${r.restrictedDays} hari` : "-"} />
            <Item label="Sakit" value={r.illnesses.length ? r.illnesses.join(", ") : "-"} />
            <Item label="Cidera" value={r.injuries.length ? r.injuries.join(", ") : "-"} />
            <Item label="Treatment" value={r.treatmentItems.length ? r.treatmentItems.join(", ") : "-"} />
            <Item label="Data pribadi korban" value={[r.victimAddress, r.victimPhone, r.victimBirthDate && `lahir ${formatDate(r.victimBirthDate)}`].filter(Boolean).join(" · ") || "Belum diisi (isi tangan di cetakan)"} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data cedera.</p>
        )}
      </RestrictedData>
      <RestrictedData functions={["hse", "pjo", "manajemen", "scm"]} restricted={!doc.canSeeCost} title="Kerusakan / Kerugian">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Item label="Deskripsi" value={dash(doc.damageDescription)} />
          </div>
          <Item label="Estimasi biaya" value={doc.estimatedCost != null ? formatRupiah(doc.estimatedCost) : "-"} />
        </dl>
      </RestrictedData>
      <Content title="APD yang Dipakai" size="lg">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PPE_ITEMS.map((p) => {
            const known = p.value in doc.ppe;
            const on = !!doc.ppe[p.value];
            return (
              <li key={p.value} className={cn("flex items-center justify-between gap-2 rounded-lg border p-3 text-sm", on && "border-green-600/50 bg-green-50 dark:bg-green-950/30")}>
                <span>{p.label}</span>
                <span className={cn("text-xs font-medium", on ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{!known ? "Belum dicatat" : on ? "✓ Dipakai" : "✕ Tidak dipakai"}</span>
              </li>
            );
          })}
        </ul>
      </Content>
    </>
  );
}

function ChipGroup({ legend, options, value, onChange }: { legend: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold [overflow-wrap:anywhere] whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
