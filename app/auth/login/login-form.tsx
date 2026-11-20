"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { loginAction } from "@/app/auth/actions";
import { AuthInput } from "@/components/auth/auth-input";
import { Field, FormMessage, fieldError, useFormAction } from "@/components/form-bits";
import { SubmitButton } from "@/components/form/submit-button";
import { readStorage, writeStorage } from "@/lib/storage";

const LAST_EMAIL_KEY = "last-email";

export function LoginForm({ next }: { next: string | null }) {
  const { state, pending, onSubmit } = useFormAction(loginAction);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Prediktif: email terakhir yang berhasil login diingat per perangkat (bukan password),
  // lalu fokus langsung ke password.
  useEffect(() => {
    const last = readStorage<string>(LAST_EMAIL_KEY, "");
    if (last && emailRef.current && !emailRef.current.value) {
      emailRef.current.value = last;
      passwordRef.current?.focus();
    } else {
      emailRef.current?.focus();
    }
  }, []);

  return (
    <form
      onSubmit={(e) => {
        const email = new FormData(e.currentTarget).get("email");
        if (typeof email === "string" && email.includes("@")) writeStorage(LAST_EMAIL_KEY, email.trim().toLowerCase());
        onSubmit(e);
      }}
      className="space-y-4"
      noValidate
    >
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <AuthInput
          ref={emailRef}
          icon={Mail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="nama@perusahaan.com"
          required
          disabled={pending}
          aria-invalid={!!fieldError(state, "email") || undefined}
        />
      </Field>
      <div className="grid grid-cols-[1fr_auto] items-center gap-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <div className="col-span-2">
          <AuthInput
            ref={passwordRef}
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={pending}
          />
        </div>
        {/* Setelah input di DOM supaya Tab dari email langsung ke password */}
        <Link
          href="/auth/lupa-password"
          className="col-start-2 row-start-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Lupa password?
        </Link>
        {fieldError(state, "password") && (
          <p className="col-span-2 text-xs font-medium text-destructive">{fieldError(state, "password")}</p>
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Memproses..." icon={<LogIn />} className="h-11 w-full">
        Masuk
      </SubmitButton>
    </form>
  );
}
