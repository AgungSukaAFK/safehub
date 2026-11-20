"use client";
// [starter-standar] direkonstruksi + tambahan boilerplate (useActionToast)

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type FormActionFn = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Pasangkan form dengan Server Action. `onSubmit` mencegah reset form bawaan React (isian tetap
 * ada kalau validasi server gagal) dan menjalankan action di transition.
 */
export function useFormAction(action: FormActionFn, initial: FormState = INITIAL_FORM_STATE) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const submit = (fd: FormData) => startTransition(() => dispatch(fd));
  return { state, pending, onSubmit, submit };
}

/** Toast otomatis saat state action berubah (sukses/gagal). */
export function useActionToast(
  state: FormState,
  opts: { success?: boolean; errorTitle?: string; onSuccess?: (s: FormState) => void } = {},
) {
  const last = useRef(0);
  const { success = true, errorTitle, onSuccess } = opts;
  useEffect(() => {
    if (!state.ts || state.ts === last.current) return;
    last.current = state.ts;
    if (state.status === "ok") {
      if (success && state.message) toast.success(state.message);
      onSuccess?.(state);
    } else if (state.status === "error" && state.message) {
      if (errorTitle) toast.error(errorTitle, { description: state.message });
      else toast.error(state.message);
    }
  }, [state, success, errorTitle, onSuccess]);
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

/** Label di atas, input full width, hint kecil, error inline. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Pesan ringkas di atas form (error umum dari server). */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {state.message}
    </div>
  );
}
