"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, Scissors, Share2, Star, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { MetaLine } from "@/components/ui/meta-line";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { StickyBar } from "@/components/ui/sticky-bar";
import { BrandedPlaceholder, PhotoFrame } from "@/components/ui/photo-frame";
import { pluralLabel } from "@/components/ui/booking-cta";
import { buttonClasses, cardClasses, containerClasses, focusRing, textLinkClasses } from "@/components/ui/recipes";
import { BarberAvatar } from "@/components/shop/team-grid";
import { ServicesSection } from "@/components/shop/services-section";
import { PortfolioGrid } from "@/components/shop/portfolio-grid";
import { RatingStars } from "@/components/shop/rating-stars";
import { NextAvailable } from "@/components/shop/next-available";
import { barberBookingHref } from "@/components/shop/lib/booking";
import { barberPath, shopPath } from "@/components/shop/lib/slug";
import { localizedText } from "@/components/shop/lib/media";
import { minPrice } from "@/components/shop/lib/services";
import { formatJOD } from "@/lib/format";
import { loadBarberProfile, type BarberProfileData } from "./barber-data";

function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function BarberSkeleton() {
  return (
    <SkeletonGroup className="min-h-dvh bg-page">
      <div className="h-16 border-b border-line bg-card" />
      <div className="md:mx-auto md:max-w-7xl md:px-6 md:pt-6 lg:px-8">
        <Skeleton className="aspect-[3/1] h-auto min-h-[120px] w-full rounded-none md:rounded-2xl" />
      </div>
      <div className={cn(containerClasses, "space-y-4")}>
        <Skeleton variant="circle" className="-mt-12 size-24 ring-4 ring-page md:-mt-16 md:size-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

export default function BarberProfileClient({
  handle,
  initialData,
  src = null,
}: {
  handle: string;
  initialData: BarberProfileData | null;
  src?: string | null;
}) {
  const { t, dir, isRTL, FF, href, locale, formatDate, formatNumber } = useTranslation();
  const [data, setData] = useState<BarberProfileData | null>(initialData);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "error">(initialData ? "ok" : "loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await loadBarberProfile(createClient(), handle);
      if (result.status === "ok") {
        setData(result.data);
        setStatus("ok");
      } else setStatus(result.status);
    } catch {
      setStatus("error");
    }
  }, [handle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initialData) load();
  }, [initialData, load]);

  if (status === "loading" && !data) return <BarberSkeleton />;
  if (status !== "ok" || !data) {
    const isError = status === "error";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-page p-4" dir={dir} style={{ fontFamily: FF }}>
        <EmptyState
          icon={UserRound}
          size="lg"
          tone={isError ? "error" : "neutral"}
          headingLevel={2}
          title={isError ? t.shopPage.loadErrorTitle : t.barberPage.notFoundTitle}
          description={isError ? t.shopPage.loadErrorDesc : t.barberPage.notFoundDesc}
          action={isError ? { label: t.common.retry, onClick: load } : { label: t.shopPage.backToExplore, href: href("/explore") }}
          className="w-full max-w-lg"
        />
      </main>
    );
  }

  const { barber, shop, services, categories, portfolio, reviews, colleagues, preview } = data;
  const shopName = (isRTL && shop.name_ar) || shop.name;
  const title = localizedText(locale, barber.title_en, barber.title_ar, t.barberPage.defaultTitle);
  const bio = localizedText(locale, barber.bio_en, barber.bio_ar);
  const shopHref = shopPath(shop, locale);
  const bookHref = barberBookingHref({ locale, shopId: shop.id, barberId: barber.id, entry: "profile_card", src });
  const stickyHref = barberBookingHref({ locale, shopId: shop.id, barberId: barber.id, entry: "profile_sticky", src });
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const fromPrice = minPrice(services);
  const languages = barber.languages.map((l) => languageName(l, locale));
  const bookLabel = interpolate(t.barberPage.bookWith, { name: barber.full_name.split(" ")[0] });

  const share = async () => {
    try {
      if (navigator.share) return void (await navigator.share({ title: barber.full_name, url: window.location.href }));
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t.shopPage.linkCopied);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t.shopPage.shareFailed);
    }
  };

  const ratingValue =
    barber.rating_count > 0 && barber.rating_avg != null
      ? formatNumber(barber.rating_avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : null;
  const firstName = barber.full_name.split(" ")[0];
  const fromLabel = fromPrice != null ? t.primitives.fromPrice.replace("{price}", formatJOD(fromPrice, { locale, trimZeros: true })) : null;

  return (
    <div className="min-h-dvh bg-page text-ink" dir={dir} style={{ fontFamily: FF }}>
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className={cn(containerClasses, "flex h-full items-center justify-between gap-3")}>
          <Link href={shopHref} className={buttonClasses({ variant: "ghost", size: "sm", className: "-ms-2 min-w-0 max-w-[70%]" })}>
            <BackIcon aria-hidden="true" className="shrink-0" />
            <span className="truncate">{interpolate(t.barberPage.backToShop, { shop: shopName })}</span>
          </Link>
          <button type="button" onClick={share} aria-label={t.common.share} className={buttonClasses({ variant: "secondary", size: "icon-sm" })}>
            <Share2 aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="pb-28 pt-16 lg:pb-20">
        {preview && (
          <div role="status" className="border-b border-brand-soft-line bg-brand-soft text-brand-pressed dark:text-brand-text">
            <div className={cn(containerClasses, "flex items-center gap-3 py-3 text-sm")}>
              <Eye size={16} aria-hidden="true" className="shrink-0" />
              <p className="flex-1 font-semibold">{t.shopProfile.previewBanner}</p>
            </div>
          </div>
        )}

        {/* ── Banner + overlapping avatar ── */}
        <div className="md:mx-auto md:w-full md:max-w-7xl md:px-6 md:pt-6 lg:px-8">
          {shop.cover_url ? (
            <PhotoFrame
              src={shop.cover_url}
              alt=""
              ratio="3/1"
              seed={shop.id}
              sizes="(min-width: 1280px) 1216px, 100vw"
              priority
              className="min-h-[120px] md:rounded-2xl"
            />
          ) : (
            <div className="relative aspect-[3/1] min-h-[120px] overflow-hidden md:rounded-2xl">
              <BrandedPlaceholder fill="teal" hideInitials />
            </div>
          )}
        </div>

        <div className={containerClasses}>
          <section aria-labelledby="barber-name" className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="-mt-12 shrink-0 md:-mt-16">
              <BarberAvatar barber={barber} size={96} priority className="ring-4 ring-page md:hidden" />
              <BarberAvatar barber={barber} size={128} priority className="hidden ring-4 ring-page md:block" />
            </div>
            <div className="min-w-0 flex-1 md:pt-4">
              <h1 id="barber-name" className="text-h1 break-words text-ink">
                {barber.full_name}
              </h1>
              <p className="mt-1 text-[15px] text-ink-soft">
                {title}
                <span aria-hidden="true" className="mx-1.5 text-ink-disabled">·</span>
                {t.barberPage.worksAt}{" "}
                <Link href={shopHref} className={cn(textLinkClasses, focusRing, "rounded-sm")}>
                  {shopName}
                </Link>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {ratingValue && (
                  <RatingStars
                    rating={barber.rating_avg!}
                    size="sm"
                    value={ratingValue}
                    count={`(${formatNumber(barber.rating_count)})`}
                    label={`${interpolate(t.shopPage.ratingLabel, { rating: ratingValue })} · ${pluralLabel(t.primitives.reviewsCount, barber.rating_count, locale, formatNumber(barber.rating_count))}`}
                  />
                )}
                {barber.years_experience != null && barber.years_experience > 0 && (
                  <Pill tone="neutral" size="md">
                    {interpolate(t.barberPage.yearsExperience, { count: formatNumber(barber.years_experience) })}
                  </Pill>
                )}
              </div>
              <NextAvailable
                shopId={shop.id}
                serviceId={services[0]?.id ?? null}
                barberId={barber.id}
                timeZone={shop.timezone || "Asia/Amman"}
                className="mt-3 text-sm font-semibold text-success-text"
              />
            </div>
            <div className="hidden shrink-0 items-center gap-2 lg:flex lg:pt-5">
              <Link href={bookHref} prefetch={false} className={buttonClasses({ variant: "primary", size: "lg" })}>
                {bookLabel}
              </Link>
            </div>
          </section>

          <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
            <div className="min-w-0 space-y-14">
              {(bio || languages.length > 0) && (
                <section aria-labelledby="barber-about">
                  <h2 id="barber-about" className="text-h2 mb-4 text-ink">
                    {t.barberPage.about}
                  </h2>
                  {bio && <p className="max-w-[65ch] whitespace-pre-line text-[15px] leading-7 text-ink-soft">{bio}</p>}
                  {languages.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{t.barberPage.languages}</span>
                      {languages.map((l) => (
                        <Pill key={l} tone="neutral" size="md">
                          {l}
                        </Pill>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section aria-labelledby="barber-services">
                <h2 id="barber-services" className="text-h2 mb-4 text-ink">
                  {t.barberPage.services}
                </h2>
                {services.length === 0 ? (
                  <EmptyState icon={Scissors} size="sm" title={t.shopPage.noServices} />
                ) : (
                  <ServicesSection services={services} categories={categories} shopId={shop.id} src={src} barberId={barber.id} currency={shop.currency || "JOD"} />
                )}
              </section>

              {portfolio.length > 0 && (
                <section aria-labelledby="barber-work">
                  <h2 id="barber-work" className="text-h2 mb-4 text-ink">
                    {t.barberPage.work}
                  </h2>
                  <PortfolioGrid items={portfolio} services={services} />
                </section>
              )}

              <section aria-labelledby="barber-reviews">
                <h2 id="barber-reviews" className="text-h2 mb-4 text-ink">
                  {t.barberPage.reviews}
                </h2>
                {reviews.length === 0 ? (
                  <EmptyState icon={Star} size="sm" title={interpolate(t.barberPage.noReviews, { name: firstName })} />
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {reviews.map((r) => {
                      const svc = (isRTL && r.service_name_ar) || r.service_name;
                      const name = r.reviewer_name?.trim() || t.shopPage.anonymousReviewer;
                      return (
                        <li key={r.id} className={cardClasses({ className: "flex flex-col gap-3 p-5" })}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{name}</p>
                            <MetaLine items={[formatDate(r.created_at, "medium"), svc]} as="p" className="text-meta" />
                          </div>
                          <RatingStars rating={r.rating} size="sm" label={interpolate(t.shopPage.ratingLabel, { rating: r.rating })} />
                          {r.comment && <p className="line-clamp-4 break-words text-[15px] leading-6 text-ink-soft">{r.comment}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {colleagues.length > 0 && (
                <section aria-labelledby="barber-colleagues">
                  <h2 id="barber-colleagues" className="text-h2 mb-4 text-ink">
                    {interpolate(t.barberPage.otherBarbers, { shop: shopName })}
                  </h2>
                  <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                    {colleagues.map((c) => (
                      <li key={c.id} className="w-24 shrink-0">
                        <Link
                          href={barberPath(c.handle!, locale)}
                          className={cn(focusRing, "group flex flex-col items-center gap-2 rounded-xl p-1 text-center")}
                        >
                          <BarberAvatar barber={c} size={72} className="ring-2 ring-transparent transition-shadow group-hover:ring-line-strong" />
                          <span className="line-clamp-1 text-sm font-semibold text-ink">{c.full_name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ── Desktop booking card ── */}
            <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label={t.shopPage.bookingBar}>
              <div className={cardClasses({ elevation: "raised", className: "space-y-5 rounded-2xl p-6" })}>
                <div className="flex items-center gap-3">
                  <BarberAvatar barber={barber} size={56} />
                  <div className="min-w-0">
                    <p className="text-h3 truncate text-ink">{barber.full_name}</p>
                    <p className="text-meta truncate text-ink-muted">{shopName}</p>
                  </div>
                </div>
                {fromLabel && (
                  <p className="border-y border-line py-4 text-2xl font-bold tabular-nums text-ink">{fromLabel}</p>
                )}
                <Link href={bookHref} prefetch={false} className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true })}>
                  {bookLabel}
                </Link>
                <Link href={shopHref} className={buttonClasses({ variant: "secondary", size: "md", fullWidth: true })}>
                  {shopName}
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Mobile sticky booking bar (carries ?staff=) */}
      <StickyBar
        label={t.primitives.bookingSummaryLabel}
        title={<bdi>{barber.full_name}</bdi>}
        subtitle={fromLabel ? <bdi>{fromLabel}</bdi> : undefined}
        action={
          <Link href={stickyHref} prefetch={false} className={buttonClasses({ variant: "primary", size: "xl", className: "max-w-[220px] flex-1" })}>
            {t.primitives.bookNow}
          </Link>
        }
      />
    </div>
  );
}
