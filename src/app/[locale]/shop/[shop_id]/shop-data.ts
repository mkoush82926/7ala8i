/**
 * Data loading for the public shop profile. Shared by the server page (SSR +
 * metadata) and the client component (mock mode / retry), so both read the
 * same anon-readable columns. Never select("*") on shops or profiles: anon
 * only has column grants on the public subset.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkingHourRow } from "../shop-utils";

export interface ShopData {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  google_maps_url: string | null;
  currency: string | null;
  timezone: string | null;
  cancellation_policy_hours: number | null;
}

export interface ServiceData {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
}

export interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
}

export interface BarberData {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ShopProfileData {
  shop: ShopData;
  services: ServiceData[];
  reviews: ReviewData[];
  /** Every rating for the shop (capped), for the average + distribution. */
  ratings: number[];
  barbers: BarberData[];
  hours: WorkingHourRow[];
}

export type ShopProfileResult =
  | { status: "ok"; data: ShopProfileData }
  | { status: "not_found" }
  | { status: "error" };

export const SHOP_COLUMNS =
  "id, name, description, address, phone, whatsapp, instagram, google_maps_url, currency, timezone, cancellation_policy_hours";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function loadShopProfile(supabase: AnyClient, shopId: string): Promise<ShopProfileResult> {
  const shopRes = await supabase.from("shops").select(SHOP_COLUMNS).eq("id", shopId).maybeSingle();
  if (shopRes.error) {
    // 22P02 = invalid uuid text → treat as "no such shop".
    return shopRes.error.code === "22P02" ? { status: "not_found" } : { status: "error" };
  }
  if (!shopRes.data) return { status: "not_found" };

  const [servicesRes, reviewsRes, ratingsRes, barbersRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, name_ar, duration, price")
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
      .select("id, full_name, avatar_url")
      .eq("shop_id", shopId)
      .in("role", ["barber", "shop_admin"])
      .order("full_name", { ascending: true }),
  ]);

  const barbers = ((barbersRes.data ?? []) as BarberData[]).filter((b) => b.full_name?.trim());
  let hours: WorkingHourRow[] = [];
  if (barbers.length > 0) {
    const hoursRes = await supabase
      .from("working_hours")
      .select("barber_id, day_of_week, is_working, start_time, end_time")
      .in(
        "barber_id",
        barbers.map((b) => b.id),
      );
    hours = (hoursRes.data ?? []) as WorkingHourRow[];
  }

  const reviews = (reviewsRes.data ?? []) as ReviewData[];
  const ratings = ratingsRes.error
    ? reviews.map((r) => r.rating)
    : ((ratingsRes.data ?? []) as { rating: number }[]).map((r) => r.rating);

  return {
    status: "ok",
    data: {
      shop: shopRes.data as ShopData,
      services: ((servicesRes.data ?? []) as ServiceData[]).map((s) => ({ ...s, price: Number(s.price) || 0 })),
      reviews,
      ratings,
      barbers,
      hours,
    },
  };
}
