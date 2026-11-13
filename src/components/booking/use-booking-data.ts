"use client";

// Catalogue for the public booking flow: shop, services (+ variants and
// categories), barbers (+ capabilities / price overrides) and the rating.
// New v2 columns are read defensively: an older database (columns missing)
// falls back to the legacy column set instead of failing the page.

import { useMemo } from "react";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { normalizeService, type BarberServiceRow, type ServiceRow, type VariantRow } from "./booking-state";

export interface BookingShop {
  id: string;
  name: string;
  name_ar: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  currency: string | null;
  timezone: string | null;
  cancellation_policy_hours: number | null;
  important_info_en: string | null;
  important_info_ar: string | null;
}

export interface BookingBarber {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  online_bookable: boolean;
  barber_services: BarberServiceRow[];
}

export interface BookingCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

export interface BookingCatalog {
  shop: BookingShop | null;
  services: ServiceRow[];
  barbers: BookingBarber[];
  categories: BookingCategory[];
  rating: { avg: number; count: number };
}

type Res<T> = { data: T | null; error: { message: string } | null };

const SHOP_BASE = "id, name, address, phone, whatsapp, currency, timezone, cancellation_policy_hours";
const SHOP_V2 = `${SHOP_BASE}, name_ar, important_info_en, important_info_ar`;
const BARBER_BASE = "id, full_name, avatar_url, role, barber_services(service_id, is_active)";
const BARBER_V2 = "id, full_name, avatar_url, role, online_bookable, barber_services(service_id, is_active, price_override, duration_override)";

/** Runs the v2 select, then the legacy one if the first fails. */
async function withFallback<T>(primary: () => PromiseLike<Res<T>>, legacy: () => PromiseLike<Res<T>>): Promise<Res<T>> {
  const first = await primary();
  if (!first.error) return first;
  return legacy();
}

export async function loadBookingCatalog(client: unknown, shopId: string): Promise<Res<BookingCatalog>> {
  // The browser client is untyped here (tables newer than database.types.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const shopQ = withFallback<BookingShop>(
    () => db.from("shops").select(SHOP_V2).eq("id", shopId).maybeSingle(),
    () => db.from("shops").select(SHOP_BASE).eq("id", shopId).maybeSingle(),
  );
  const servicesQ: PromiseLike<Res<Record<string, unknown>[]>> = db
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true });
  const variantsQ: PromiseLike<Res<VariantRow[]>> = db
    .from("service_variants")
    .select("id, service_id, name_en, name_ar, price, duration, sort")
    .eq("shop_id", shopId)
    .eq("is_active", true);
  const categoriesQ: PromiseLike<Res<BookingCategory[]>> = db
    .from("service_categories")
    .select("id, slug, name_en, name_ar, sort")
    .eq("is_active", true);
  const barbersQ = withFallback<BookingBarber[]>(
    () => db.from("profiles").select(BARBER_V2).eq("shop_id", shopId).in("role", ["barber", "shop_admin"]),
    () => db.from("profiles").select(BARBER_BASE).eq("shop_id", shopId).in("role", ["barber", "shop_admin"]),
  );
  const reviewsQ: PromiseLike<Res<{ rating: number }[]>> = db.from("reviews").select("rating").eq("shop_id", shopId).limit(500);

  const [shop, services, variants, categories, barbers, reviews] = await Promise.all([
    shopQ,
    servicesQ,
    Promise.resolve(variantsQ).catch(() => ({ data: [], error: null })),
    Promise.resolve(categoriesQ).catch(() => ({ data: [], error: null })),
    barbersQ,
    Promise.resolve(reviewsQ).catch(() => ({ data: [], error: null })),
  ]);

  const failed = [shop, services, barbers].find((r) => r.error);
  if (failed?.error) return { data: null, error: failed.error };

  const variantRows = (variants.error ? [] : variants.data ?? []).map((v) => ({
    ...v,
    price: Number(v.price) || 0,
    duration: Number(v.duration) || 0,
    sort: Number(v.sort) || 0,
  }));
  const serviceRows = (services.data ?? [])
    .map((row) => normalizeService(row, variantRows))
    // Hidden from online booking by the owner.
    .filter((s) => s.online_bookable);
  const ratings = reviews.error ? [] : reviews.data ?? [];
  const count = ratings.length;
  const avg = count ? ratings.reduce((a, r) => a + Number(r.rating || 0), 0) / count : 0;

  return {
    data: {
      shop: shop.data
        ? {
            ...shop.data,
            name_ar: shop.data.name_ar ?? null,
            important_info_en: shop.data.important_info_en ?? null,
            important_info_ar: shop.data.important_info_ar ?? null,
          }
        : null,
      services: serviceRows,
      barbers: (barbers.data ?? []).map((b) => ({
        ...b,
        online_bookable: b.online_bookable !== false,
        barber_services: (b.barber_services ?? []).map((r) => ({
          ...r,
          price_override: r.price_override == null ? null : Number(r.price_override),
          duration_override: r.duration_override == null ? null : Number(r.duration_override),
        })),
      })),
      categories: (categories.error ? [] : categories.data ?? []).sort((a, b) => a.sort - b.sort),
      rating: { avg, count },
    },
    error: null,
  };
}

export function useBookingCatalog(client: unknown, shopId: string) {
  const query = useSupabaseQuery<BookingCatalog>(() => loadBookingCatalog(client, shopId), [shopId], {
    enabled: !!shopId,
  });
  const servicesById = useMemo(
    () => new Map((query.data?.services ?? []).map((s) => [s.id, s] as const)),
    [query.data],
  );
  const bookableBarbers = useMemo(
    () =>
      [...(query.data?.barbers ?? [])]
        .filter((b) => b.online_bookable)
        .sort((a, b) => Number(b.role === "barber") - Number(a.role === "barber")),
    [query.data],
  );
  return { ...query, servicesById, bookableBarbers };
}
