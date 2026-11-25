// Marketplace results (WS-1B). The URL is the search state; places and
// categories are loaded on the server, results are fetched from the browser
// so the per-IP search rate limit applies to the visitor, not the server.
import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { SiteHeader } from "@/components/search/site-header";
import { SearchResults } from "@/components/search/search-results";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-4" aria-hidden="true">
      <Skeleton className="h-[60px] w-full rounded-2xl" />
      <Skeleton className="mt-3 h-9 w-3/4 rounded-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] w-full rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}

export default async function ExplorePage() {
  const { cities, categories } = await loadSearchShell();
  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <SiteHeader />
      <main id="main-content" className="pb-24">
        <Suspense fallback={<ResultsFallback />}>
          <SearchResults cities={cities} categories={categories} initial={null} />
        </Suspense>
      </main>
    </div>
  );
}
