import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { buildBarberJsonLd, serializeJsonLd } from "@/components/shop/lib/jsonld";
import { barberPath, parseHandle, shopPath } from "@/components/shop/lib/slug";
import { readSrc } from "@/components/shop/lib/booking";
import { localizedText } from "@/components/shop/lib/media";
import { siteOrigin } from "@/components/shop/lib/site";
import { loadBarberProfile, type BarberProfileResult } from "./barber-data";
import BarberProfileClient from "./barber-profile-client";

type Params = Promise<{ locale: string; handle: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

const getBarber = cache(async (handle: string): Promise<BarberProfileResult | null> => {
  if (MOCK_DATA_ENABLED) return null;
  if (!parseHandle(handle)) return { status: "not_found" };
  try {
    const supabase = await createClient();
    const result = await loadBarberProfile(supabase, handle);
    return result.status === "error" ? null : result;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, handle } = await params;
  const t = locale === "ar" ? ar : en;
  const result = await getBarber(handle);
  if (result?.status === "not_found") return { title: t.barberPage.notFoundTitle, robots: { index: false } };
  if (!result || result.status !== "ok") return { title: t.explore.bookNow };

  const { barber, shop, portfolio, preview } = result.data;
  const loc = locale === "ar" ? "ar" : "en";
  const shopName = (loc === "ar" && shop.name_ar) || shop.name;
  const title = fill(t.barberPage.metaTitle, { name: barber.full_name, shop: shopName });
  const bio = localizedText(loc, barber.bio_en, barber.bio_ar);
  const description = (bio || fill(t.barberPage.metaDescription, { name: barber.full_name, shop: shopName })).slice(0, 300);
  const image = barber.avatar_url ?? portfolio[0]?.url ?? null;
  const handleOk = barber.handle ?? handle;

  return {
    title,
    description,
    alternates: {
      canonical: barberPath(handleOk, loc),
      languages: { en: barberPath(handleOk, "en"), ar: barberPath(handleOk, "ar"), "x-default": barberPath(handleOk, "en") },
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      type: "profile",
      locale: loc === "ar" ? "ar_JO" : "en_US",
      url: barberPath(handleOk, loc),
      ...(image ? { images: [{ url: image, alt: barber.full_name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function BarberPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, handle } = await params;
  const search = await searchParams;
  const result = await getBarber(handle);
  if (result?.status === "not_found") notFound();
  const data = result?.status === "ok" ? result.data : null;
  const loc = locale === "ar" ? "ar" : "en";

  let jsonLd: string | null = null;
  if (data && !data.preview && data.barber.handle) {
    const origin = siteOrigin();
    jsonLd = serializeJsonLd(
      buildBarberJsonLd({
        barber: data.barber,
        shopName: (loc === "ar" && data.shop.name_ar) || data.shop.name,
        shopUrl: `${origin}${shopPath(data.shop, loc)}`,
        url: `${origin}${barberPath(data.barber.handle, loc)}`,
        locale: loc,
        imageUrl: data.barber.avatar_url,
      }),
    );
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <BarberProfileClient handle={handle} initialData={data} src={readSrc(search)} />
    </>
  );
}
