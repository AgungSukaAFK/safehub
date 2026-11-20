import type { Role } from "@/lib/roles";

/** Data akses user yang AMAN dikirim ke client (tanpa token). Dibuat lib/auth.ts#getAccess. */
export type AppAccess = {
  userId: string;
  email: string;
  role: Role;
  /** Admin platform (app_access app 'platform' role admin): diperlakukan admin di semua app */
  platformAdmin: boolean;
  profile: {
    fullName: string;
    avatarUrl: string | null;
    company: string | null;
    departmentId: string | null;
    departmentName: string | null;
    jobTitleName: string | null;
    locationName: string | null;
    phone: string | null;
  };
};
