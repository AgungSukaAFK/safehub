"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { forgotPasswordAction } from "@/app/auth/actions";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormMessage, fieldError, useFormAction } from "@/components/form-bits";
import { SubmitButton } from "@/components/form/submit-button";

export default function ForgotPasswordPage() {
  const { state, pending, onSubmit } = useFormAction(forgotPasswordAction);
  const sent = state.status === "ok";

  return (
    <AuthShell
      title="Lupa password"
      description="Masukkan email kantor Anda. Kami kirim link untuk membuat password baru."
      footer={
        <Link
          href="/auth/login"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Kembali ke halaman masuk
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          {state.message}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
            <AuthInput
              icon={Mail}
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              autoFocus
              required
              disabled={pending}
            />
          </Field>
          <FormMessage state={state} />
          <SubmitButton pending={pending} pendingLabel="Mengirim..." icon={<Send />} className="h-11 w-full">
            Kirim link
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
