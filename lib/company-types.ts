// Tipe & aturan scope perusahaan (aman dipakai client & server). frontend-guide §16.

export type Company = {
  code: string;
  name: string;
  shortName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string;
  logoLandscapeUrl: string;
  accent: string;
  isGroup: boolean;
};

/**
 * Company dokumen yang boleh dilihat user. Platform admin / company grup / akun IT (tanpa
 * company) = "ALL". Cerminan __APP__.my_company_scope() di DB (RLS tetap penjaga terakhir).
 */
export function companyScope(
  user: { company: string | null; platformAdmin: boolean },
  companies: Company[],
): string[] | "ALL" {
  const mine = companies.find((c) => c.code === user.company);
  if (user.platformAdmin || !user.company || !mine || mine.isGroup) return "ALL";
  return [mine.code, ...companies.filter((c) => c.isGroup).map((c) => c.code)];
}

/** Company yang boleh dipilih di form dokumen (bukan company grup). */
export function selectableCompanies(scope: string[] | "ALL", companies: Company[]): Company[] {
  return companies.filter((c) => !c.isGroup && (scope === "ALL" || scope.includes(c.code)));
}
