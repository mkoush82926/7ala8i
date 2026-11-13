import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import ExploreClient from "./explore-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const t = isAr ? ar : en;
  return {
    title: t.explore.metaTitle,
    description: t.explore.metaDescription,
    alternates: {
      canonical: isAr ? "/ar/explore" : "/en/explore",
      languages: { en: "/en/explore", ar: "/ar/explore", "x-default": "/en/explore" },
    },
    openGraph: {
      title: t.explore.metaTitle,
      description: t.explore.metaDescription,
      type: "website",
      locale: isAr ? "ar_JO" : "en_US",
      alternateLocale: isAr ? ["en_US"] : ["ar_JO"],
    },
  };
}

export default function ExplorePage() {
  return <ExploreClient />;
}
