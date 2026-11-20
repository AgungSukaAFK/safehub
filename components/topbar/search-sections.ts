// Penyusun hasil global search (port ga-web search-sections.ts): fungsi murni supaya bisa dihitung
// ulang saat Enter ditekan sebelum hasil server datang.
//   Query kosong: Menunggu aksi Anda → Terakhir dibuka → Pencarian terakhir → Aksi cepat
//   Mirip kode (ada angka atau "/"): Paling cocok → data → Menu → Aksi
//   Query biasa: Paling cocok → Menu → Aksi → data

import { ArrowRight, ClipboardCheck, History, LogOut, type LucideIcon, Monitor, Moon, MoonStar, Plus, SquareUserRound, Sun, SunDim } from "lucide-react";
import type { AppAccess } from "@/lib/access-types";
import { themeModes, type ThemeMode } from "@/lib/font-options";
import { formatRupiah, timeAgo } from "@/lib/format";
import type { NavGroup } from "@/lib/nav";
import { roleAtLeast } from "@/lib/roles";
import { SEARCH_KIND_ORDER, SEARCH_KINDS } from "@/lib/search-kinds";
import { scoreMenuItem } from "@/lib/sidebar/menu-search";
import { resolveStatus } from "@/lib/status";
import { normalizeQuery, type PendingRow, type RecentDoc, type SearchRow, SEARCH_PER_GROUP } from "./global-search-data";

export type SearchAction = { type: "theme"; value: ThemeMode } | { type: "logout" };

export type SearchItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  hint?: string | null;
  href?: string;
  action?: SearchAction;
  fillQuery?: string;
  recent?: RecentDoc;
  more?: boolean;
};

export type SearchSection = { id: string; label: string; items: SearchItem[]; clearable?: boolean };

type QuickAction = {
  id: string;
  title: string;
  icon: LucideIcon;
  keywords: string[];
  href?: string;
  action?: SearchAction;
  featured?: boolean;
  /** Aturan WAJIB sama persis dengan tombol aslinya */
  visible?: (a: AppAccess) => boolean;
};

const MODE_ICONS: Record<ThemeMode, LucideIcon> = { light: Sun, "soft-light": SunDim, dark: Moon, "soft-dark": MoonStar, system: Monitor };
const MODE_KEYWORDS: Record<ThemeMode, string[]> = {
  light: ["terang", "light", "siang"],
  "soft-light": ["terang", "soft", "lembut"],
  dark: ["gelap", "dark", "malam"],
  "soft-dark": ["gelap", "soft", "lembut", "malam"],
  system: ["sistem", "otomatis", "auto"],
};

const QUICK_ACTIONS: QuickAction[] = [
  // CONTOH: sama dengan tombol "Buat Pengajuan" di /pengajuan (editor ke atas)
  {
    id: "buat-pengajuan",
    title: "Buat Pengajuan",
    icon: Plus,
    href: "/pengajuan/baru",
    keywords: ["pengajuan baru", "buat pj", "tambah", "create", "baru"],
    featured: true,
    visible: (a) => roleAtLeast(a.role, "editor"),
  },
  {
    id: "approval",
    title: "Buka Approval Saya",
    icon: ClipboardCheck,
    href: "/approval",
    keywords: ["approval", "persetujuan", "antrian", "setujui"],
  },
  {
    id: "profil",
    title: "Profil Saya",
    icon: SquareUserRound,
    href: "/profil",
    keywords: ["profil", "profile", "akun saya", "foto profil", "notifikasi hp"],
  },
  ...themeModes.map(
    (m): QuickAction => ({
      id: `tema-${m.name}`,
      title: `Tema: ${m.label}`,
      icon: MODE_ICONS[m.name],
      action: { type: "theme", value: m.name },
      keywords: ["tema", "theme", "mode", "tampilan", ...MODE_KEYWORDS[m.name]],
    }),
  ),
  {
    id: "logout",
    title: "Keluar",
    icon: LogOut,
    action: { type: "logout" },
    keywords: ["logout", "log out", "sign out", "keluar akun"],
  },
];

// Skor 15 = cocok sebagai subsequence saja; di sini menu/aksi wajib cocok lebih kuat
const MIN_LOCAL_SCORE = 20;

function actionToItem(a: QuickAction): SearchItem {
  return { key: `action:${a.id}`, icon: a.icon, title: a.title, href: a.href, action: a.action };
}

function rowToItem(row: SearchRow): SearchItem {
  const kind = SEARCH_KINDS[row.kind];
  const status = kind?.statuses ? resolveStatus(kind.statuses, row.status).label : row.status;
  return {
    key: `${row.kind}:${row.id}`,
    icon: kind?.icon ?? ArrowRight,
    title: row.title,
    subtitle: row.subtitle,
    status,
    hint: row.amount != null ? formatRupiah(row.amount) : null,
    href: row.href,
    recent: { kind: row.kind, id: row.id, title: row.title, subtitle: row.subtitle, href: row.href },
  };
}

