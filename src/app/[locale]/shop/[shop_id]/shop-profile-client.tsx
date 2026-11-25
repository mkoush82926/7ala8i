"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Eye,
  Instagram,
  MessageCircle,
  Phone,
  Scissors,
  Share2,
  Star,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { MetaLine } from "@/components/ui/meta-line";
import { Pill } from "@/components/ui/pill";
import { BookingCta, pluralLabel } from "@/components/ui/booking-cta";
import { PhotoGallery } from "@/components/shop/photo-gallery";
import { ScrollSpyTabs } from "@/components/shop/scroll-spy-tabs";
import { ServicesSection } from "@/components/shop/services-section";
import { ClosureBanner } from "@/components/team/shifts";
import { TeamGrid } from "@/components/shop/team-grid";
import { PortfolioGrid } from "@/components/shop/portfolio-grid";
import { LocationCard } from "@/components/shop/static-map";
import { AmenityIcon } from "@/components/shop/amenity-icon";
import { RatingStars } from "@/components/shop/rating-stars";
import { minPrice } from "@/components/shop/lib/services";
import { localizedText } from "@/components/shop/lib/media";
import { formatJOD } from "@/lib/format";
import {
  computeWeeklyHours,
  coverForShop,
  instagramUrl,
  isOpenAt,
  referenceDateForWeekday,
  shopInitials,
  summarizeRatings,
  telHref,
  whatsappUrl,
  zonedDayAndTime,
} from "../shop-utils";
import { loadShopProfile, type ShopProfileData } from "./shop-data";

// ─── Small presentational pieces ───

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs font-semibold text-[var(--text-secondary)] w-3 text-end tabular-nums">{star}</span>
      <Star size={12} aria-hidden="true" style={{ color: "var(--accent-brass)", fill: "var(--accent-brass)" }} />
      <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent-brass)] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-6 text-end tabular-nums">{count}</span>
    </div>
  );
}

function SectionHeading({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 id={id} className="text-xl font-black text-[var(--text-primary)] shrink-0">
        {children}
      </h2>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" aria-hidden="true" />
      {aside && <span className="text-xs font-bold text-[var(--text-secondary)] shrink-0">{aside}</span>}
    </div>
  );
}

