import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const COL_SPAN: Record<Size, string> = {
  lg: "lg:col-span-12",
  md: "lg:col-span-6",
  sm: "lg:col-span-4",
  xs: "sm:col-span-6 lg:col-span-4 xl:col-span-3",
};

/**
 * Wadah SETIAP blok halaman di grid 12 kolom layout (app) (frontend-guide §8.3, port ga-web Content).
 * Sengaja TANPA overflow-hidden (beda dari <Card>) supaya header tabel sticky di dalamnya tetap
 * menempel. size: lg 12 kolom, md 6, sm 4, xs 6/4/3.
 */
export function Content({
  size = "lg",
  title,
  description,
  cardAction,
  cardFooter,
  children,
  className,
  bodyClassName,
  id,
}: {
  size?: Size;
  title?: ReactNode;
  description?: ReactNode;
  cardAction?: ReactNode;
  cardFooter?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "col-span-12 flex scroll-mt-24 flex-col gap-5 rounded-xl border bg-card py-5 text-card-foreground shadow-sm",
        COL_SPAN[size],
        className,
      )}
    >
      {(title || description || cardAction) && (
        <header className="flex flex-col gap-3 px-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="leading-none font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {cardAction && <div className="flex shrink-0 flex-wrap items-center gap-2">{cardAction}</div>}
        </header>
      )}
      {children !== undefined && <div className={cn("min-w-0 px-5", bodyClassName)}>{children}</div>}
      {cardFooter && <footer className="flex flex-col gap-2 border-t px-5 pt-4">{cardFooter}</footer>}
    </section>
  );
}
