import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { publicBookingSecurity } from "@/lib/otp/config";
import { BookingShell } from "./booking-shell";

type Params = Promise<{ locale: string; shop_id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Readable shop slugs (shops.slug / shops.slug_ar, WS-P0). */
const SLUG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

type ShopRef = { id: string; name: string; name_ar: string | null };

/**
 * Shop for the header and metadata, by id or readable slug. `undefined` =
 * the server could not tell (mock mode, transient error): the client engine
 * still loads the shop by id itself and renders its own not-found state.
 */
const getShop = cache(async (ref: string): Promise<ShopRef | null | undefined> => {
  if (MOCK_DATA_ENABLED) return UUID_RE.test(ref) ? undefined : null;
  const value = decodeURIComponent(ref).trim();
  const isId = UUID_RE.test(value);
  if (!isId && (value.length > 96 || !SLUG_RE.test(value))) return null;
  try {
    const supabase = await createClient();
    // Public column subset only (anon has column grants on shops).
    const base = supabase.from("shops").select("id, name, name_ar");
    const query = isId ? base.eq("id", value) : base.or(`slug.eq.${value.toLowerCase()},slug_ar.eq.${value}`);
    const { data, error } = (await query.limit(1).maybeSingle()) as { data: ShopRef | null; error: unknown };
    if (error) {
      if (!isId) return null;
      // Older database without name_ar: fall back to the name only.
      const legacy = (await supabase.from("shops").select("id, name").eq("id", value).maybeSingle()) as {
        data: { id: string; name: string } | null;
        error: unknown;
      };
      if (legacy.error) return undefined;
      return legacy.data ? { ...legacy.data, name_ar: null } : null;
    }
    return data ?? null;
  } catch {
    return isId ? undefined : null;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, shop_id } = await params;
  const t = locale === "ar" ? ar : en;
  const shop = await getShop(shop_id);
  if (shop === null) return { title: t.booking.shopNotFound, robots: { index: false } };
  const name = shop ? (locale === "ar" && shop.name_ar ? shop.name_ar : shop.name) : null;
  const title = name ? `${t.booking.bookAppointment} · ${name}` : t.booking.bookAppointment;
  return {
    title,
    description: t.booking.metaDescription,
    // A step-by-step flow; the shop page is the canonical, indexable surface.
    robots: { index: false, follow: true },
    openGraph: { title, description: t.booking.metaDescription, type: "website" },
  };
}

export default async function BookingShopPage({ params }: { params: Params }) {
  const { locale, shop_id } = await params;
  const shop = await getShop(shop_id);
  if (shop === null) notFound();
  const name = shop ? (locale === "ar" && shop.name_ar ? shop.name_ar : shop.name) : null;
  // OTP / Turnstile flags are resolved on the server (provider secrets stay
  // there); with nothing configured this is OTP_DISABLED.
  return <BookingShell shopId={shop?.id ?? shop_id} shopName={name} security={publicBookingSecurity()} />;
}