function ShopPageSkeleton() {
  return (
    <SkeletonGroup className="min-h-dvh bg-[var(--bg-primary)]">
      <div className="h-16" />
      <div className="max-w-6xl mx-auto sm:px-8">
        <Skeleton className="aspect-video md:aspect-[32/11] w-full rounded-none sm:rounded-[12px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-16" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

// ─── Page ───

export default function ShopProfileClient({
  shopKey,
  initialData,
  src = null,
}: {
  /** Route segment: slug, Arabic slug or id. */
  shopKey: string;
  /** Server-fetched data (null in mock mode or when the server fetch failed). */
  initialData: ShopProfileData | null;
  /** Attribution token from the landing URL (?src=). */
  src?: string | null;
}) {
  const router = useRouter();
  const { t, dir, isRTL, FF, FFD, href, locale, formatCurrency, formatDate, formatTime, formatNumber } = useTranslation();

  const [data, setData] = useState<ShopProfileData | null>(initialData);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "error">(initialData ? "ok" : "loading");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [openState, setOpenState] = useState<boolean | null>(null);
  const [todayDay, setTodayDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await loadShopProfile(createClient(), shopKey);
      if (result.status === "ok") {
        setData(result.data);
        setStatus("ok");
      } else {
        setStatus(result.status);
      }
    } catch {
      setStatus("error");
    }
  }, [shopKey]);

  useEffect(() => {
    // Data fetch on mount; the loader sets state after awaiting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initialData) load();
  }, [initialData, load]);

  const weeklyHours = useMemo(() => computeWeeklyHours(data?.hours ?? []), [data?.hours]);
  const ratingSummary = useMemo(() => summarizeRatings(data?.ratings ?? []), [data?.ratings]);
  const timeZone = data?.shop.timezone || "Asia/Amman";

  // "Open now" depends on the viewer's clock, so compute it after mount only
  // (avoids a server/client hydration mismatch).
  useEffect(() => {
    if (!data) return;
    const update = () => {
      setOpenState(isOpenAt(weeklyHours, new Date(), timeZone));
      setTodayDay(zonedDayAndTime(new Date(), timeZone).day);
    };
    try {
      update();
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenState(null);
    }
    const id = window.setInterval(() => {
      try {
        update();
      } catch {
        /* ignore */
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [data, weeklyHours, timeZone]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(href("/explore"));
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: data?.shop.name, url });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success(t.shopPage.linkCopied);
        return;
      }
      toast.error(t.shopPage.shareFailed);
    } catch (err) {
      // AbortError = the user closed the native share sheet; nothing to report.
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t.shopPage.shareFailed);
    }
  };

  if (status === "loading" && !data) return <ShopPageSkeleton />;

  if (status === "not_found" || status === "error" || !data) {
    const isError = status === "error";
    return (
      <main className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4" dir={dir} style={{ fontFamily: FF }}>
        <EmptyState
          icon={Store}
          size="lg"
          tone={isError ? "error" : "neutral"}
          headingLevel={2}
          title={isError ? t.shopPage.loadErrorTitle : t.shopPage.notFoundTitle}
          description={isError ? t.shopPage.loadErrorDesc : t.shopPage.notFoundDesc}
          action={isError ? { label: t.common.retry, onClick: load } : { label: t.shopPage.backToExplore, href: href("/explore") }}
          secondaryAction={isError ? { label: t.shopPage.backToExplore, href: href("/explore") } : undefined}
          className="w-full max-w-lg"
        />
      </main>
    );
  }

  const { shop, services, categories, reviews, barbers, photos, portfolio, amenities, preview } = data;
  const shopName = (isRTL && shop.name_ar) || shop.name;
  const description = localizedText(locale, shop.description, shop.description_ar);
  const landmark = localizedText(locale, shop.landmark_en, shop.landmark_ar);
  const placeLine = [data.area, data.city]
    .filter(Boolean)
    .map((p) => (isRTL ? p!.name_ar : p!.name_en))
    .join(isRTL ? "، " : ", ");
  const currency = shop.currency || "JOD";
  const cover = coverForShop(shop.id);
  const avgRating = ratingSummary.average;
  const numReviews = ratingSummary.count;
  const startingPrice = minPrice(services);
  const phoneHref = telHref(shop.phone);
  const waHref = whatsappUrl(shop.whatsapp);
  const igHref = instagramUrl(shop.instagram);
  const policyHours = shop.cancellation_policy_hours ?? 0;
  const cancelText =
    policyHours > 0 ? interpolate(t.shopPage.freeCancellationHours, { hours: policyHours }) : t.shopPage.freeCancellation;
  // CLDR plurals (Arabic dual "تقييمان") with localised digits.
  const reviewCountText = pluralLabel(t.primitives.reviewsCount, numReviews, locale, formatNumber(numReviews));
  const ratingLabel = interpolate(t.shopPage.ratingLabel, {
    rating: formatNumber(avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  });
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 6);
  const hasHours = weeklyHours.some((h) => h.open);
  const today = todayDay === null ? null : weeklyHours.find((h) => h.day === todayDay);
  const priceText = (amount: number) =>
    currency === "JOD" ? formatJOD(amount, { locale, trimZeros: true }) : formatCurrency(amount, currency);

  const openLabel =
    openState === null
      ? null
      : openState && today?.close
        ? interpolate(t.shopProfile.openUntil, { time: formatTime(today.close) })
        : openState
          ? t.explore.openNow
          : t.shopPage.closedNow;

  const contactLinks = [
    phoneHref && { key: "phone", href: phoneHref, icon: Phone, label: t.shopPage.call, value: shop.phone ?? "", external: false },
    waHref && { key: "wa", href: waHref, icon: MessageCircle, label: t.shopPage.whatsapp, value: shop.whatsapp ?? "", external: true },
    igHref && { key: "ig", href: igHref, icon: Instagram, label: t.booking.instagram, value: shop.instagram ?? "", external: true },
  ].filter(Boolean) as { key: string; href: string; icon: typeof Phone; label: string; value: string; external: boolean }[];

  const headerMeta = [
    numReviews > 0
      ? {
          key: "rating",
          icon: <Star size={14} aria-hidden="true" style={{ color: "var(--accent-brass)", fill: "var(--accent-brass)" }} />,
          label: `${formatNumber(avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${formatNumber(numReviews)})`,
          title: ratingLabel,
        }
      : null,
    openLabel ? { key: "open", label: openLabel, className: openState ? "text-[var(--accent-text)] font-bold" : undefined } : null,
    placeLine || shop.address || null,
  ];

  const tabs = [
    services.length > 0 && { id: "services", label: t.shopProfile.tabServices },
    barbers.length > 0 && { id: "team", label: t.shopProfile.tabTeam },
    portfolio.length > 0 && { id: "portfolio", label: t.shopProfile.tabPortfolio },
    { id: "reviews", label: t.shopProfile.tabReviews },
    { id: "about", label: t.shopProfile.tabAbout },
  ].filter(Boolean) as { id: string; label: string }[];

  const hoursCardProps = {
    hours: weeklyHours,
    hasHours,
    todayDay,
    labels: { title: t.shopPage.hours, closed: t.shopPage.closed, unavailable: t.shopPage.hoursUnavailable, today: t.common.today },
    dayName: (d: number) => formatDate(referenceDateForWeekday(d), { weekday: "long" }),
    fmtTime: (v: string) => formatTime(v),
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: FF }} dir={dir}>
      {/* ── Top bar ── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label={t.common.back}
            className="focus-ring flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors h-10 px-3 rounded-[8px] text-sm font-semibold"
          >
            <BackIcon size={18} aria-hidden="true" />
            <span className="hidden sm:inline">{t.common.back}</span>
          </button>
          <p className="min-w-0 flex-1 truncate text-center font-black text-[15px]" style={{ fontFamily: FFD }} aria-hidden="true">
            {shopName}
          </p>
          <button
            type="button"
            onClick={handleShare}
            aria-label={t.common.share}
            className="focus-ring w-10 h-10 rounded-[8px] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-brass)] transition-colors"
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="pt-16">
        {preview && (
          <div role="status" className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Eye size={16} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <p className="flex-1 min-w-0 font-semibold">{t.shopProfile.previewBanner}</p>
              <Link href={href("/settings/profile")} className="focus-ring font-bold text-[var(--accent-text)] underline underline-offset-2">
                {t.shopProfile.previewManage}
              </Link>
            </div>
          </div>
        )}

        {/* ── Breadcrumb ── */}
        <nav aria-label={t.shopPage.breadcrumb}>
          <ol className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] overflow-x-auto no-scrollbar whitespace-nowrap">
            <li className="shrink-0">
              <Link href={href("/")} className="focus-ring hover:text-[var(--text-primary)] transition-colors">
                {t.shopPage.home}
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--text-muted)] shrink-0">/</li>
            <li className="shrink-0">
              <Link href={href("/explore")} className="focus-ring hover:text-[var(--text-primary)] transition-colors">
                {t.shopPage.barbers}
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--text-muted)] shrink-0">/</li>
            <li className="text-[var(--text-primary)] font-bold shrink-0 truncate max-w-[60vw]" aria-current="page">
              {shopName}
            </li>
          </ol>
        </nav>

        {/* ── Photos (or the per-shop initials cover when there are none) ── */}
        <div className="max-w-6xl mx-auto sm:px-8">
          {photos.length > 0 ? (
            <PhotoGallery photos={photos} shopName={shopName} className="sm:rounded-[12px] overflow-hidden" />
          ) : (
            <div
              className="relative overflow-hidden aspect-[16/7] sm:rounded-[12px] flex items-center justify-center"
              style={{ background: cover.bg }}
              aria-hidden="true"
            >
              <Scissors className="absolute -bottom-10 end-[-2rem] opacity-[0.08]" style={{ color: cover.fg, width: 240, height: 240 }} />
              <span className="text-5xl sm:text-6xl font-black" style={{ color: cover.fg, fontFamily: FFD }}>
                {shopInitials(shopName)}
              </span>
            </div>
          )}
        </div>

        {/* ── Header ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {shop.is_verified && (
              <Pill tone="brass" size="sm" icon={<BadgeCheck size={12} aria-hidden="true" />}>
                {t.shopProfile.verified}
              </Pill>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black break-words" style={{ fontFamily: FFD }}>
            {shopName}
          </h1>
          <MetaLine items={headerMeta} className="mt-2 text-sm text-[var(--text-secondary)]" />
        </div>
      </div>

      <ScrollSpyTabs tabs={tabs} label={t.shopProfile.tabsLabel} top={64} />

      <main className="pb-28 lg:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">
          <div className="min-w-0 space-y-12">
            {/* Upcoming closures / special hours (renders nothing when there are none). */}
            <ClosureBanner shopId={shop.id} timezone={timeZone} />
            {/* ── Services ── */}
            <section id="services" aria-labelledby="services-heading" className="scroll-mt-32">
              <SectionHeading
                id="services-heading"
                aside={services.length > 0 ? interpolate(t.shopPage.servicesAvailable, { count: formatNumber(services.length) }) : undefined}
              >
                {t.booking.services}
              </SectionHeading>
              {services.length === 0 ? (
                <EmptyState icon={Scissors} size="sm" title={t.shopPage.noServices} />
              ) : (
                <ServicesSection services={services} categories={categories} shopId={shop.id} src={src} currency={currency} />
              )}
            </section>

            {/* ── Team ── */}
            {barbers.length > 0 && (
              <section id="team" aria-labelledby="team-heading" className="scroll-mt-32">
                <SectionHeading id="team-heading" aside={formatNumber(barbers.length)}>
                  {t.shopPage.team}
                </SectionHeading>
                <TeamGrid barbers={barbers} shopId={shop.id} src={src} />
              </section>
            )}

            {/* ── Portfolio ── */}
            {portfolio.length > 0 && (
              <section id="portfolio" aria-labelledby="portfolio-heading" className="scroll-mt-32">
                <SectionHeading id="portfolio-heading">{t.shopProfile.portfolio}</SectionHeading>
                <PortfolioGrid items={portfolio} barbers={barbers} services={services} />
              </section>
            )}

            {/* ── Reviews ── */}
            <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-32">
              <SectionHeading id="reviews-heading">{t.shopPage.reviews}</SectionHeading>
              {numReviews === 0 ? (
                <EmptyState icon={Star} size="sm" title={t.shopPage.noReviews} description={t.shopPage.noReviewsDesc} />
              ) : (
                <>
                  <div className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-5 sm:p-6 mb-6">
                    <div className="flex gap-6 sm:gap-8 items-center">
                      <div className="text-center shrink-0">
                        <div className="text-5xl font-black text-[var(--text-primary)] leading-none tabular-nums" style={{ fontFamily: FFD }}>
                          {formatNumber(avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </div>
                        <div className="mt-2">
                          <RatingStars rating={avgRating} size={16} label={ratingLabel} />
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">{reviewCountText}</p>
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        {ratingSummary.distribution.map(({ star, count }) => (
                          <RatingBar key={star} star={star} count={count} total={numReviews} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleReviews.map((review) => {
                      const name = review.reviewer_name?.trim() || t.shopPage.anonymousReviewer;
                      return (
                        <li key={review.id} className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              aria-hidden="true"
                              className="w-9 h-9 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center text-sm font-bold shrink-0"
                            >
                              {shopInitials(name).charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-[var(--text-primary)] truncate">{name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <RatingStars rating={review.rating} size={12} label={interpolate(t.shopPage.ratingLabel, { rating: review.rating })} />
                                <time dateTime={review.created_at} className="text-xs text-[var(--text-secondary)]">
                                  {formatDate(review.created_at, "medium")}
                                </time>
                              </div>
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed ps-12 break-words">{review.comment}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {!showAllReviews && reviews.length > 6 && (
                    <div className="mt-5 text-center">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAllReviews(true)}>
                        {t.shopPage.showMoreReviews}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── About: description, amenities, hours (mobile), location, contact ── */}
            <section id="about" aria-labelledby="about-heading" className="scroll-mt-32 space-y-10">
              <div>
                <SectionHeading id="about-heading">{t.shopPage.about}</SectionHeading>
                {description ? (
                  <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{description}</p>
                ) : null}
              </div>

              {amenities.length > 0 && (
                <div>
                  <h3 className="text-base font-black mb-3">{t.shopProfile.amenities}</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {amenities.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
                        <AmenityIcon name={a.icon} className="shrink-0 text-[var(--text-secondary)]" />
                        {isRTL ? a.name_ar : a.name_en}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="lg:hidden">
                <HoursCard {...hoursCardProps} headingId="hours-heading-mobile" />
              </div>

              <LocationCard
                name={shopName}
                lat={shop.lat}
                lng={shop.lng}
                address={shop.address}
                landmark={landmark || null}
                placeLine={placeLine || null}
                googleMapsUrl={shop.google_maps_url}
                headingId="location-heading"
              />

              {contactLinks.length > 0 && (
                <div className="lg:hidden">
                  <h3 className="text-base font-black mb-3">{t.shopPage.contact}</h3>
                  <ContactList links={contactLinks} />
                </div>
              )}
            </section>
          </div>

          {/* ── Desktop sidebar: book + trust info ── */}
          <aside className="hidden lg:block lg:sticky space-y-6" style={{ top: 136 }} aria-label={t.shopPage.bookingBar}>
            <div className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-6 shadow-[0_8px_30px_-14px_rgba(28,22,17,0.18)]">
              <p className="text-xl font-black text-[var(--text-primary)] mb-1" style={{ fontFamily: FFD }}>
                {shopName}
              </p>
              {numReviews > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <RatingStars rating={avgRating} size={14} label={ratingLabel} />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                  <span className="text-xs text-[var(--text-secondary)]">({reviewCountText})</span>
                </div>
              )}
              {startingPrice !== null && (
                <p className="py-4 my-3 border-y border-[var(--border-subtle)] text-2xl font-black">
                  {t.primitives.fromPrice.replace("{price}", priceText(startingPrice))}
                </p>
              )}
              <BookingCta shop={shop.id} entry="profile_card" src={src} fullWidth />
              <p className="mt-3 text-center text-xs text-[var(--text-secondary)]">
                {t.shopPage.noPaymentToday} · {cancelText}
              </p>
              <p className="text-center text-xs mt-1 mb-4">
                <Link href={href("/policy")} className="focus-ring text-[var(--accent-text)] underline underline-offset-2 hover:no-underline">
                  {t.shopPage.policyLink}
                </Link>
              </p>
              {contactLinks.length > 0 && (
                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <ContactList links={contactLinks} compact />
                </div>
              )}
            </div>
            <HoursCard {...hoursCardProps} headingId="hours-heading-desktop" boxed />
          </aside>
        </div>
      </main>

      {/* ── Mobile sticky booking bar ── */}
      <BookingCta
        shop={shop.id}
        entry="profile_sticky"
        src={src}
        variant="bar"
        summary={{ count: services.length, fromPrice: startingPrice }}
      />
    </div>
  );
}

function ContactList({
  links,
  compact = false,
}: {
  links: { key: string; href: string; icon: typeof Phone; label: string; value: string; external: boolean }[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "flex flex-col gap-1" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
      {links.map(({ key, href: linkHref, icon: Icon, label, value, external }) => (
        <li key={key}>
          <a
            href={linkHref}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={
              compact
                ? "focus-ring flex items-center gap-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-sm"
                : "focus-ring flex items-center gap-3 p-4 bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] hover:border-[var(--accent-brass)] transition-colors"
            }
          >
            {compact ? (
              <Icon size={17} aria-hidden="true" className="shrink-0" />
            ) : (
              <span className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                <Icon size={18} aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              {!compact && <span className="block text-xs font-bold text-[var(--text-secondary)]">{label}</span>}
              <span className={compact ? "truncate" : "block font-bold text-sm text-[var(--text-primary)] truncate"} dir={key === "phone" || key === "wa" ? "ltr" : undefined}>
                {value || label}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function HoursCard({
  hours,
  hasHours,
  todayDay,
  labels,
  dayName,
  fmtTime,
  headingId,
  boxed = false,
}: {
  hours: { day: number; open: string | null; close: string | null }[];
  hasHours: boolean;
  todayDay: number | null;
  labels: { title: string; closed: string; unavailable: string; today: string };
  dayName: (day: number) => string;
  fmtTime: (value: string) => string;
  headingId: string;
  boxed?: boolean;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={boxed ? "bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-6" : undefined}
    >
      <h2 id={headingId} className={boxed ? "text-base font-black text-[var(--text-primary)] mb-4" : "text-xl font-black text-[var(--text-primary)] mb-4"}>
        {labels.title}
      </h2>
      {!hasHours ? (
        <p className="text-sm text-[var(--text-secondary)]">{labels.unavailable}</p>
      ) : (
        <dl className="divide-y divide-[var(--border-subtle)] text-sm">
          {hours.map((h) => {
            const isToday = h.day === todayDay;
            return (
              <div key={h.day} className={`flex items-center justify-between gap-4 py-2 ${isToday ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                <dt className="flex items-center gap-2">
                  {dayName(h.day)}
                  {isToday && <span className="sr-only">({labels.today})</span>}
                </dt>
                <dd className="tabular-nums">
                  {h.open && h.close ? (
                    <span>
                      {fmtTime(h.open)} – {fmtTime(h.close)}
                    </span>
                  ) : (
                    labels.closed
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
