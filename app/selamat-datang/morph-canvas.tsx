"use client";

// Partikel yang berubah bentuk mengikuti scroll (tanpa library). Berhenti saat tidak terlihat.
import { useEffect, useRef } from "react";
import { ACCENT_RATIO, buildShapes } from "./shapes";

const smooth = (t: number) => t * t * (3 - 2 * t);

export function MorphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const root = canvas?.closest<HTMLElement>(".lp-stage");
    if (!canvas || !ctx || !root) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = [...root.querySelectorAll<HTMLElement>("[data-shape]")];
    const n = window.innerWidth < 768 ? 1300 : 3400;
    const shapes = buildShapes(n);
    const jitter = Float32Array.from({ length: n * 3 }, () => Math.random() - 0.5);
    let w = 0;
    let h = 0;
    let frame = 0;
    let visible = false;
    let pos = 0;
    let first = true;
    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;

    /** Posisi pecahan di deretan bentuk: 0 = helm … 4 = perisai. */
    const target = () => {
      const tops = sections.map((s) => s.getBoundingClientRect().top);
      let at = 0;
      for (let i = 0; i < tops.length - 1; i++) {
        if (tops[i] <= 0) at = i + Math.min(1, -tops[i] / Math.max(1, tops[i + 1] - tops[i]));
      }
      return Math.min(at, shapes.length - 1);
    };

    const draw = (time: number) => {
      frame = 0;
      const calm = still.matches;
      const goal = target();
      pos = calm || first ? goal : pos + (goal - pos) * 0.12;
      first = false;
      rx += (mx - rx) * 0.05;
      ry += (my - ry) * 0.05;

      const i = Math.min(Math.floor(pos), shapes.length - 2);
      // plateau: bentuk diam sebentar sebelum berubah lagi
      const k = smooth(Math.min(1, Math.max(0, (pos - i - 0.25) / 0.5)));
      const a = shapes[i];
      const b = shapes[i + 1];
      const burst = calm ? 0 : Math.sin(k * Math.PI);
      const intro = Math.max(0, 1 - pos);
      const wide = w >= 900;
      const scale = wide ? Math.min(w * 0.185, h * 0.34) : Math.min(w * 0.32, h * 0.17);
      const cx = wide ? w * 0.74 : w * 0.5;
      const cy = wide ? h * 0.5 : h * 0.28;
      const turn = calm ? -0.5 * intro : Math.sin(time / 2600) * 0.38 + rx * 0.5 + burst * 1.4 - 0.5 * intro;
      const tilt = (calm ? 0.1 : 0.12 + ry * 0.3) + 0.16 * intro;
      const cosY = Math.cos(turn);
      const sinY = Math.sin(turn);
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

      ctx.clearRect(0, 0, w, h);
      const accents = n * ACCENT_RATIO;
      ctx.fillStyle = "#d9f1f7";
      // aksen digambar terakhir (di atas)
      for (let q = n - 1; q >= 0; q--) {
        if (q < accents) ctx.fillStyle = "#ffb61a";
        const p = q * 3;
        const x = a[p] + (b[p] - a[p]) * k + jitter[p] * burst * 1.5;
        const y = a[p + 1] + (b[p + 1] - a[p + 1]) * k + jitter[p + 1] * burst * 1.5;
        const z = a[p + 2] + (b[p + 2] - a[p + 2]) * k + jitter[p + 2] * burst * 1.5;
        const x1 = x * cosY + z * sinY;
        const z1 = z * cosY - x * sinY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;
        const persp = 3.6 / (3.6 - z2);
        const size = (wide ? 2.9 : 1.9) * persp;
        ctx.globalAlpha = Math.max(0.16, Math.min(1, 0.58 + z2 * 0.42));
        ctx.fillRect(cx + x1 * scale * persp, cy - y1 * scale * persp, size, size);
      }
      ctx.globalAlpha = 1;
      if (!calm) request();
    };

    function request() {
      if (!frame && visible) frame = requestAnimationFrame(draw);
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      request();
    };
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      request();
    });
    const ro = new ResizeObserver(resize);
    io.observe(canvas);
    ro.observe(canvas);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      visible = false;
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={ref} className="lp-canvas" aria-hidden="true" />;
}
