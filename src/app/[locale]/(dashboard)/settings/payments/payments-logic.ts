// Pure helpers for payment methods and products settings (WS-1F).

export const METHOD_KINDS = ["cash", "card", "cliq", "wallet", "bank_transfer", "online", "other"] as const;
export type MethodKind = (typeof METHOD_KINDS)[number];

/** Mirrors payment_methods_code_format: ^[a-z0-9_]{2,32}$ and not 'mixed'. */
export const METHOD_CODE_RE = /^[a-z0-9_]{2,32}$/;

/** A unique code for a new custom method, derived from its English name. */
export function methodCodeFor(nameEn: string, existing: readonly string[]): string {
  let base = nameEn
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  if (base.length < 2 || base === "mixed") base = "custom";
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const c = `${base}_${i}`;
    if (!taken.has(c)) return c;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, 32);
}

export type MethodIssue = "NAME_EN" | "NAME_AR" | "ALIAS" | "QR_URL";

export interface MethodDraft {
  nameEn: string;
  nameAr: string;
  kind: MethodKind;
  cliqAlias: string;
  qrUrl: string;
}

export function validateMethod(d: MethodDraft): MethodIssue | null {
  const en = d.nameEn.trim();
  const ar = d.nameAr.trim();
  if (en.length < 1 || en.length > 60) return "NAME_EN";
  if (ar.length < 1 || ar.length > 60) return "NAME_AR";
  if (d.cliqAlias.trim().length > 64) return "ALIAS";
  const qr = d.qrUrl.trim();
  if (qr && (!/^https:\/\/\S+$/.test(qr) || qr.length > 1000)) return "QR_URL";
  return null;
}

export type ProductIssue = "NAME_EN" | "NAME_AR" | "PRICE" | "SKU";

export interface ProductDraft {
  nameEn: string;
  nameAr: string;
  price: string;
  sku: string;
}

/** Validates and parses a product; price accepts Arabic-Indic digits. */
export function validateProduct(d: ProductDraft, parseMoney: (raw: string) => number | null): ProductIssue | null {
  const en = d.nameEn.trim();
  if (en.length < 1 || en.length > 80) return "NAME_EN";
  if (d.nameAr.trim().length > 80) return "NAME_AR";
  const price = d.price.trim() === "" ? null : parseMoney(d.price);
  if (price === null || price < 0 || price > 100000) return "PRICE";
  if (d.sku.trim().length > 64) return "SKU";
  return null;
}

/** Swap `sort` of two neighbours; returns the two updates to write. */
export function swapSort<T extends { id: string; sort: number }>(rows: T[], index: number, dir: -1 | 1): { id: string; sort: number }[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= rows.length) return [];
  const a = rows[index];
  const b = rows[j];
  // Equal sorts (legacy rows): spread them so the swap is visible.
  const sa = a.sort === b.sort ? b.sort + dir : b.sort;
  return [
    { id: a.id, sort: Math.max(0, Math.min(1000, sa)) },
    { id: b.id, sort: Math.max(0, Math.min(1000, a.sort)) },
  ];
}
