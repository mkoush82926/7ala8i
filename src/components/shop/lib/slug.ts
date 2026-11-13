/** Shop / barber URL keys. */

export const UUID_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Latin slug as enforced by shops_slug_format / profiles_handle_format. */
export const LATIN_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Arabic slug from slugify_ar(): Arabic letters, digits and hyphens. */
const ARABIC_SLUG_RE = /^[؀-ۿ0-9a-z]+(-[؀-ۿ0-9a-z]+)*$/;

export type ShopKey =
  | { kind: "id"; value: string }
  | { kind: "slug"; value: string }
  | { kind: "slug_ar"; value: string }
  | { kind: "invalid" };

/** Classifies the `[shop_id]` route segment (already URL-decoded or not). */
export function parseShopKey(raw: string | null | undefined): ShopKey {
  let value = (raw ?? "").trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return { kind: "invalid" };
  }
  value = value.normalize("NFC");
  if (!value || value.length > 120) return { kind: "invalid" };
  if (UUID_KEY_RE.test(value)) return { kind: "id", value: value.toLowerCase() };
  const lower = value.toLowerCase();
  if (LATIN_SLUG_RE.test(lower) && lower.length <= 64) return { kind: "slug", value: lower };
  if (/[؀-ۿ]/.test(value) && ARABIC_SLUG_RE.test(value)) return { kind: "slug_ar", value };
  return { kind: "invalid" };
}

export interface SlugShop {
  id: string;
  slug?: string | null;
  slug_ar?: string | null;
}

/** Canonical path segment for a locale: Arabic slug on /ar when it exists. */
export function shopSegment(shop: SlugShop, locale: string): string {
  if (locale === "ar" && shop.slug_ar) return shop.slug_ar;
  return shop.slug || shop.id;
}

export function shopPath(shop: SlugShop, locale: string): string {
  const loc = locale === "ar" ? "ar" : "en";
  return `/${loc}/shop/${encodeURIComponent(shopSegment(shop, loc))}`;
}

export function barberPath(handle: string, locale: string): string {
  const loc = locale === "ar" ? "ar" : "en";
  return `/${loc}/barber/${encodeURIComponent(handle)}`;
}

export function parseHandle(raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.toLowerCase();
  return LATIN_SLUG_RE.test(value) && value.length >= 2 && value.length <= 48 ? value : null;
}

/** Client-side handle normalisation (mirrors slugify_latin for ASCII input). */
export function normalizeHandle(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/** Keeps safe query params when redirecting an old URL to the slug URL. */
export function carryQuery(search: Record<string, string | string[] | undefined> | null | undefined): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search ?? {})) {
    if (!/^[a-z_]{1,24}$/.test(k)) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === "string" && /^[A-Za-z0-9_.:,-]{1,128}$/.test(value)) params.set(k, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
