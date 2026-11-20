"use client";

// Dialog crop gambar generik (frontend-guide §15.4, port ga-web image-crop-dialog): pilih sumber
// (file / seret / tempel / kamera) → crop dengan rasio tetap (geser, zoom, putar, pinch) → render
// ke canvas WebP di browser lalu dikompres sampai < `maxBytes`. Yang diunggah hanya file kecil.
// Tanpa library cropper. Isi dialog dipasang ulang setiap dibuka, jadi state selalu mulai bersih.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, ImagePlus, Loader2, RotateCcw, RotateCw, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const CROP_MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

type Stage = "pick" | "camera" | "edit";
type Point = { x: number; y: number };

export type ImageCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hasil crop final. Dialog menunggu (tombol loading) lalu menutup kalau tidak throw. */
  onSave: (blob: Blob) => Promise<void>;
  /** lebar / tinggi area crop (1 = persegi) */
  aspect?: number;
  /** lebar hasil (px); tinggi = outputWidth / aspect */
  outputWidth?: number;
  /** ukuran file hasil maksimal; kualitas diturunkan bertahap sampai di bawahnya */
  maxBytes?: number;
  /** "circle" = panduan lingkaran (avatar); hasil tetap persegi penuh */
  guide?: "circle" | "rect";
  allowCamera?: boolean;
  title?: string;
  editTitle?: string;
  pickDescription?: string;
  saveLabel?: string;
  errorTitle?: string;
};

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File harus berupa gambar.";
  if (file.size > CROP_MAX_FILE_BYTES) return `Ukuran file ${(file.size / 1024 / 1024).toFixed(1)} MB, maksimal 10 MB.`;
  return null;
}

