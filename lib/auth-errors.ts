// [starter-standar] direkonstruksi: pesan error auth Supabase → Bahasa Indonesia.
type AuthErrorLike = { message?: string; status?: number; code?: string } | null | undefined;

export function authErrorMessage(e: AuthErrorLike): string {
  if (!e) return "Terjadi kesalahan. Coba lagi.";
  if (e.status === 429 || e.code === "over_request_rate_limit" || e.code === "over_email_send_rate_limit") {
    return "Terlalu banyak percobaan, coba lagi sebentar lagi.";
  }
  switch (e.code) {
    case "invalid_credentials":
      return "Email atau password salah.";
    case "email_not_confirmed":
      return "Email belum dikonfirmasi. Hubungi tim IT.";
    case "user_banned":
      return "Akun Anda dinonaktifkan. Minta bantuan ke atasan Anda atau tim IT.";
    case "same_password":
      return "Password baru tidak boleh sama dengan password lama.";
    case "weak_password":
      return "Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.";
    case "session_not_found":
    case "session_expired":
      return "Sesi berakhir. Buka lagi link dari email atau minta link baru.";
  }
  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Email atau password salah.";
  if (msg.includes("fetch") || msg.includes("network")) return "Tidak bisa terhubung ke server. Periksa koneksi internet Anda.";
  return "Terjadi kesalahan. Coba lagi, atau hubungi tim IT.";
}
