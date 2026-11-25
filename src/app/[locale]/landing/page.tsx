// Consumer marketplace home (WS-1B). Guests land here from "/" (middleware).
// A Server Component: copy, categories, stats and reviews render on the
// server; the search bar, "Book again" rail, reviews carousel, header and
// install prompt are client islands. The shop-owner pitch lives at
// /for-business.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarCheck, MapPin, Search, Store } from "lucide-react";
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
import { homeCounter, homeStats, popularAreas } from "./home-utils";

type Props = { params: Promise<{ locale: string }> };

function resolve(raw: string | undefined): { locale: "en" | "ar"; t: TranslationKeys; isRTL: boolean } {
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
      languages: { en: "/en/landing", ar: "/ar/landing", "x-default": "/ar/landing" },
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

function SectionTitle({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[20px] font-bold leading-tight text-[var(--text-primary)] md:text-[24px]">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{subtitle}</p>}
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
    <section aria-labelledby="home-stats" className="bg-[var(--brand-primary)] text-[var(--brand-on-primary)]">
      <div className="mx-auto max-w-[1180px] px-4 py-10 md:py-12">
        <h2 id="home-stats" className="sr-only">
          {S.statsTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
          {items.map((it) => (
            <div key={it.key} className="flex flex-col-reverse text-center">
              <dt className="mt-1 text-[13px] opacity-80">{labels[it.key]}</dt>
              <dd data-dynamic className="text-[28px] font-bold tabular-nums md:text-[34px]">
                {it.key === "rating"
                  ? formatLocalizedNumber(it.value, locale, "auto", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : formatLocalizedNumber(it.value, locale)}
                {it.plus && <span aria-hidden="true">+</span>}
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
    <nav aria-label={label} className="mt-4">
      <ul className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              href={searchHref(locale, { city: city.slug, area: a.slug })}
              className="focus-ring inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-brass)] hover:text-[var(--text-primary)]"
            >
              <MapPin size={13} aria-hidden="true" />
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
  const L = t.landing;
  const data = await loadHomeData();
  const Forward = isRTL ? ArrowLeft : ArrowRight;
  const cityName = data.defaultCity ? (locale === "ar" ? data.defaultCity.nameAr : data.defaultCity.nameEn) : S.defaultCity;
  const counter = homeCounter(data.cityStats ?? data.stats);
  const year = new Date().getFullYear();
  const origin = siteOrigin();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Halaqy",
    url: `${origin}/${locale}/landing`,
    inLanguage: locale === "ar" ? "ar-JO" : "en",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/${locale}/explore?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  const steps = [
    { icon: Search, title: S.howStep1Title, body: S.howStep1Body },
    { icon: CalendarCheck, title: S.howStep2Title, body: S.howStep2Body },
    { icon: Store, title: S.howStep3Title, body: S.howStep3Body },
  ];

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <SiteHeader />

      <main id="main-content">
        {/* ── Hero + search ─────────────────────────────────────────────── */}
        <section aria-labelledby="home-hero" className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="mx-auto max-w-[1180px] px-4 pb-10 pt-8 md:pb-14 md:pt-14">
            <p className="eyebrow mb-3">{S.heroEyebrow}</p>
            <h1
              id="home-hero"
              className="max-w-[18ch] text-[32px] font-bold leading-[1.15] text-[var(--text-primary)] md:text-[48px]"
              style={{ letterSpacing: isRTL ? "normal" : "-0.02em" }}
            >
              {S.heroTitle}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-[var(--text-secondary)] md:text-[17px]">{S.heroSubtitle}</p>

            <div className="mt-6 md:mt-8">
              <SearchBar cities={data.cities} categories={data.categories} variant="hero" collapsible={false} />
            </div>

            {counter && (
              <p data-dynamic className="mt-4 flex items-center gap-2 text-[14px] text-[var(--text-secondary)]" role="status">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--accent-brass)]" />
                {counter.kind === "today"
                  ? fill(S.bookedToday, { count: formatLocalizedNumber(counter.value, locale), city: cityName })
                  : fill(S.shopsReady, { count: formatLocalizedNumber(counter.value, locale), city: cityName })}
              </p>
            )}

            {data.defaultCity && <AreaChips city={data.defaultCity} locale={locale} label={S.popularAreas} />}
          </div>
        </section>

        {/* ── Book again (signed-in customers only; hides itself otherwise) ── */}
        <div className="mx-auto max-w-[1180px] px-4">
          <BookAgainRail />
        </div>

        {/* ── Categories ────────────────────────────────────────────────── */}
        {data.categories.length > 0 && (
          <section aria-labelledby="home-categories" className="mx-auto max-w-[1180px] px-4 py-10 md:py-12">
            <SectionTitle
              id="home-categories"
              title={S.categoriesTitle}
              subtitle={S.categoriesSubtitle}
              action={
                <Link href={searchHref(locale)} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-md text-[14px] font-semibold text-[var(--accent-text)] hover:underline underline-offset-4">
                  {S.browseAll}
                  <Forward size={15} aria-hidden="true" />
                </Link>
              }
            />
            <CategoryTiles categories={data.categories} locale={locale} label={S.categoriesTitle} />
          </section>
        )}

        {/* ── Recent reviews ────────────────────────────────────────────── */}
        {data.reviews.length > 0 && (
          <section aria-labelledby="home-reviews" className="mx-auto max-w-[1180px] px-4 pb-10 md:pb-12">
            <SectionTitle id="home-reviews" title={S.reviewsTitle} subtitle={S.reviewsSubtitle} />
            <ReviewsCarousel reviews={data.reviews} headingId="home-reviews" />
          </section>
        )}

        {/* ── Stats band ────────────────────────────────────────────────── */}
        {data.stats && <StatsBand stats={data.stats} locale={locale} t={t} />}

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section aria-labelledby="home-how" className="mx-auto max-w-[1180px] px-4 py-10 md:py-14">
          <SectionTitle id="home-how" title={S.howTitle} />
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
                  <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--accent-text)]">
                    <Icon size={19} />
                  </span>
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{step.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">{step.body}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-6">
            <Link href={searchHref(locale)} className="btn btn-primary focus-ring inline-flex items-center gap-2">
              {S.exploreCta}
              <Forward size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ── Business CTA ──────────────────────────────────────────────── */}
        <section aria-labelledby="home-business" className="mx-auto max-w-[1180px] px-4 pb-12 md:pb-16">
          <div className="flex flex-col gap-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-[56ch]">
              <p className="eyebrow mb-2">{S.businessEyebrow}</p>
              <h2 id="home-business" className="text-[22px] font-bold leading-tight text-[var(--text-primary)] md:text-[28px]">
                {S.businessTitle}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">{S.businessBody}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
              <Link href={`/${locale}/start`} className="btn btn-primary focus-ring inline-flex items-center justify-center gap-2">
                {S.businessCta}
                <Forward size={16} aria-hidden="true" />
              </Link>
              <Link href={`/${locale}/for-business`} className="btn btn-secondary focus-ring inline-flex items-center justify-center">
                {S.businessLearnMore}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:flex-row md:items-center md:justify-between">
          <span dir="ltr" className="text-[17px] font-bold text-[var(--text-primary)]">
            Halaqy<span className="text-[var(--accent-brass)]">.</span>
          </span>
          <nav aria-label={L.legal}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[var(--text-secondary)]">
              <li>
                <Link href={`/${locale}/for-business`} className="focus-ring rounded-sm hover:underline underline-offset-4">
                  {S.forBusinessNav}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/privacy`} className="focus-ring rounded-sm hover:underline underline-offset-4">
                  {L.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="focus-ring rounded-sm hover:underline underline-offset-4">
                  {L.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/policy`} className="focus-ring rounded-sm hover:underline underline-offset-4">
                  {L.cancellationPolicy}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-[13px] text-[var(--text-muted)]">
            <span dir="ltr">© {year} Halaqy.</span> {L.allRightsReserved}
          </p>
        </div>
      </footer>

      <PwaInstallPrompt />
    </div>
  );
}
