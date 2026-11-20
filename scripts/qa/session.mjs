// Login user DEMO untuk QA: membuat cookie sesi @supabase/ssr yang sama persis dengan browser asli,
// lalu memasangnya ke tab Chrome. Membaca Supabase URL/key dari .env.local.
import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

const root = path.resolve(import.meta.dirname, "../..");

function env() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local tidak ada (lihat README)");
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

export const DEMO_PASSWORD = process.env.QA_PASSWORD || "Demo12345!";

/** Cookie sesi untuk satu user DEMO: [{ name, value }]. */
export async function sessionCookies(email) {
  const e = env();
  let jar = [];
  const sb = createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => jar, setAll: (c) => (jar = c.map(({ name, value }) => ({ name, value }))) },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return jar;
}

export async function loginPage(page, base, email) {
  await page.send("Network.clearBrowserCookies");
  for (const c of await sessionCookies(email)) await page.send("Network.setCookie", { name: c.name, value: c.value, url: base, path: "/" });
}
