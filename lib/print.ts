// Cetak (frontend-guide §19.1). Jangan panggil window.print() langsung: nama file "Save as PDF"
// diambil dari document.title, jadi title diganti sementara ke kode dokumen.

/** Tunggu semua gambar di dalam root selesai dimuat & di-decode (logo kop tidak kosong). */
export async function waitForImages(root: ParentNode = document, timeoutMs = 3000) {
  const imgs = Array.from(root.querySelectorAll("img"));
  const ready = Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? img.decode().catch(() => undefined)
        : new Promise<void>((r) => {
            img.addEventListener("load", () => r(), { once: true });
            img.addEventListener("error", () => r(), { once: true });
          }),
    ),
  );
  await Promise.race([ready, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** "PJ/GMI/2611/0001" → "PJ-GMI-2611-0001" */
export const printFileName = (code: string) => code.replace(/[\\/:*?"<>|\s]+/g, "-");

export async function printWithFileName(code: string, root?: ParentNode) {
  await waitForImages(root);
  const prev = document.title;
  document.title = printFileName(code);
  document.documentElement.setAttribute("data-printing", "");
  const restore = () => {
    document.title = prev;
    document.documentElement.removeAttribute("data-printing");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  // beberapa browser (iOS) tidak memicu afterprint
  setTimeout(restore, 1500);
}
