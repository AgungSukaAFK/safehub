"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { APP_SHORT_NAME } from "@/lib/app-config";
import { labelForPath } from "@/lib/nav";
import { isUuid } from "@/lib/utils";

/** Label segmen umum yang bukan menu */
const SEGMENT_LABELS: Record<string, string> = {
  baru: "Baru",
  ubah: "Ubah",
  kelola: "Kelola",
  template: "Template",
  "kepala-departemen": "Kepala Departemen",
};

function humanize(segment: string) {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

/** Breadcrumb top bar: di HP hanya crumb terakhir; segmen UUID tidak ditampilkan. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs: { href: string; label: string }[] = [];
  parts.forEach((part, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    if (isUuid(part)) {
      crumbs.push({ href, label: "Detail" });
      return;
    }
    crumbs.push({ href, label: labelForPath(href) ?? humanize(part) });
  });
  // UUID diikuti segmen lain (mis. /x/<id>/ubah): "Detail" tetap jadi tautan
  if (crumbs.length === 0) crumbs.push({ href: "/", label: "Beranda" });

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        <BreadcrumbItem className="hidden shrink-0 md:inline-flex">
          <BreadcrumbLink render={<Link href="/" />}>{APP_SHORT_NAME}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={c.href}>
              <BreadcrumbItem className={last ? "min-w-0" : "hidden shrink-0 md:inline-flex"}>
                {last ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={c.href} />} className="truncate">
                    {c.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
