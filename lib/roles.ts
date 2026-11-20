// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
// Role app di public.app_access: viewer < editor < admin.

export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** true kalau `role` minimal `min`. role null = tidak punya akses. */
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  return !!role && RANK[role] >= RANK[min];
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Melihat data dan memproses approval yang ditugaskan.",
  editor: "Viewer + membuat dan mengubah data.",
  admin: "Editor + menghapus data, mengelola akses, template approval, dan modul admin.",
};
