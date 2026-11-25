"use client";

import type { PointerEvent, ReactNode } from "react";

/** Pantulan cahaya kaca mengikuti pointer: menulis --mx/--my ke kartu di bawah pointer. */
export function GlowCards({ className, children }: { className?: string; children: ReactNode }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const card = (e.target as Element).closest<HTMLElement>("[data-glow]");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div className={className} onPointerMove={onMove}>
      {children}
    </div>
  );
}
