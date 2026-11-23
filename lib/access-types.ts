import type { Fn } from "@/lib/functions";
import type { Role } from "@/lib/roles";

/** Data akses user yang AMAN dikirim ke client (tanpa token). Dibuat lib/auth.ts#getAccess. */
export type AppAccess = {
  userId: string;
  email: string;
  role: Role;
  /** Admin platform (app_access app 'platform' role admin): diperlakukan admin di semua app */
  platformAdmin: boolean;
  /** Fungsi K3 dari __APP__.members.functions (rancangan §2.1). Kosong = tanpa fungsi. */
  functions: Fn[];
  /** Batas site dari members.location_ids; null = semua site (rancangan §2.2). */
  locationIds: string[] | null;
  profile: {
    fullName: string;
    avatarUrl: string | null;
    company: string | null;
    departmentId: string | null;
    departmentName: string | null;
    jobTitleName: string | null;
    /** Site profil (public.locations); default pemilih site */
    locationId: string | null;
    locationName: string | null;
    phone: string | null;
  };
};
