// Tujuan setelah login (?next=). Hanya path internal: diawali "/" tapi bukan "//" atau "/\"
// (protocol-relative ke domain lain → open redirect), dan bukan halaman auth.
export function getSafeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/auth") || next.length > 500) return null;
  return next;
}

/** Halaman asal (`?dari=`) untuk konteks Bantuan/Feedback: path internal saja, aman server & client. */
export function safeFromPath(v: string | null | undefined): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v.slice(0, 300) : null;
}
