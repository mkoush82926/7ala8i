/**
 * Public barber page data (/barber/[handle]). Anon-readable columns only.
 * A barber is public when their profile is_public and their shop is
 * published; staff of the shop can preview either way.
 */
import { publicEnv } from "@/lib/env";
import { parseHandle } from "@/components/shop/lib/slug";
import type {
  BarberData,
  PortfolioItem,
  ReviewData,
  ServiceCategory,
  ServiceData,
  ShopData,
} from "@/components/shop/lib/types";
import {
  BARBER_COLUMNS,
  findShop,
  normalizeBarber,
  normalizePortfolio,
  viewerIsStaff,
  type AnyClient,
} from "../../shop/[shop_id]/shop-data";

export interface BarberReview extends ReviewData {
  service_name: string | null;
  service_name_ar: string | null;
}

export interface BarberProfileData {
  barber: BarberData;
  shop: ShopData;
  services: ServiceData[];
  categories: ServiceCategory[];
  portfolio: PortfolioItem[];
  reviews: BarberReview[];
  /** Other public barbers of the same shop. */
  colleagues: BarberData[];
  preview: boolean;
}

export type BarberProfileResult = { status: "ok"; data: BarberProfileData } | { status: "not_found" } | { status: "error" };

type Row = Record<string, unknown>;

/**
 * Services a barber offers: their active barber_services rows when they have
 * any, otherwise every active shop service (shops that never assigned).
 */
export function servicesForBarber(
  shopServices: readonly ServiceData[],
  assignments: readonly { service_id: string; is_active: boolean | null }[],
): ServiceData[] {
  if (assignments.length === 0) return [...shopServices];
  const allowed = new Set(assignments.filter((a) => a.is_active !== false).map((a) => a.service_id));
  return shopServices.filter((s) => allowed.has(s.id));
}

export async function loadBarberProfile(
  supabase: AnyClient,
  rawHandle: string,
  options: { supabaseUrl?: string | null } = {},
): Promise<BarberProfileResult> {
  const handle = parseHandle(rawHandle);
  if (!handle) return { status: "not_found" };
  const supabaseUrl = options.supabaseUrl ?? publicEnv.supabaseUrl ?? null;

  const profileRes = await supabase
    .from("profiles")
    .select(`${BARBER_COLUMNS}, shop_id`)
    .eq("handle", handle)
    .in("role", ["barber", "shop_admin"])
    .maybeSingle();
  if (profileRes.error) return { status: "error" };
  const row = profileRes.data as Row | null;
  if (!row || typeof row.shop_id !== "string") return { status: "not_found" };

  const shopRes = await findShop(supabase, row.shop_id);
  if (shopRes.status !== "ok") return shopRes;
  const shop = shopRes.shop;

  const isPublic = row.is_public !== false && shop.is_published;
  let preview = false;
  if (!isPublic) {
    if (!(await viewerIsStaff(supabase, shop.id))) return { status: "not_found" };
    preview = true;
  }

  const barberId = String(row.id);
  const [ratingRes, servicesRes, assignRes, portfolioRes, reviewsRes, colleaguesRes, categoriesRes] = await Promise.all([
    supabase.from("barber_rating_view").select("rating_avg, rating_count").eq("barber_id", barberId).maybeSingle(),
    supabase
      .from("services")
      .select("id, name, name_ar, duration, price, category_id")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true }),
    supabase.from("barber_services").select("service_id, is_active").eq("barber_id", barberId),
    supabase
      .from("portfolio_items")
      .select("id, barber_id, service_id, path, caption, caption_ar, sort_order, is_featured, blur_data, created_at")
      .eq("barber_id", barberId)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(60),
    supabase.rpc("get_barber_reviews", { p_barber_id: barberId, p_limit: 12 }),
    supabase
      .from("profiles")
      .select(BARBER_COLUMNS)
      .eq("shop_id", shop.id)
      .in("role", ["barber", "shop_admin"])
      .neq("id", barberId)
      .order("full_name", { ascending: true })
      .limit(12),
    supabase.from("service_categories").select("id, slug, name_en, name_ar, sort").order("sort", { ascending: true }),
  ]);

  const rating = ratingRes.data as { rating_avg: unknown; rating_count: unknown } | null;
  const barber = normalizeBarber(row, rating ?? undefined);

  const shopServices: ServiceData[] = ((servicesRes.data ?? []) as Row[]).map((s) => ({
    id: String(s.id),
    name: String(s.name ?? ""),
    name_ar: typeof s.name_ar === "string" ? s.name_ar : null,
    duration: Number(s.duration) || 0,
    price: Number(s.price) || 0,
    category_id: typeof s.category_id === "string" ? s.category_id : null,
  }));
  const assignments = ((assignRes.data ?? []) as Row[])
    .filter((a) => typeof a.service_id === "string")
    .map((a) => ({ service_id: String(a.service_id), is_active: a.is_active === false ? false : true }));

  const reviews: BarberReview[] = ((reviewsRes.data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    rating: Number(r.rating) || 0,
    comment: typeof r.comment === "string" ? r.comment : null,
    created_at: String(r.created_at),
    reviewer_name: typeof r.reviewer_name === "string" ? r.reviewer_name : null,
    service_name: typeof r.service_name === "string" ? r.service_name : null,
    service_name_ar: typeof r.service_name_ar === "string" ? r.service_name_ar : null,
  }));

  return {
    status: "ok",
    data: {
      barber,
      shop,
      services: servicesForBarber(shopServices, assignments),
      categories: ((categoriesRes.data ?? []) as Row[]).map((c) => ({
        id: String(c.id),
        slug: String(c.slug),
        name_en: String(c.name_en),
        name_ar: String(c.name_ar),
        sort: Number(c.sort) || 0,
      })),
      portfolio: ((portfolioRes.data ?? []) as Row[])
        .map((r) => normalizePortfolio(r, supabaseUrl))
        .filter((p): p is PortfolioItem => !!p),
      reviews,
      colleagues: ((colleaguesRes.data ?? []) as Row[])
        .map((r) => normalizeBarber(r))
        .filter((b) => b.full_name && b.is_public && b.handle),
      preview,
    },
  };
}
