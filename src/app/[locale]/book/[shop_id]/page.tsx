import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { BookingShell } from "./booking-shell";

type Params = Promise<{ locale: string; shop_id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shop name for the header and metadata. `undefined` = the server could not
 * tell (mock mode, transient error): the client engine still loads the shop
 * itself and renders its own not-found state.
 */
const getShopName = cache(async (shopId: string): Promise<string | null | undefined> => {
  if (MOCK_DATA_ENABLED) return undefined;
  if (!UUID_RE.test(shopId)) return null;
  try {
    const supabase = await createClient();
    // Public column subset only (anon has column grants on shops).
    const { data, error } = (await supabase.from("shops").select("id, name").eq("id", shopId).maybeSingle()) as {
      data: { id: string; name: string } | null;
      error: unknown;
    };
    if (error) return undefined;
    return data?.name ?? null;
  } catch {
    return undefined;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, shop_id } = await params;
  const t = locale === "ar" ? ar : en;
  const name = await getShopName(shop_id);
  if (name === null) return { title: t.booking.shopNotFound, robots: { index: false } };
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
  const { shop_id } = await params;
  const name = await getShopName(shop_id);
  if (name === null) notFound();
  return <BookingShell shopId={shop_id} shopName={name ?? null} />;
}
