"use client";

import { useEffect, useState, type RefObject } from "react";

export type FormValues = Record<string, string | string[]>;

/** Baca semua field form (FormData) → objek; field bernama sama → array. */
export function readForm(form: HTMLFormElement): FormValues {
  const out: FormValues = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v !== "string") return; // file tidak ikut (draft & checklist pakai state sendiri)
    const prev = out[k];
    if (prev === undefined) out[k] = v;
    else out[k] = Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  return out;
}

/**
 * Nilai terkini form tak-terkontrol (input/change), untuk checklist Ringkasan & draft. Field yang
 * dikelola state React (mis. daftar item) baca langsung dari state-nya.
 */
export function useWatchedForm(formRef: RefObject<HTMLFormElement | null>) {
  const [values, setValues] = useState<FormValues>({});
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const update = () => setValues(readForm(form));
    const frame = requestAnimationFrame(update);
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", update);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("reset", update);
    };
  }, [formRef]);
  return values;
}
