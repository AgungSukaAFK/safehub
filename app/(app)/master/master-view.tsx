"use client";

// Tampilan Master Data generik: tabel ringkas + dialog tambah/ubah dari MASTER_CONFIG. Jumlah baris
// master kecil (puluhan), jadi tanpa paginasi/kit list.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Info, Loader2, Pencil, Plus } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { Field } from "@/components/form-bits";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { MasterOptions, MasterRow, MasterValue } from "@/lib/master";
import { MASTER_CONFIG, MASTER_FIELD_LABELS, MASTER_TABLES, isEditableKind, type MasterField, type MasterKind } from "@/lib/master-rules";
import type { FieldLabel } from "@/lib/person-types";
import { STATUS_CLASSES, type StatusColor } from "@/lib/status";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveMasterAction } from "./actions";

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", !active && "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground/50")} />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function optionsOf(f: { options?: { value: string; label: string }[]; optionsFrom?: "sites" | "companies" }, o: MasterOptions) {
  return f.options ?? (f.optionsFrom ? o[f.optionsFrom] : []);
}

function display(key: string, v: MasterValue, col: { options?: { value: string; label: string }[]; optionsFrom?: "sites" | "companies" }, o: MasterOptions) {
  if (v === null || v === "") return <span className="text-muted-foreground">-</span>;
  if (key === "color") {
    const label = optionsOf(col, o).find((x) => x.value === v)?.label ?? String(v);
    return <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", STATUS_CLASSES[v as StatusColor]?.soft)}>{label}</span>;
  }
  if (key === "code") return <span className="font-mono text-xs">{String(v)}</span>;
  const opts = optionsOf(col, o);
  return opts.length ? (opts.find((x) => x.value === v)?.label ?? String(v)) : String(v);
}

export function MasterView({ kind, rows, options }: { kind: MasterKind; rows: MasterRow[]; options: MasterOptions }) {
  const cfg = MASTER_CONFIG[kind];
  const [editing, setEditing] = useState<MasterRow | "new" | null>(null);
  const logEntity = isEditableKind(kind) ? MASTER_TABLES[kind].table : null;

  const fieldLabels: Record<string, FieldLabel> = {
    ...MASTER_FIELD_LABELS,
    location_id: { label: "Site", format: "status", statuses: Object.fromEntries(options.sites.map((s) => [s.value, { label: s.label }])) },
  };

  return (
    <Content
      title={cfg.label}
      description={cfg.description}
      cardAction={
        cfg.editable && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Tambah
          </Button>
        )
      }
    >
      {cfg.sourceNote && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {cfg.sourceNote}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              {cfg.columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead className="w-24">Status</TableHead>
              {cfg.editable && <TableHead className="w-24 text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={cfg.columns.length + 3} className="py-8 text-center text-muted-foreground">
                  Belum ada data.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className={cn(!r.isActive && "opacity-70")}>
                <TableCell className="font-medium">{r.name}</TableCell>
                {cfg.columns.map((c) => (
                  <TableCell key={c.key}>{display(c.key, r.values[c.key] ?? null, c, options)}</TableCell>
                ))}
                <TableCell>
                  <ActiveBadge active={r.isActive} />
                </TableCell>
                {cfg.editable && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {logEntity && (
                        <ActivityLogDialog
                          entity={logEntity}
                          recordId={r.id}
                          fieldLabels={fieldLabels}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Riwayat ${r.name}`}>
                              <History />
                            </Button>
                          }
                        />
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${r.name}`} onClick={() => setEditing(r)}>
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && <MasterDialog key={editing === "new" ? "new" : editing.id} kind={kind} row={editing === "new" ? null : editing} options={options} onClose={() => setEditing(null)} />}
    </Content>
  );
}

function MasterDialog({ kind, row, options, onClose }: { kind: MasterKind; row: MasterRow | null; options: MasterOptions; onClose: () => void }) {
  const cfg = MASTER_CONFIG[kind];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, MasterValue>>(() => {
    const init: Record<string, MasterValue> = {};
    for (const f of cfg.fields) init[f.name] = row?.values[f.name] ?? (f.name === "sort_order" ? 0 : (optionsOf(f, options).length === 1 ? optionsOf(f, options)[0].value : ""));
    return init;
  });
  const [active, setActive] = useState(row?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (name: string, v: MasterValue) => setValues((p) => ({ ...p, [name]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveMasterAction(kind, row?.id ?? null, { ...values, is_active: active });
      if (res.status !== "ok") {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.message ?? "Gagal menyimpan.");
      }
      toast.success(res.message ?? "Tersimpan.");
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{row ? `Ubah ${cfg.label}` : `Tambah ${cfg.label}`}</DialogTitle>
            <DialogDescription>{row ? row.name : cfg.description}</DialogDescription>
          </DialogHeader>
          {cfg.fields.map((f) => (
            <FieldInput key={f.name} field={f} value={values[f.name] ?? ""} onChange={(v) => set(f.name, v)} options={optionsOf(f, options)} disabled={pending || (!!row && !!f.createOnly)} error={errors[f.name]?.[0]} />
          ))}
          {row && (
            <Label className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal">
              <span>
                <span className="block text-sm font-medium">Aktif</span>
                <span className="block text-xs text-muted-foreground">Nonaktif = tidak muncul di pilihan form; data lama tetap terbaca.</span>
              </span>
              <Switch checked={active} onCheckedChange={setActive} disabled={pending} />
            </Label>
          )}
          {errors._form && <p className="text-sm text-destructive">{errors._form[0]}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
  options,
  disabled,
  error,
}: {
  field: MasterField;
  value: MasterValue;
  onChange: (v: MasterValue) => void;
  options: { value: string; label: string }[];
  disabled: boolean;
  error?: string;
}) {
  const id = `master-${f.name}`;
  return (
    <Field label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={error}>
      {f.type === "select" ? (
        <Select items={options} value={value ? String(value) : null} onValueChange={(v) => onChange(v ? String(v) : "")} disabled={disabled}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={`Pilih ${f.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : f.type === "textarea" ? (
        <Textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} maxLength={f.maxLength} rows={3} disabled={disabled} />
      ) : f.type === "number" ? (
        <Input id={id} type="number" inputMode="numeric" value={value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} disabled={disabled} />
      ) : (
        <Input
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(f.type === "code" ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") : e.target.value)}
          maxLength={f.maxLength}
          className={cn(f.type === "code" && "font-mono")}
          disabled={disabled}
        />
      )}
    </Field>
  );
}
