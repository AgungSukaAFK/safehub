"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const MAX = 9_999_999_999_999;

function digits(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

/**
 * Input uang (frontend-guide §9.4, port ga-web): tampil "Rp 1.500.000", nilai = angka (string
 * digit). Sepenuhnya terkontrol. Dengan `name`, nilai angka mentah ikut FormData lewat input hidden.
 */
export function CurrencyInput({
  value,
  onValueChange,
  name,
  className,
  placeholder = "Rp 0",
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "name" | "type"> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  name?: string;
}) {
  const raw = digits(value);
  const display = raw ? `Rp ${fmt.format(Number(raw))}` : "";
  return (
    <>
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn("text-right tabular-nums", className)}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const next = digits(e.target.value);
          if (Number(next) > MAX) return;
          onValueChange(next);
        }}
        {...props}
      />
      {name && <input type="hidden" name={name} value={raw} />}
    </>
  );
}