function pendingToItem(row: PendingRow): SearchItem {
  const kind = SEARCH_KINDS[row.doc_type];
  return {
    key: `pending:${row.approval_id}`,
    icon: kind?.icon ?? ClipboardCheck,
    title: `${row.doc_label} menunggu persetujuan Anda`,
    subtitle: `Langkah ${row.step_no} · sejak ${timeAgo(row.waiting_since)}${row.followup_count ? ` · ${row.followup_count}x follow-up` : ""}`,
    href: row.href,
  };
}

function visibleActions(access: AppAccess, theme: ThemeMode) {
  return QUICK_ACTIONS.filter(
    (a) => (!a.visible || a.visible(access)) && !(a.action?.type === "theme" && a.action.value === theme),
  );
}

export function looksLikeCode(q: string) {
  return /\d/.test(q) || q.includes("/");
}

export type BuildInput = {
  query: string;
  navGroups: NavGroup[];
  access: AppAccess;
  rows: SearchRow[];
  pending: PendingRow[];
  history: { docs: RecentDoc[]; queries: string[] };
  theme: ThemeMode;
};

export function buildSections(input: BuildInput): SearchSection[] {
  const { navGroups, access, rows, pending, history, theme } = input;
  const q = normalizeQuery(input.query);

  if (!q) {
    const sections: SearchSection[] = [];
    if (pending.length > 0) {
      const items = pending.map(pendingToItem);
      items.push({ key: "more:approval", icon: ArrowRight, title: "Lihat semua di Approval Saya", href: "/approval", more: true });
      sections.push({ id: "pending", label: "Menunggu aksi Anda", items });
    }
    if (history.docs.length > 0) {
      sections.push({
        id: "recent-docs",
        label: "Terakhir dibuka",
        clearable: true,
        items: history.docs.map((d) => ({
          key: `recent:${d.kind}:${d.id}`,
          icon: SEARCH_KINDS[d.kind]?.icon ?? History,
          title: d.title,
          subtitle: d.subtitle,
          href: d.href,
          recent: d,
        })),
      });
    }
    if (history.queries.length > 0) {
      sections.push({
        id: "recent-queries",
        label: "Pencarian terakhir",
        clearable: history.docs.length === 0,
        items: history.queries.map((text) => ({ key: `query:${text}`, icon: History, title: text, fillQuery: text })),
      });
    }
    const featured = visibleActions(access, theme).filter((a) => a.featured);
    if (featured.length) sections.push({ id: "actions", label: "Aksi cepat", items: featured.map(actionToItem) });
    return sections;
  }

  const exact = rows.filter((r) => r.is_exact);
  const exactSection: SearchSection[] = exact.length ? [{ id: "exact", label: "Paling cocok", items: exact.map(rowToItem) }] : [];

  const dataSections = SEARCH_KIND_ORDER.map((kind): SearchSection => {
    const meta = SEARCH_KINDS[kind];
    const groupRows = rows.filter((r) => r.kind === kind);
    const items = groupRows.filter((r) => !r.is_exact).map(rowToItem);
    if (meta.listHref && groupRows.length >= SEARCH_PER_GROUP) {
      items.push({ key: `more:${kind}`, icon: ArrowRight, title: `Lihat semua hasil ${meta.label}`, href: meta.listHref(q), more: true });
    }
    return { id: `data:${kind}`, label: meta.label, items };
  });

  const seen = new Set<string>();
  const menuItems = navGroups
    .flatMap((g) => g.items.map((item) => ({ item, group: g.label, score: scoreMenuItem(q, item, g.label) })))
    .filter((r) => r.score >= MIN_LOCAL_SCORE)
    .sort((a, b) => b.score - a.score)
    .filter((r) => !seen.has(r.item.href) && !!seen.add(r.item.href))
    .slice(0, 5)
    .map(({ item, group }): SearchItem => ({ key: `menu:${item.href}`, icon: item.icon, title: item.label, hint: group, href: item.href }));

  const actionItems = visibleActions(access, theme)
    .map((a) => ({ a, score: scoreMenuItem(q, { label: a.title, keywords: a.keywords }) }))
    .filter((r) => r.score >= MIN_LOCAL_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((r) => actionToItem(r.a));

  const menu: SearchSection = { id: "menu", label: "Menu", items: menuItems };
  const actions: SearchSection = { id: "actions", label: "Aksi", items: actionItems };
  const ordered = looksLikeCode(q) ? [...dataSections, menu, actions] : [menu, actions, ...dataSections];
  return [...exactSection, ...ordered].filter((s) => s.items.length > 0);
}
