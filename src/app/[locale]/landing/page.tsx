// Consumer marketplace home (WS-1B). Guests land here from "/" (middleware).
// A Server Component: copy, categories, stats and reviews render on the
// server; the search bar, "Book again" rail, reviews carousel, header and
// install prompt are client islands. The shop-owner pitch lives at
// /for-business.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarCheck, MapPin, Search, Star, Store } from "lucide-react";
import en, { type TranslationKeys } from "@/i18n/en";
import ar from "@/i18n/ar";
import { formatLocalizedNumber } from "@/lib/format";
import { searchHref, type PublicStats, type SearchCity } from "@/lib/search";
import { loadHomeData } from "@/lib/search/server";
import { serializeJsonLd } from "@/components/shop/lib/jsonld";
import { siteOrigin } from "@/components/shop/lib/site";
import { SiteHeader } from "@/components/search/site-header";
import { SearchBar } from "@/components/search/search-bar";
import { CategoryTiles } from "@/components/search/category-tiles";
import { BookAgainRail } from "@/components/search/book-again-rail";
import { ReviewsCarousel } from "@/components/search/reviews-carousel";
import { PwaInstallPrompt } from "@/components/search/pwa-install-prompt";
import { SiteFooter } from "@/components/search/site-footer";
import { ButtonLink } from "@/components/ui/button";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { buttonClasses, cardClasses, containerClasses, filterChipClasses } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { homeCounter, homeStats, popularAreas } from "./home-utils";

type Props = { params: Promise<{ locale: string }> };

function resolve(raw: string | undefined): {
  locale: "en" | "ar";
  t: TranslationKeys;
  isRTL: boolean;
} {
  const locale = raw === "ar" ? "ar" : "en";
  return { locale, t: locale === "ar" ? ar : en, isRTL: locale === "ar" };
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolve((await params).locale);
  return {
    title: { absolute: t.search.homeMetaTitle },
    description: t.search.homeMetaDescription,
    alternates: {
      canonical: `/${locale}/landing`,
      languages: {
        en: "/en/landing",
        ar: "/ar/landing",
        "x-default": "/ar/landing",
      },
    },
    openGraph: {
      url: `/${locale}/landing`,
      title: t.search.homeMetaTitle,
      description: t.search.homeMetaDescription,
      type: "website",
      locale: locale === "ar" ? "ar_JO" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_JO"],
    },
  };
}

