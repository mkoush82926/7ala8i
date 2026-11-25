// Marketplace results (WS-1B). The URL is the search state; places and
// categories are loaded on the server, results are fetched from the browser
// so the per-IP search rate limit applies to the visitor, not the server.
import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { SiteHeader } from "@/components/search/site-header";
import { SearchResults } from "@/components/search/search-results";
import { ShopCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { loadSearchShell } from "@/lib/search/server";
import { exploreRobots } from "./explore-utils";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const t = isAr ? ar : en;
  return {
    title: t.explore.metaTitle,
    description: t.explore.metaDescription,
    robots: exploreRobots(await searchParams),
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

function ResultsFallback() {
  return (
    <div aria-hidden="true">
      <div className="border-b border-line bg-page px-4 py-3 sm:px-6 lg:px-8">
        <Skeleton className="h-14 w-full rounded-2xl md:h-[60px] md:rounded-full" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="pill" className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className="px-4 pt-5 sm:px-6 lg:w-[53%] lg:px-8 lg:pt-6">
        <Skeleton className="mb-5 h-10 w-56 rounded-full" />
        <ShopCardSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" />
      </div>
    </div>
  );
}

export default async function ExplorePage() {
  const { cities, categories } = await loadSearchShell();
  return (
    <div className="min-h-dvh bg-page text-ink">
      <SiteHeader />
      <main id="main-content">
        <Suspense fallback={<ResultsFallback />}>
          <SearchResults cities={cities} categories={categories} initial={null} />
        </Suspense>
      </main>
    </div>
  );
}
