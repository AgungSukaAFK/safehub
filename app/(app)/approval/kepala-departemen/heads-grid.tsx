"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import type { DepartmentHead } from "@/lib/approval";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { searchAppPeopleAction, setDepartmentHeadAction } from "../actions";

type Need = { name: string; company: string | null; department: string | null };

export function HeadsGrid({
  departments,
  companies,
  heads,
  needs,
}: {
  departments: { id: string; name: string }[];
  companies: { code: string; name: string }[];
  heads: DepartmentHead[];
  needs: Need[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const headOf = (d: string, c: string) => heads.find((h) => h.departmentId === d && h.companyCode === c) ?? null;
  const neededBy = (d: string, c: string) => needs.filter((n) => (n.company === null || n.company === c) && (n.department === null || n.department === d));
  const missing = departments.flatMap((d) => companies.filter((c) => !headOf(d.id, c.code) && neededBy(d.id, c.code).length > 0).map((c) => `${d.name} (${c.name})`));

  const save = async (d: string, c: string, userId: string | null) => {
    setSaving(`${d}:${c}`);
    const res = await setDepartmentHeadAction(d, c, userId);
    setSaving(null);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <>
      {missing.length > 0 && (
        <div className="col-span-12 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">{missing.length} kombinasi belum punya kepala departemen padahal dipakai template.</p>
            <p className="text-muted-foreground">Dokumen dari departemen ini tidak bisa diajukan sampai diisi: {missing.slice(0, 6).join(", ")}{missing.length > 6 ? ", …" : ""}</p>
          </div>
        </div>
      )}
      <Content>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left font-medium text-muted-foreground">Departemen</th>
                {companies.map((c) => (
                  <th key={c.code} className="min-w-56 border-b px-3 py-2 text-left font-medium text-muted-foreground">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="sticky left-0 z-10 border-b bg-card px-3 py-2 font-medium">{d.name}</td>
                  {companies.map((c) => {
                    const h = headOf(d.id, c.code);
                    const need = !h ? neededBy(d.id, c.code) : [];
                    return (
                      <td key={c.code} className={cn("border-b px-3 py-2 align-top", need.length > 0 && "bg-amber-50/70 dark:bg-amber-950/20")}>
                        <SearchableSelect
                          id={`head-${d.id}-${c.code}`}
                          value={h?.userId ?? null}
                          selectedOption={h ? { value: h.userId, label: h.name } : null}
                          onValueChange={(v) => save(d.id, c.code, v)}
                          loadOptions={searchAppPeopleAction}
                          placeholder={need.length ? "Wajib diisi" : "Belum diatur"}
                          disabled={saving === `${d.id}:${c.code}`}
                        />
                        {need.length > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="size-3" /> Dipakai: {need.map((n) => n.name).join(", ")}
                          </p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Content>
    </>
  );
}
