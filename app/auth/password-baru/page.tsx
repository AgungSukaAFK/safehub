"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { updatePasswordAction } from "@/app/auth/actions";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormMessage, fieldError, useFormAction } from "@/components/form-bits";
import { SubmitButton } from "@/components/form/submit-button";

// Dibuka dari link email (/auth/confirm membuat sesi lalu mengarahkan ke sini).
export default function NewPasswordPage() {
  const { state, pending, onSubmit } = useFormAction(updatePasswordAction);

  return (
    <AuthShell title="Buat password baru" description="Minimal 8 karakter, mengandung huruf dan angka.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Password baru" htmlFor="password" error={fieldError(state, "password")}>
          <AuthInput
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            disabled={pending}
          />
        </Field>
        <Field label="Ulangi password baru" htmlFor="confirm" error={fieldError(state, "confirm")}>
          <AuthInput icon={LockKeyhole} id="confirm" name="confirm" type="password" autoComplete="new-password" required disabled={pending} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingLabel="Menyimpan..." icon={<KeyRound />} className="h-11 w-full">
          Simpan password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