function SectionTitle({
  id,
  title,
  subtitle,
  action,
  reserveEnd = false,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Leave room at the end for controls placed over the heading row (carousel arrows). */
  reserveEnd?: boolean;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", reserveEnd && "md:pe-28")}>
      <div className="min-w-0">
        <h2 id={id} className="text-h2 text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatsBand({ stats, locale, t }: { stats: PublicStats; locale: string; t: TranslationKeys }) {
  const items = homeStats(stats);
  if (items.length === 0) return null;
  const S = t.search;
  const labels: Record<(typeof items)[number]["key"], string> = {
    shops: S.statShops,
    barbers: S.statBarbers,
    bookings: S.statBookings,
    rating: S.statRating,
  };
  return (
    <section aria-labelledby="home-stats" className="border-y border-line bg-card">
      <div className={cn(containerClasses, "py-12")}>
        <h2 id="home-stats" className="sr-only">
          {S.statsTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.key}
              className="flex flex-col-reverse items-center gap-1 text-center lg:border-s lg:border-line lg:first:border-s-0"
            >
              <dt className="text-sm text-ink-muted">{labels[it.key]}</dt>
              <dd data-dynamic className="inline-flex items-center gap-1.5 text-[40px] font-bold leading-[48px] tabular-nums text-ink">
                {it.key === "rating" && <Star aria-hidden="true" className="size-7 fill-accent text-accent" />}
                {it.key === "rating"
                  ? formatLocalizedNumber(it.value, locale, "auto", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })
                  : formatLocalizedNumber(it.value, locale)}
                {it.plus && (
                  <span aria-hidden="true" className="text-brand-text">
                    +
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function AreaChips({ city, locale, label }: { city: SearchCity; locale: string; label: string }) {
  const areas = popularAreas(city, 8);
  if (areas.length === 0) return null;
  return (
    <nav aria-label={label} className="mt-6">
      <p aria-hidden="true" className="mb-3 text-meta font-medium text-ink-muted">
        {label}
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              href={searchHref(locale, { city: city.slug, area: a.slug })}
              className={cn(filterChipClasses, "h-9 bg-card/80 shadow-xs")}
            >
              <MapPin aria-hidden="true" className="text-ink-muted" />
              {locale === "ar" ? a.nameAr : a.nameEn}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function HomePage({ params }: Props) {
  const { locale, t, isRTL } = resolve((await params).locale);
  const S = t.search;
  const data = await loadHomeData();
  const Forward = isRTL ? ArrowLeft : ArrowRight;
  const cityName = data.defaultCity ? (locale === "ar" ? data.defaultCity.nameAr : data.defaultCity.nameEn) : S.defaultCity;
  const counter = homeCounter(data.cityStats ?? data.stats);
  const origin = siteOrigin();
  const otherLocale = locale === "ar" ? "en" : "ar";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Halaqy",
    url: `${origin}/${locale}/landing`,
    inLanguage: locale === "ar" ? "ar-JO" : "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/${locale}/explore?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const steps = [
    { icon: Search, title: S.howStep1Title, body: S.howStep1Body },
    { icon: CalendarCheck, title: S.howStep2Title, body: S.howStep2Body },
    { icon: Store, title: S.howStep3Title, body: S.howStep3Body },
  ];

  return (
    <div className="relative isolate min-h-dvh bg-page text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Hero backdrop: sand with one soft teal glow at the top-end (no photo collage). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(60%_50%_at_85%_0%,var(--color-brand-soft),transparent)] rtl:bg-[radial-gradient(60%_50%_at_15%_0%,var(--color-brand-soft),transparent)]"
      />
      <SiteHeader transparentAtTop />

      <main id="main-content">
        {/* ── Hero + search ─────────────────────────────────────────────── */}
        <section aria-labelledby="home-hero" className={cn(containerClasses, "pb-12 pt-10 text-center md:pb-20 md:pt-20")}>
          <p className="eyebrow fade-slide-up mb-4">{S.heroEyebrow}</p>
          <h1 id="home-hero" className="text-display fade-slide-up fade-slide-up-delay-1 mx-auto max-w-[18ch] text-balance text-ink">
            {S.heroTitle}
          </h1>
          <p className="text-body-lg fade-slide-up fade-slide-up-delay-2 mx-auto mt-4 max-w-2xl text-ink-soft">{S.heroSubtitle}</p>

          <div className="fade-slide-up fade-slide-up-delay-3 mx-auto mt-8 max-w-4xl text-start md:mt-10">
            <SearchBar cities={data.cities} categories={data.categories} variant="hero" collapsible={false} />
          </div>

          {data.defaultCity && <AreaChips city={data.defaultCity} locale={locale} label={S.popularAreas} />}

          {counter && (
            <p data-dynamic role="status" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft">
              <span aria-hidden="true" className="relative inline-flex size-2.5 rounded-full bg-success ring-4 ring-success-soft" />
              {counter.kind === "today"
                ? fill(S.bookedToday, {
                    count: formatLocalizedNumber(counter.value, locale),
                    city: cityName,
                  })
                : fill(S.shopsReady, {
                    count: formatLocalizedNumber(counter.value, locale),
                    city: cityName,
                  })}
            </p>
          )}
        </section>

        {/* ── Book again (signed-in customers only; hides itself otherwise) ── */}
        <div className={containerClasses}>
          <BookAgainRail />
        </div>

        {/* ── Categories ────────────────────────────────────────────────── */}
        {data.categories.length > 0 && (
          <section aria-labelledby="home-categories" className={cn(containerClasses, "py-10 md:py-16")}>
            <SectionTitle
              id="home-categories"
              title={S.categoriesTitle}
              subtitle={S.categoriesSubtitle}
              action={
                <Link
                  href={searchHref(locale)}
                  className={buttonClasses({
                    variant: "ghost",
                    size: "sm",
                    className: "shrink-0 text-brand-text hover:text-brand-hover",
                  })}
                >
                  {S.browseAll}
                  <Forward aria-hidden="true" />
                </Link>
              }
            />
            <CategoryTiles categories={data.categories} locale={locale} label={S.categoriesTitle} />
          </section>
        )}

        {/* ── Recent reviews ────────────────────────────────────────────── */}
        {data.reviews.length > 0 && (
          <section aria-labelledby="home-reviews" className={cn(containerClasses, "pb-10 md:pb-16")}>
            <SectionTitle id="home-reviews" title={S.reviewsTitle} subtitle={S.reviewsSubtitle} reserveEnd />
            <ReviewsCarousel reviews={data.reviews} headingId="home-reviews" />
          </section>
        )}

        {/* ── Stats band ────────────────────────────────────────────────── */}
        {data.stats && <StatsBand stats={data.stats} locale={locale} t={t} />}

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section aria-labelledby="home-how" className={cn(containerClasses, "py-10 md:py-16")}>
          <SectionTitle id="home-how" title={S.howTitle} />
          <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={i}
                  className={cardClasses({
                    elevation: "card",
                    className: "relative flex flex-col gap-3 p-5 md:p-6",
                  })}
                >
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden="true"
                      className="grid size-10 place-items-center rounded-full bg-brand-soft font-bold tabular-nums text-brand-text"
                    >
                      {formatLocalizedNumber(i + 1, locale)}
                    </span>
                    <Icon aria-hidden="true" className="size-5 text-ink-muted" />
                  </div>
                  <h3 className="text-h3 mt-1 text-ink">{step.title}</h3>
                  <p className="text-body text-ink-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={searchHref(locale)} size="lg" iconEnd={<Forward />}>
              {S.exploreCta}
            </ButtonLink>
          </div>
        </section>

        {/* ── Business band ─────────────────────────────────────────────── */}
        <section aria-labelledby="home-business" className={cn(containerClasses, "pb-4")}>
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-inverse p-6 text-on-inverse sm:p-8 md:grid-cols-2 md:gap-12 md:p-14">
            <div className="max-w-[56ch]">
              <p className="mb-3 text-sm font-semibold text-on-inverse-brand">{S.businessEyebrow}</p>
              <h2 id="home-business" className="text-h1">
                {S.businessTitle}
              </h2>
              <p className="text-body-lg mt-3 opacity-80">{S.businessBody}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  href={`/${locale}/start`}
                  size="lg"
                  iconEnd={<Forward />}
                  className="bg-card text-ink shadow-xs hover:bg-sunken active:bg-sunken-2"
                >
                  {S.businessCta}
                </ButtonLink>
                <ButtonLink
                  href={`/${locale}/for-business`}
                  variant="ghost"
                  size="lg"
                  className="border border-on-inverse/30 text-on-inverse hover:bg-on-inverse/10 hover:text-on-inverse"
                >
                  {S.businessLearnMore}
                </ButtonLink>
              </div>
            </div>
            <div className="relative">
              <PhotoFrame
                src="/videos/2-poster.jpg"
                alt=""
                ratio="4/3"
                rounded="2xl"
                sizes="(min-width: 768px) 560px, 100vw"
                fallbackName="Halaqy"
                className="shadow-float"
              />
            </div>
          </div>
        </section>

        <div className={containerClasses}>
          <PwaInstallPrompt className="mt-10" />
        </div>
      </main>

      <SiteFooter locale={locale} t={t} languageHref={`/${otherLocale}/landing`} />
    </div>
  );
}
