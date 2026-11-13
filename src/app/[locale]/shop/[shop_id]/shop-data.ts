/**
 * Data loading for the public shop profile. Shared by the server page (SSR +
 * metadata) and the client component (mock mode / retry), so both read the
 * same anon-readable columns. Never select("*") on shops or profiles: anon
 * only has column grants on the public subset.
 *
 * Publishing (WS-1A): an unpublished shop is "not_found" for the public; its
 * own staff get it with `preview: true`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { parseShopKey } from "@/components/shop/lib/slug";
import { publicMediaUrl, sortByOrder } from "@/components/shop/lib/media";
import type {
  Amenity,
  BarberData,
  PlaceName,
  PortfolioItem,
  ReviewData,
  ServiceCategory,
  ServiceData,
  ShopData,
  ShopPhoto,
  ShopProfileData,
  ShopProfileResult,
  WorkingHourRow,
} from "@/components/shop/lib/types";

export type {
  Amenity,
  BarberData,
  PortfolioItem,
  ReviewData,
  ServiceData,
  ShopData,
  ShopPhoto,
  ShopProfileData,
  ShopProfileResult,
};

export const SHOP_COLUMNS =
  "id, name, name_ar, description, description_ar, address, phone, whatsapp, instagram, google_maps_url, currency, timezone, cancellation_policy_hours, slug, slug_ar, lat, lng, landmark_en, landmark_ar, city_id, area_id, is_published, marketplace_visible, is_verified, cover_url, logo_url";

export const BARBER_COLUMNS =
  "id, full_name, avatar_url, role, handle, title_en, title_ar, bio_en, bio_ar, languages, years_experience, is_public";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyClient = SupabaseClient<any, any, any>;

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function normalizeShop(row: Row): ShopData {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    name_ar: str(row.name_ar),
    description: str(row.description),
    description_ar: str(row.description_ar),
    address: str(row.address),
    phone: str(row.phone),
    whatsapp: str(row.whatsapp),
    instagram: str(row.instagram),
    google_maps_url: str(row.google_maps_url),
    currency: str(row.currency),
    timezone: str(row.timezone),
    cancellation_policy_hours: num(row.cancellation_policy_hours),
    slug: str(row.slug),
    slug_ar: str(row.slug_ar),
    lat: num(row.lat),
    lng: num(row.lng),
    landmark_en: str(row.landmark_en),
    landmark_ar: str(row.landmark_ar),
    city_id: str(row.city_id),
    area_id: str(row.area_id),
    // Missing column (mock data) = treat as published.
    is_published: row.is_published !== false,
    marketplace_visible: row.marketplace_visible !== false,
    is_verified: row.is_verified === true,
    cover_url: str(row.cover_url),
    logo_url: str(row.logo_url),
  };
}

export function normalizeBarber(row: Row, rating?: { rating_avg: unknown; rating_count: unknown }): BarberData {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? "").trim(),
    avatar_url: str(row.avatar_url),
    role: str(row.role),
    handle: str(row.handle),
    title_en: str(row.title_en),
    title_ar: str(row.title_ar),
    bio_en: str(row.bio_en),
    bio_ar: str(row.bio_ar),
    languages: Array.isArray(row.languages) ? (row.languages as unknown[]).filter((l): l is string => typeof l === "string") : [],
    years_experience: num(row.years_experience),
    is_public: row.is_public !== false,
    rating_avg: rating ? num(rating.rating_avg) : null,
    rating_count: rating ? (num(rating.rating_count) ?? 0) : 0,
  };
}

export function normalizePhoto(row: Row, supabaseUrl: string | null | undefined): ShopPhoto | null {
  const path = str(row.path);
  const url = publicMediaUrl(supabaseUrl, path);
  if (!path || !url) return null;
  return {
    id: String(row.id),
    path,
    url,
    sort_order: num(row.sort_order) ?? 0,
    alt_en: str(row.alt_en),
    alt_ar: str(row.alt_ar),
    width: num(row.width),
    height: num(row.height),
    blur_data: str(row.blur_data),
  };
}

export function normalizePortfolio(row: Row, supabaseUrl: string | null | undefined): PortfolioItem | null {
  const path = str(row.path);
  const url = publicMediaUrl(supabaseUrl, path);
  if (!path || !url) return null;
  return {
    id: String(row.id),
    barber_id: str(row.barber_id),
    service_id: str(row.service_id),
    path,
    url,
    caption: str(row.caption),
    caption_ar: str(row.caption_ar),
    sort_order: num(row.sort_order) ?? 0,
    is_featured: row.is_featured === true,
    blur_data: str(row.blur_data),
  };
}

/** Whether the signed-in viewer is staff of the shop (false for anon / errors). */
export async function viewerIsStaff(supabase: AnyClient, shopId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_staff_of_shop", { p_shop_id: shopId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Finds a shop by id, slug or Arabic slug. */
export async function findShop(
  supabase: AnyClient,
  rawKey: string,
): Promise<{ status: "ok"; shop: ShopData } | { status: "not_found" } | { status: "error" }> {
  const key = parseShopKey(rawKey);
  if (key.kind === "invalid") return { status: "not_found" };
  const column = key.kind === "id" ? "id" : key.kind;
  const res = await supabase.from("shops").select(SHOP_COLUMNS).eq(column, key.value).maybeSingle();
  if (res.error) {
    // 22P02 invalid uuid, 42703 missing column (pre-migration) → not found / error.
    return res.error.code === "22P02" ? { status: "not_found" } : { status: "error" };
  }
  if (!res.data) return { status: "not_found" };
  return { status: "ok", shop: normalizeShop(res.data as Row) };
}

export interface LoadOptions {
  supabaseUrl?: string | null;
  /** Let staff of an unpublished shop see it (default true). */
  allowPreview?: boolean;
}

export async function loadShopProfile(
  supabase: AnyClient,
  rawKey: string,
  options: LoadOptions = {},
): Promise<ShopProfileResult> {
  const found = await findShop(supabase, rawKey);
  if (found.status !== "ok") return found;
  const shop = found.shop;
  const shopId = shop.id;

  let preview = false;
  if (!shop.is_published) {
    if (options.allowPreview === false || !(await viewerIsStaff(supabase, shopId))) return { status: "not_found" };
    preview = true;
  }

  const supabaseUrl = options.supabaseUrl ?? publicEnv.supabaseUrl ?? null;

  const [servicesRes, reviewsRes, ratingsRes, barbersRes, photosRes, portfolioRes, amenitiesRes, barberRatingsRes, placesRes, categoriesRes] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, name_ar, duration, price, category_id")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("price", { ascending: true }),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_name")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(24),
      supabase.from("reviews").select("rating").eq("shop_id", shopId).limit(2000),
      supabase
        .from("profiles")
        .select(BARBER_COLUMNS)
        .eq("shop_id", shopId)
        .in("role", ["barber", "shop_admin"])
        .order("full_name", { ascending: true }),
      supabase
        .from("shop_photos")
        .select("id, path, sort_order, alt_en, alt_ar, width, height, blur_data, created_at")
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true })
        .limit(40),
      supabase
        .from("portfolio_items")
        .select("id, barber_id, service_id, path, caption, caption_ar, sort_order, is_featured, blur_data, created_at")
        .eq("shop_id", shopId)
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(60),
      supabase.from("shop_amenities").select("amenity:amenities(id, slug, name_en, name_ar, icon, sort, is_active)").eq("shop_id", shopId),
      supabase.from("barber_rating_view").select("barber_id, rating_avg, rating_count").eq("shop_id", shopId),
      loadPlaces(supabase, shop),
      supabase.from("service_categories").select("id, slug, name_en, name_ar, sort").order("sort", { ascending: true }),
    ]);

  const ratingsByBarber = new Map<string, { rating_avg: unknown; rating_count: unknown }>();
  for (const r of (barberRatingsRes.data ?? []) as Row[]) {
    if (typeof r.barber_id === "string") ratingsByBarber.set(r.barber_id, { rating_avg: r.rating_avg, rating_count: r.rating_count });
  }

  const allStaff = ((barbersRes.data ?? []) as Row[])
    .map((row) => normalizeBarber(row, ratingsByBarber.get(String(row.id))))
    .filter((b) => b.full_name);
  // Hidden barbers still count for opening hours, but are not listed.
  const barbers = preview ? allStaff : allStaff.filter((b) => b.is_public);

  let hours: WorkingHourRow[] = [];
  if (allStaff.length > 0) {
    const hoursRes = await supabase
      .from("working_hours")
      .select("barber_id, day_of_week, is_working, start_time, end_time")
      .in(
        "barber_id",
        allStaff.map((b) => b.id),
      );
    hours = (hoursRes.data ?? []) as WorkingHourRow[];
  }

  const reviews = (reviewsRes.data ?? []) as ReviewData[];
  const ratings = ratingsRes.error
    ? reviews.map((r) => r.rating)
    : ((ratingsRes.data ?? []) as { rating: number }[]).map((r) => r.rating);

  const photos = sortByOrder(
    ((photosRes.data ?? []) as Row[]).map((r) => normalizePhoto(r, supabaseUrl)).filter((p): p is ShopPhoto => !!p),
  );
  const publicBarberIds = new Set(barbers.map((b) => b.id));
  const portfolio = ((portfolioRes.data ?? []) as Row[])
    .map((r) => normalizePortfolio(r, supabaseUrl))
    .filter((p): p is PortfolioItem => !!p && (!p.barber_id || publicBarberIds.has(p.barber_id)));

  const amenities = ((amenitiesRes.data ?? []) as Row[])
    .map((r) => r.amenity as Row | null)
    .filter((a): a is Row => !!a && a.is_active !== false)
    .map(
      (a): Amenity => ({
        id: String(a.id),
        slug: String(a.slug),
        name_en: String(a.name_en),
        name_ar: String(a.name_ar),
        icon: str(a.icon),
        sort: num(a.sort) ?? 0,
      }),
    )
    .sort((a, b) => a.sort - b.sort);

  const data: ShopProfileData = {
    shop,
    city: placesRes.city,
    area: placesRes.area,
    services: ((servicesRes.data ?? []) as Row[]).map((s) => ({
      id: String(s.id),
      name: String(s.name ?? ""),
      name_ar: str(s.name_ar),
      duration: num(s.duration) ?? 0,
      price: num(s.price) ?? 0,
      category_id: str(s.category_id),
    })),
    categories: ((categoriesRes.data ?? []) as Row[]).map(
      (c): ServiceCategory => ({
        id: String(c.id),
        slug: String(c.slug),
        name_en: String(c.name_en),
        name_ar: String(c.name_ar),
        sort: num(c.sort) ?? 0,
      }),
    ),
    reviews,
    ratings,
    barbers,
    hours,
    photos,
    portfolio,
    amenities,
    preview,
  };
  return { status: "ok", data };
}

async function loadPlaces(supabase: AnyClient, shop: ShopData): Promise<{ city: PlaceName | null; area: PlaceName | null }> {
  const [city, area] = await Promise.all([
    shop.city_id
      ? supabase.from("cities").select("name_en, name_ar").eq("id", shop.city_id).maybeSingle()
      : Promise.resolve({ data: null }),
    shop.area_id
      ? supabase.from("areas").select("name_en, name_ar").eq("id", shop.area_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    city: (city.data as PlaceName | null) ?? null,
    area: (area.data as PlaceName | null) ?? null,
  };
}
