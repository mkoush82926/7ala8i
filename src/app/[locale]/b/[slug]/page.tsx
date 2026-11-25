import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { publicBookingSecurity } from "@/lib/otp/config";
import { parseShopKey } from "@/components/shop/lib/slug";
import { BrandedBooking } from "@/components/links/branded-booking";
import { viewerIsStaff } from "@/app/[locale]/shop/[shop_id]/shop-data";
import { loadBrandedShop, shopDisplayName, toBrandedShop, type BrandedShopResult } from "@/components/links/branded-shop";
import { ensureLinkEntry, forwardQuery, linkSegment, normalizeToken, welcomeFor } from "@/components/links/link-utils";

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/**
 * Shop for the branded page (deduped between metadata and render). Mock mode
 * has no server data: a UUID key renders with a placeholder shop and the
 * client engine loads the real one.
 */
const getShop = cache(async (slug: string): Promise<BrandedShopResult> => {
  const key = parseShopKey(slug);
  if (key.kind === "invalid") return { status: "not_found" };
  if (MOCK_DATA_ENABLED) {
    return key.kind === "id" ? { status: "ok", shop: toBrandedShop({ id: key.value, name: "" }) } : { status: "not_found" };
  }
  try {
    const supabase = await createClient();
    return await loadBrandedShop(supabase as never, slug, { isStaff: (id) => viewerIsStaff(supabase as never, id) });
  } catch {
    return { status: "error" };
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = locale === "ar" ? ar : en;
  const result = await getShop(slug);
  if (result.status !== "ok") return { title: t.booking.bookAppointment, robots: { index: false, follow: false } };
  const name = shopDisplayName(result.shop, locale) || t.booking.bookAppointment;
  const title = fill(t.links.page.metaTitle, { name });
  const description = welcomeFor(result.shop.theme, locale) || fill(t.links.page.metaDescription, { name });
  const image = result.shop.cover_url ?? result.shop.logo_url;
  return {
    title,
    description,
    // The owner's private channel (also for marketplace-hidden shops): the
    // shop page is the indexable surface, so this page never is.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "ar" ? "ar_JO" : "en_US",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function BrandedBookingPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, slug } = await params;
  const search = await searchParams;
  const loc = locale === "ar" ? "ar" : "en";
  const result = await getShop(slug);
  if (result.status === "not_found") notFound();
  if (result.status === "error") {
    // Transient database failure: the plain booking route resolves the shop
    // itself and shows its own retry state.
    redirect(`/${loc}/book/${encodeURIComponent(slug)}?${forwardQuery(search).toString()}`);
  }
  const shop = result.shop;

  // Every booking from this page carries entry=link (booking_attribution),
  // so the funnel can tell it apart from marketplace bookings.
  const withEntry = ensureLinkEntry(search);
  if (withEntry !== null) redirect(`/${loc}/b/${encodeURIComponent(slug)}?${withEntry}`);

  const query = forwardQuery(search);
  const otherLoc = loc === "ar" ? "en" : "ar";
  const altLocaleHref = `/${otherLoc}/b/${encodeURIComponent(linkSegment(shop, otherLoc))}${query.toString() ? `?${query}` : ""}`;

  return (
    <BrandedBooking
      shop={shop}
      security={publicBookingSecurity()}
      src={normalizeToken(query.get("src"))}
      entry={normalizeToken(query.get("entry"))}
      embed={query.get("embed") === "1"}
      altLocaleHref={altLocaleHref}
    />
  );
}
