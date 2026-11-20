"use server";
// [starter-standar] direkonstruksi: aksi auth (login, lupa password, password baru).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, invalid, ok, type FormState } from "@/lib/action-state";
import { authErrorMessage } from "@/lib/auth-errors";
import { cctv } from "@/lib/cctv";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

const loginInput = z.object({
  email: z.string().trim().toLowerCase().email("Masukkan email yang valid."),
  password: z.string().min(1, "Password wajib diisi."),
  next: z.string().optional(),
});

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return fail(authErrorMessage(error));

  await cctv({ category: "auth", action: "auth.login", summary: "Masuk ke app" });
  redirect(getSafeNextPath(parsed.data.next) ?? "/");
}

async function originFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Masukkan email yang valid.") })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const origin = await originFromHeaders();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/password-baru`,
  });
  // Rate limit tetap dilaporkan; error lain disamarkan supaya tidak membocorkan email terdaftar.
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return fail(authErrorMessage(error));
  return ok("Kalau email terdaftar, link untuk membuat password baru sudah dikirim. Periksa juga folder spam.");
}

const newPasswordInput = z
  .object({
    password: z
      .string()
      .min(8, "Password minimal 8 karakter.")
      .max(72, "Password maksimal 72 karakter.")
      .regex(/[a-zA-Z]/, "Password harus mengandung huruf.")
      .regex(/\d/, "Password harus mengandung angka."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi password tidak sama." });

export async function updatePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail("Sesi berakhir. Buka lagi link dari email atau minta link baru.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorMessage(error));

  await cctv({ category: "auth", action: "auth.password_update", summary: "Mengganti password", severity: "notice" });
  redirect("/?pesan=password-diubah");
}
