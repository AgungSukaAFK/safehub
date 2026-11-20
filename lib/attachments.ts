// Lampiran (frontend-guide §9.4). File diunggah langsung browser → Storage (bucket <host>-lampiran,
// private, path <record_id>/<nama>); action hanya menyimpan path. Link = file besar di Drive.

export type Attachment = {
  /** path storage (file) atau URL (link) */
  path: string;
  name: string;
  size?: number;
  type?: string;
  isLink?: boolean;
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // sama dengan batas bucket -lampiran
export const ACCEPT_DOCS = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx";

/** https:// wajib; "drive.google.com/..." tanpa skema → ditambah https://. null = tidak valid. */
export function normalizeLinkUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Nama file aman untuk path storage: huruf/angka/-/_/. , maks 120 karakter, unik dengan timestamp. */
export function safeStorageName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  return `${Date.now()}-${base}${ext}`;
}

/**
 * Kompres gambar di browser sebelum upload (sisi terpanjang ≤ maxSide, WebP). File bukan gambar /
 * GIF / sudah kecil dikembalikan apa adanya.
 */
export async function compressImage(file: File, { maxSide = 1920, quality = 0.82, skipBelow = 400 * 1024 } = {}): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= skipBelow) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
