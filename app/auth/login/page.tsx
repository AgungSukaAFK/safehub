import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { textParam } from "@/lib/search-params";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const NOTICES: Record<string, string> = {
  "link-tidak-valid": "Link sudah tidak berlaku atau sudah dipakai. Minta link baru lewat Lupa password.",
  "sesi-berakhir": "Sesi Anda berakhir. Silakan masuk lagi.",
};

export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const sp = await searchParams;
  const next = getSafeNextPath(textParam(sp, "next", 500) || null);
  const notice = NOTICES[textParam(sp, "pesan")];

  return (
    <AuthShell title="Selamat datang kembali" description="Masuk dengan email kantor Anda untuk melanjutkan.">
      {notice && (
        <p role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {notice}
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
