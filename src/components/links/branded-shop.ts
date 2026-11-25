// Server/loader side of the branded booking page (/{locale}/b/{slug}).
// Reads only anon-granted shops columns; works for unpublished and
// marketplace_visible=false shops (the link is the owner's own channel).

import { parseShopKey } from "@/components/shop/lib/slug";
import { parseLinkTheme, type BookingLinkTheme } from "./link-utils";

export interface BrandedShop {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string | null;
  slug_ar: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_url: string | null;
  landmark_en: string | null;
  landmark_ar: string | null;
  address: string | null;
  /** false = draft / unpublished (staff preview only). Legacy rows count as published. */
  is_published: boolean;
  theme: BookingLinkTheme;
}

export type BrandedShopResult =
  | { status: "ok"; shop: BrandedShop }
  | { status: "not_found" }
  | { status: "error" };

const FULL_COLUMNS =
  "id, name, name_ar, slug, slug_ar, phone, whatsapp, logo_url, cover_url, landmark_en, landmark_ar, address, is_published, booking_link_theme";
/** Before the 1H migration: same row without the theme column. */
const BASE_COLUMNS =
  "id, name, name_ar, slug, slug_ar, phone, whatsapp, logo_url, cover_url, landmark_en, landmark_ar, address, is_published";
/** Before the marketplace spine: legacy columns only. */
const LEGACY_COLUMNS = "id, name, phone, whatsapp, address";

interface QueryResult {
  data: Record<string, unknown> | null;
  error: unknown;
}

/** Structural subset of the Supabase client used here (easy to fake in tests). */
export interface ShopQueryClient {
  from(table: "shops"): {
    select(columns: string): {
      eq(column: string, value: string): { limit(n: number): { maybeSingle(): PromiseLike<QueryResult> } };
    };
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Only http(s) image URLs reach <img>. */
function safeImage(v: unknown): string | null {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
}

export function toBrandedShop(row: Record<string, unknown>): BrandedShop {
  return {
    id: String(row.id),
    name: str(row.name) ?? "",
    name_ar: str(row.name_ar),
    slug: str(row.slug),
    slug_ar: str(row.slug_ar),
    phone: str(row.phone),
    whatsapp: str(row.whatsapp),
    logo_url: safeImage(row.logo_url),
    cover_url: safeImage(row.cover_url),
    landmark_en: str(row.landmark_en),
    landmark_ar: str(row.landmark_ar),
    address: str(row.address),
    is_published: row.is_published !== false,
    theme: parseLinkTheme(row.booking_link_theme),
  };
}

/**
 * Loads the shop behind a branded link. An unpublished shop is not found
 * publicly; `isStaff` lets its own staff preview it.
 */
export async function loadBrandedShop(
  client: ShopQueryClient,
  rawKey: string,
  opts: { isStaff?: (shopId: string) => Promise<boolean> } = {},
): Promise<BrandedShopResult> {
  const key = parseShopKey(rawKey);
  if (key.kind === "invalid") return { status: "not_found" };
  const column = key.kind === "id" ? "id" : key.kind;

  for (const columns of [FULL_COLUMNS, BASE_COLUMNS, LEGACY_COLUMNS]) {
    // A legacy database only has ids; slugs cannot match there.
    if (columns === LEGACY_COLUMNS && column !== "id") return { status: "not_found" };
    const { data, error } = await client.from("shops").select(columns).eq(column, key.value).limit(1).maybeSingle();
    if (error) continue;
    if (!data) return { status: "not_found" };
    const shop = toBrandedShop(data);
    if (!shop.is_published && !(opts.isStaff && (await opts.isStaff(shop.id)))) return { status: "not_found" };
    return { status: "ok", shop };
  }
  return { status: "error" };
}

export function shopDisplayName(shop: Pick<BrandedShop, "name" | "name_ar">, locale: string): string {
  return (locale === "ar" && shop.name_ar) || shop.name || shop.name_ar || "";
}

export function shopLandmark(shop: Pick<BrandedShop, "landmark_en" | "landmark_ar" | "address">, locale: string): string | null {
  return (locale === "ar" ? shop.landmark_ar || shop.landmark_en : shop.landmark_en || shop.landmark_ar) || shop.address || null;
}