/** Gambar pertama dari clipboard (Clipboard API async). Tidak didukung → arahkan ke Ctrl+V. */
export async function readImageFromClipboard(): Promise<File | null> {
  try {
    if (!navigator.clipboard?.read) throw new Error("unsupported");
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) return new File([await item.getType(type)], "clipboard", { type });
    }
    toast.error("Tidak ada gambar di clipboard.");
  } catch {
    toast.info("Tekan Ctrl+V (Cmd+V di Mac) untuk menempel gambar.");
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP (fallback JPEG untuk Safari lama), kualitas turun bertahap sampai < maxBytes. */
async function encode(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let last: Blob | null = null;
  for (const q of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
    let blob = await toBlob(canvas, "image/webp", q);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", q);
    if (!blob) break;
    last = blob;
    if (blob.size <= maxBytes) return blob;
  }
  if (last && last.size <= maxBytes * 1.5) return last;
  throw new Error("Gambar terlalu besar setelah dikompres. Coba gambar lain.");
}

export function ImageCropDialog(props: ImageCropDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={props.open} onOpenChange={(v) => !busy && props.onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">{props.open && <CropBody {...props} onBusyChange={setBusy} />}</DialogContent>
    </Dialog>
  );
}

function CropBody({
  onOpenChange,
  onSave,
  aspect = 1,
  outputWidth = 512,
  maxBytes = 300 * 1024,
  guide = "rect",
  allowCamera = false,
  title = "Pilih Gambar",
  editTitle = "Sesuaikan Gambar",
  pickDescription = "Pilih gambar maksimal 10 MB.",
  saveLabel = "Simpan",
  errorTitle = "Gagal menyimpan gambar",
  onBusyChange,
}: ImageCropDialogProps & { onBusyChange: (busy: boolean) => void }) {
  const outputHeight = Math.round(outputWidth / aspect);
  const [stage, setStage] = useState<Stage>("pick");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // kelipatan 90
  const [rawOffset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(0); // lebar area crop (px CSS)
  const viewportH = viewport / aspect;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const stopCamera = () => {
    stopTracks();
    setCameraReady(false);
  };

  // revoke object URL saat ganti gambar / dialog ditutup; matikan kamera saat ditutup
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  useEffect(() => stopTracks, []);

  const loadFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) return void toast.error(error);
    stopTracks();
    setCameraReady(false);
    setNatural(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setSrc(URL.createObjectURL(file));
    setStage("edit");
  }, []);

  // Ctrl+V di mana saja selama dialog terbuka
  useEffect(() => {
    if (stage === "camera") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        loadFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [stage, loadFile]);

  const startCamera = async () => {
    // getUserMedia hanya di konteks aman (https/localhost); selain itu pakai input capture HP
    if (!navigator.mediaDevices?.getUserMedia) return captureInputRef.current?.click();
    setStage("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      setStage("pick");
      toast.error("Tidak bisa mengakses kamera", {
        description:
          (err as { name?: string })?.name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan lewat pengaturan browser."
            : "Pastikan perangkat punya kamera dan tidak sedang dipakai aplikasi lain.",
      });
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // preview kamera depan di-mirror; hasil disamakan dengan yang dilihat user
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && loadFile(new File([blob], "camera.jpg", { type: blob.type })), "image/jpeg", 0.92);
  };

  // ---------------- editor

  // ukuran area crop mengikuti lebar dialog (callback observer, bukan setState sinkron di effect)
  useEffect(() => {
    const el = viewportRef.current;
    if (stage !== "edit" || !el) return;
    const ro = new ResizeObserver(([entry]) => setViewport(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  // skala dasar = gambar menutupi area crop pada zoom 1 (rotasi 90/270 menukar sisi)
  const baseScaleFor = useCallback(
    (rot: number) => {
      if (!natural || !viewport) return 1;
      const sideways = rot % 180 !== 0;
      return Math.max(viewport / (sideways ? natural.h : natural.w), viewportH / (sideways ? natural.w : natural.h));
    },
    [natural, viewport, viewportH],
  );

  // batasi geseran supaya gambar selalu menutupi seluruh area crop
  const clampOffset = useCallback(
    (off: Point, z: number, rot: number): Point => {
      if (!natural || !viewport) return off;
      const s = baseScaleFor(rot) * z;
      const sideways = rot % 180 !== 0;
      const maxX = Math.max(0, ((sideways ? natural.h : natural.w) * s - viewport) / 2);
      const maxY = Math.max(0, ((sideways ? natural.w : natural.h) * s - viewportH) / 2);
      return { x: clampNum(off.x, -maxX, maxX), y: clampNum(off.y, -maxY, maxY) };
    },
    [natural, viewport, viewportH, baseScaleFor],
  );

  // offset efektif dihitung saat render (viewport berubah → tetap dalam batas, tanpa effect)
  const offset = clampOffset(rawOffset, zoom, rotation);
  const scale = baseScaleFor(rotation) * zoom;

  // zoom dengan titik fokus (kursor / tengah pinch) supaya bagian yang ditunjuk tetap di tempat
  const zoomTo = useCallback(
    (nextZoom: number, focus: Point = { x: 0, y: 0 }) => {
      const z = clampNum(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const ratio = z / zoom;
      setZoom(z);
      setOffset((raw) => {
        const off = clampOffset(raw, zoom, rotation);
        return clampOffset({ x: focus.x - (focus.x - off.x) * ratio, y: focus.y - (focus.y - off.y) * ratio }, z, rotation);
      });
    },
    [clampOffset, rotation, zoom],
  );

  const rotate = (delta: number) => {
    const next = (rotation + delta + 360) % 360;
    setRotation(next);
    setOffset((off) => clampOffset(off, zoom, next));
  };

  const relToCenter = useCallback((clientX: number, clientY: number): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const curr = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, curr);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      zoomTo((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist, relToCenter((a.x + b.x) / 2, (a.y + b.y) / 2));
    } else if (pointers.current.size === 1) {
      setOffset((off) => {
        const c = clampOffset(off, zoom, rotation); // mulai dari posisi yang terlihat
        return clampOffset({ x: c.x + curr.x - prev.x, y: c.y + curr.y - prev.y }, zoom, rotation);
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // wheel harus listener native non-passive supaya bisa preventDefault (halaman tidak ikut scroll)
  useEffect(() => {
    const el = viewportRef.current;
    if (stage !== "edit" || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), relToCenter(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stage, zoom, zoomTo, relToCenter]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setOffset(clampOffset({ x: offset.x + moves[e.key].x, y: offset.y + moves[e.key].y }, zoom, rotation));
    } else if (e.key === "+" || e.key === "=") zoomTo(zoom + 0.2);
    else if (e.key === "-") zoomTo(zoom - 0.2);
  };

  // render area crop ke canvas dengan transform yang sama persis dengan preview CSS
  const renderCrop = async (): Promise<Blob> => {
    const img = imgRef.current;
    if (!img || !natural || !viewport) throw new Error("Gambar belum siap.");
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d")!;
    const k = outputWidth / viewport;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; // latar untuk PNG transparan
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.translate(outputWidth / 2 + offset.x * k, outputHeight / 2 + offset.y * k);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.drawImage(img, -natural.w / 2, -natural.h / 2, natural.w, natural.h);
    return encode(canvas, maxBytes);
  };

  const handleSave = async () => {
    setSaving(true);
    onBusyChange(true);
    try {
      await onSave(await renderCrop());
      onBusyChange(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorTitle, { description: err instanceof Error ? err.message : undefined });
      setSaving(false);
      onBusyChange(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{stage === "edit" ? editTitle : title}</DialogTitle>
        <DialogDescription>
          {stage === "edit"
            ? "Geser untuk mengatur posisi; scroll, cubit, atau slider untuk zoom."
            : stage === "camera"
              ? "Posisikan wajah di tengah lalu ambil foto."
              : pickDescription}
        </DialogDescription>
      </DialogHeader>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} />
      {allowCamera && <input ref={captureInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFileInput} />}

      {stage === "pick" && (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) loadFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
            )}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImagePlus className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">{dragging ? "Lepaskan gambar di sini" : "Seret & lepas gambar, atau klik untuk memilih"}</p>
              <p className="mt-1 text-xs text-muted-foreground pointer-coarse:hidden">Bisa juga tempel langsung dengan Ctrl+V</p>
            </div>
          </div>
          <div className={cn("grid gap-2", allowCamera ? "grid-cols-3" : "grid-cols-2")}>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload /> File
            </Button>
            <Button variant="outline" onClick={async () => {
              const file = await readImageFromClipboard();
              if (file) loadFile(file);
            }}>
              <ClipboardPaste /> Tempel
            </Button>
            {allowCamera && (
              <Button variant="outline" onClick={startCamera}>
                <Camera /> Kamera
              </Button>
            )}
          </div>
        </div>
      )}

      {stage === "camera" && (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {guide === "circle" && <div className="pointer-events-none absolute inset-[4%] rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />}
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                stopCamera();
                setStage("pick");
              }}
            >
              Kembali
            </Button>
            <Button onClick={capturePhoto} disabled={!cameraReady}>
              <Camera /> Ambil Foto
            </Button>
          </div>
        </div>
      )}

      {stage === "edit" && src && (
        <div className="space-y-4">
          <div
            ref={viewportRef}
            tabIndex={0}
            aria-label="Area crop gambar. Panah untuk menggeser, + / - untuk zoom."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            style={{ aspectRatio: aspect }}
            className="relative mx-auto w-full max-w-[20rem] cursor-grab touch-none overflow-hidden rounded-xl bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL lokal */}
            <img
              ref={imgRef}
              src={src}
              alt="Gambar yang akan di-crop"
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => {
                toast.error("Format gambar tidak didukung browser ini.", { description: "Coba JPG, PNG, atau WebP." });
                setSrc(null);
                setStage("pick");
              }}
              className={cn("pointer-events-none absolute top-1/2 left-1/2 max-w-none origin-center", !natural && "invisible")}
              style={
                natural
                  ? {
                      width: natural.w,
                      height: natural.h,
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                    }
                  : undefined
              }
            />
            {!natural && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {guide === "circle" ? (
              <>
                <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
              </>
            ) : (
              <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-white/70" />
            )}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border-[0.5px] border-white/60" />
              ))}
            </div>
          </div>

          <div className="mx-auto flex max-w-xl items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => zoomTo(zoom - 0.25)} disabled={zoom <= MIN_ZOOM} aria-label="Perkecil">
              <ZoomOut />
            </Button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              aria-label="Zoom"
              className="h-1.5 flex-1 cursor-pointer accent-primary"
            />
            <Button size="icon" variant="ghost" onClick={() => zoomTo(zoom + 0.25)} disabled={zoom >= MAX_ZOOM} aria-label="Perbesar">
              <ZoomIn />
            </Button>
            <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => rotate(-90)}>
              <RotateCcw /> Putar kiri
            </Button>
            <Button size="sm" variant="outline" onClick={() => rotate(90)}>
              <RotateCw /> Putar kanan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {stage === "edit" && (
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setSrc(null);
              setStage("pick");
            }}
            disabled={saving}
          >
            Ganti Gambar
          </Button>
          <Button onClick={handleSave} disabled={saving || !natural}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Menyimpan...
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
