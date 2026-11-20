"use client";

// Pilih tanggal (frontend-guide §9.4, port ga-web date-picker). Nilai string "YYYY-MM-DD" (aman
// untuk FormData & zod). Tampilan "18 Nov 2026". Di panel filter boleh <Input type="date">.

import { useState } from "react";
import { id as localeId } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function toDate(v: string | null | undefined): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
  id,
  name,
  value,
  onValueChange,
  placeholder = "Pilih tanggal",
  min,
  max,
  disabled,
  invalid,
  className,
}: {
  id?: string;
  name?: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** "YYYY-MM-DD" */
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={invalid || undefined}
              className={cn("w-full justify-start px-3 font-normal shadow-xs", !selected && "text-muted-foreground")}
            />
          }
        >
          <CalendarDays className="text-muted-foreground" />
          {selected ? formatDate(selected) : placeholder}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="single"
            locale={localeId}
            selected={selected}
            defaultMonth={selected ?? minDate}
            captionLayout="dropdown"
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            startMonth={minDate ?? new Date(2020, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 5, 11)}
            onSelect={(d) => {
              onValueChange(d ? toValue(d) : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {selected && !disabled && (
        <button
          type="button"
          aria-label="Kosongkan tanggal"
          onClick={() => onValueChange(null)}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </div>
  );
}
