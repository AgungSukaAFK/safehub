// Pencarian menu "pintar" (port ga-web/lib/sidebar/menu-search.ts). Cocok ke judul, singkatan
// otomatis ("ps" → Pengguna & Akses... "ta" → Template Approval), keywords per menu (lib/nav.ts),
// nama grup, dan tahan salah ketik 1 huruf. Dipakai sidebar DAN global search.

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Template Approval" → "ta" */
function acronym(normalized: string): string {
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

/** Jarak edit maksimal 1 (kurang/lebih/salah 1 huruf) */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

type Index = { title: string; titleWords: string[]; acr: string; keywords: string[]; keywordWords: string[] };

function buildIndex(title: string, keywords: string[] = [], groupLabel?: string): Index {
  const t = normalizeSearch(title);
  const kw = [...keywords, ...(groupLabel ? [groupLabel] : [])].map(normalizeSearch).filter(Boolean);
  return {
    title: t,
    titleWords: t.split(" ").filter(Boolean),
    acr: acronym(t),
    keywords: kw,
    keywordWords: kw.flatMap((k) => k.split(" ")),
  };
}

function scoreToken(token: string, idx: Index): number {
  if (idx.title === token) return 100;
  if (idx.acr === token) return 95;
  if (idx.title.startsWith(token)) return 90;
  if (idx.titleWords.some((w) => w === token)) return 85;
  if (idx.keywords.some((k) => k === token)) return 80;
  if (idx.titleWords.some((w) => w.startsWith(token))) return 75;
  if (token.length >= 2 && idx.acr.startsWith(token)) return 65;
  if (idx.keywordWords.some((w) => w.startsWith(token))) return 60;
  if (token.length >= 3 && idx.title.includes(token)) return 50;
  if (token.length >= 3 && idx.keywords.some((k) => k.includes(token))) return 40;
  if (token.length >= 4 && [...idx.titleWords, ...idx.keywordWords].some((w) => w.length >= 4 && withinOneEdit(token, w)))
    return 30;
  if (token.length >= 3 && isSubsequence(token, idx.title.replace(/ /g, ""))) return 15;
  return 0;
}

export type Searchable = { label: string; keywords?: string[] };

/** Skor relevansi (0 = tidak cocok). Semua kata di query harus cocok ke sesuatu. */
export function scoreMenuItem(query: string, item: Searchable, groupLabel?: string): number {
  const q = normalizeSearch(query);
  if (!q) return 0;
  const idx = buildIndex(item.label, item.keywords, groupLabel);

  let phrase = 0;
  if (q.includes(" ")) {
    if (idx.title.startsWith(q)) phrase = 120;
    else if (idx.title.includes(q)) phrase = 110;
    else if (idx.keywords.some((k) => k === q)) phrase = 105;
    else if (idx.keywords.some((k) => k.includes(q))) phrase = 70;
  }

  const tokens = q.split(" ");
  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(token, idx);
    if (s === 0) return phrase;
    total += s;
  }
  return Math.max(phrase, total / tokens.length);
}

/** Saring & urutkan (paling relevan di atas). */
export function searchMenuItems<T extends Searchable>(items: T[], query: string, groupLabel?: string): T[] {
  return items
    .map((item, i) => ({ item, i, score: scoreMenuItem(query, item, groupLabel) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}
