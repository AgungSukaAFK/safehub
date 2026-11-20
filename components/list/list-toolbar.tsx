import type { ReactNode } from "react";

/** Baris atas list: [cari .......] [Download Excel ▾]. Di HP bertumpuk. */
export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="no-print flex flex-col gap-2 md:flex-row md:items-center">{children}</div>;
}
