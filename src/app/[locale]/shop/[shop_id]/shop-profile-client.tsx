"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Eye,
  Instagram,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Scissors,
  Share2,
  ShieldCheck,
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
import { placeholderFill, placeholderInitials } from "@/components/ui/photo-frame";
import {
  buttonClasses,
  cardClasses,
  containerClasses,
  focusRing,
  onPhotoIconButtonClasses,
  textLinkClasses,
} from "@/components/ui/recipes";
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
import { cn } from "@/lib/utils";
import {
  computeWeeklyHours,
  coverForShop,
  instagramUrl,
  isOpenAt,
  mapsUrl,
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
    <div className="flex items-center gap-3 text-sm">
      <span className="inline-flex w-7 shrink-0 items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-ink-soft">
        {star}
        <Star aria-hidden="true" className="size-3 fill-accent text-accent" />
      </span>
      <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-enter motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-end text-xs tabular-nums text-ink-muted">{count}</span>
    </div>
  );
}

function SectionHeading({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 id={id} className="text-h2 text-ink">
        {children}
      </h2>
      {aside && <span className="shrink-0 pb-1 text-sm font-medium text-ink-muted">{aside}</span>}
    </div>
  );
}

function ShopPageSkeleton() {
  return (
    <SkeletonGroup className="min-h-dvh bg-page">
      <div className="hidden h-16 border-b border-line bg-card md:block" />
      <div className={cn(containerClasses, "px-0 sm:px-0 md:px-6 md:pt-6 lg:px-8")}>
        <Skeleton className="aspect-[4/3] h-auto w-full rounded-none md:aspect-auto md:h-[440px] md:rounded-2xl" />
      </div>
      <div className={cn(containerClasses, "space-y-3 py-6")}>
        <Skeleton className="h-9 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
        <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton variant="card" className="hidden h-72 lg:block" />
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
  const { t, dir, isRTL, FF, href, locale, formatCurrency, formatDate, formatTime, formatNumber } = useTranslation();

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
      <main className="flex min-h-dvh items-center justify-center bg-page p-4" dir={dir} style={{ fontFamily: FF }}>
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
  const directionsHref = mapsUrl(shop.google_maps_url, [shop.address, placeLine].filter(Boolean).join(", "));
  const policyHours = shop.cancellation_policy_hours ?? 0;
  const cancelText =
    policyHours > 0 ? interpolate(t.shopPage.freeCancellationHours, { hours: policyHours }) : t.shopPage.freeCancellation;
  // CLDR plurals (Arabic dual "تقييمان") with localised digits.
  const reviewCountText = pluralLabel(t.primitives.reviewsCount, numReviews, locale, formatNumber(numReviews));
  const ratingValue = formatNumber(avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratingLabel = interpolate(t.shopPage.ratingLabel, { rating: ratingValue });
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
  ].filter(Boolean) as ContactLink[];

  const headerMeta = [
    numReviews > 0
      ? {
          key: "rating",
          icon: <Star aria-hidden="true" className="size-3.5 fill-accent text-accent" />,
          label: `${ratingValue} (${formatNumber(numReviews)})`,
          title: ratingLabel,
          className: "font-semibold text-ink",
        }
      : null,
    openLabel
      ? { key: "open", label: openLabel, className: openState ? "font-semibold text-success-text" : "font-medium text-ink-soft" }
      : null,
    placeLine || shop.address || null,
  ];

  // Section order (§6.3): Services · Team · Reviews · Work · About.
  const tabs = [
    services.length > 0 && { id: "services", label: t.shopProfile.tabServices },
    barbers.length > 0 && { id: "team", label: t.shopProfile.tabTeam },
    { id: "reviews", label: t.shopProfile.tabReviews },
    portfolio.length > 0 && { id: "portfolio", label: t.shopProfile.tabPortfolio },
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

  const photoButtons = (
    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:hidden">
      <button type="button" onClick={goBack} aria-label={t.common.back} className={onPhotoIconButtonClasses}>
        <BackIcon aria-hidden="true" />
      </button>
      <button type="button" onClick={handleShare} aria-label={t.common.share} className={onPhotoIconButtonClasses}>
        <Share2 aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-page text-ink" style={{ fontFamily: FF }} dir={dir}>
      {/* ── Top bar (desktop; on phones the photo carries back/share) ── */}
      <header className="fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75 md:block">
        <div className={cn(containerClasses, "flex h-full items-center justify-between gap-3")}>
          <button
            type="button"
            onClick={goBack}
            aria-label={t.common.back}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "-ms-2" })}
          >
            <BackIcon aria-hidden="true" className="size-4" />
            <span>{t.common.back}</span>
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-ink" aria-hidden="true">
            {shopName}
          </p>
          <button
            type="button"
            onClick={handleShare}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <Share2 aria-hidden="true" />
            <span>{t.common.share}</span>
          </button>
        </div>
      </header>

      <div className="md:pt-16">
        {preview && (
          <div role="status" className="border-b border-brand-soft-line bg-brand-soft text-brand-pressed dark:text-brand-text">
            <div className={cn(containerClasses, "flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm")}>
              <Eye size={16} aria-hidden="true" className="shrink-0" />
              <p className="min-w-0 flex-1 font-semibold">{t.shopProfile.previewBanner}</p>
              <Link href={href("/settings/profile")} className={cn(focusRing, "rounded-sm font-semibold underline underline-offset-4")}>
                {t.shopProfile.previewManage}
              </Link>
            </div>
          </div>
        )}

        {/* ── Breadcrumb (desktop) ── */}
        <nav aria-label={t.shopPage.breadcrumb} className="hidden md:block">
          <ol className={cn(containerClasses, "no-scrollbar text-meta flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-4 text-ink-muted")}>
            <li className="shrink-0">
              <Link href={href("/")} className="focus-ring rounded-sm transition-colors hover:text-ink">
                {t.shopPage.home}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </li>
            <li className="shrink-0">
              <Link href={href("/explore")} className="focus-ring rounded-sm transition-colors hover:text-ink">
                {t.shopPage.barbers}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </li>
            <li className="max-w-[60vw] shrink-0 truncate font-medium text-ink" aria-current="page">
              {shopName}
            </li>
          </ol>
        </nav>

        {/* ── Photos (or the branded cover when there are none) ── */}
        <div className="md:mx-auto md:w-full md:max-w-7xl md:px-6 lg:px-8">
          {photos.length > 0 ? (
            <PhotoGallery photos={photos} shopName={shopName} mobileOverlay={photoButtons} />
          ) : (
            <div
              className="relative isolate grid aspect-[16/10] place-items-center overflow-hidden md:aspect-auto md:h-[320px] md:rounded-2xl"
              style={{ background: cover.bg }}
            >
              <span aria-hidden="true" className="text-[56px] leading-none font-extrabold md:text-[72px]" style={{ color: cover.fg }}>
                {shopInitials(shopName)}
              </span>
              <Scissors
                aria-hidden="true"
                className="absolute -bottom-8 -end-6 size-48 opacity-[0.08] md:size-64"
                style={{ color: cover.fg }}
              />
              {photoButtons}
            </div>
          )}
        </div>

        {/* ── Header block ── */}
        <div className={cn(containerClasses, "pb-6 pt-5 md:pt-8")}>
          <div className="max-w-3xl">
            {shop.is_verified && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Pill tone="brand" size="md" icon={<BadgeCheck aria-hidden="true" />}>
                  {t.shopProfile.verified}
                </Pill>
              </div>
            )}
            <h1 className="text-h1 break-words text-ink">{shopName}</h1>
            <MetaLine items={headerMeta} className="mt-2 text-[15px]" />

            {/* Quick actions (mobile/tablet; desktop has them in the booking card) */}
            {(directionsHref || contactLinks.length > 0) && (
              <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
                {directionsHref && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Navigation aria-hidden="true" className="rtl:-scale-x-100" />
                    {t.shopPage.viewOnMap}
                  </a>
                )}
                {contactLinks.map(({ key, href: linkHref, icon: Icon, label, external }) => (
                  <a
                    key={key}
                    href={linkHref}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollSpyTabs tabs={tabs} label={t.shopProfile.tabsLabel} top={64} stickyClassName="top-0 md:top-16" />

      <main className="pb-28 lg:pb-20">
        <div className={cn(containerClasses, "pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12")}>
          <div className="min-w-0 space-y-14">
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

            {/* ── Reviews ── */}
            <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-32">
              <SectionHeading id="reviews-heading">{t.shopPage.reviews}</SectionHeading>
              {numReviews === 0 ? (
                <EmptyState icon={Star} size="sm" title={t.shopPage.noReviews} description={t.shopPage.noReviewsDesc} />
              ) : (
                <>
                  <div className={cardClasses({ className: "mb-6 grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10 sm:p-6" })}>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-2">
                      <p className="text-[48px] leading-none font-bold tabular-nums text-ink">{ratingValue}</p>
                      <div className="flex flex-col gap-1">
                        <RatingStars rating={avgRating} size="md" label={ratingLabel} />
                        <p className="text-sm text-ink-muted">{reviewCountText}</p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                      {ratingSummary.distribution.map(({ star, count }) => (
                        <RatingBar key={star} star={star} count={count} total={numReviews} />
                      ))}
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {visibleReviews.map((review) => {
                      const name = review.reviewer_name?.trim() || t.shopPage.anonymousReviewer;
                      const fill = placeholderFill(name);
                      return (
                        <li key={review.id} className={cardClasses({ className: "flex flex-col gap-3 p-5" })}>
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
                              style={{ background: fill.bg, color: fill.fg }}
                            >
                              {placeholderInitials(name).slice(0, 1)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">{name}</p>
                              <time dateTime={review.created_at} className="text-meta text-ink-muted">
                                {formatDate(review.created_at, "medium")}
                              </time>
                            </div>
                          </div>
                          <RatingStars rating={review.rating} size="sm" label={interpolate(t.shopPage.ratingLabel, { rating: review.rating })} />
                          {review.comment && (
                            <p className="line-clamp-4 break-words text-[15px] leading-6 text-ink-soft">{review.comment}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {!showAllReviews && reviews.length > 6 && (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
                        onClick={() => setShowAllReviews(true)}
                      >
                        {t.shopPage.showMoreReviews}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Portfolio ── */}
            {portfolio.length > 0 && (
              <section id="portfolio" aria-labelledby="portfolio-heading" className="scroll-mt-32">
                <SectionHeading id="portfolio-heading">{t.shopProfile.portfolio}</SectionHeading>
                <PortfolioGrid items={portfolio} barbers={barbers} services={services} />
              </section>
            )}

            {/* ── About: description, amenities, hours (mobile), location, contact ── */}
            <section id="about" aria-labelledby="about-heading" className="scroll-mt-32 space-y-10">
              <div>
                <SectionHeading id="about-heading">{t.shopPage.about}</SectionHeading>
                {description ? (
                  <p className="max-w-[65ch] whitespace-pre-line text-[15px] leading-7 text-ink-soft">{description}</p>
                ) : null}
              </div>

              {amenities.length > 0 && (
                <div>
                  <h3 className="text-h3 mb-4 text-ink">{t.shopProfile.amenities}</h3>
                  <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {amenities.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 text-[15px] text-ink">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
                          <AmenityIcon name={a.icon} size={18} />
                        </span>
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
                  <h3 className="text-h3 mb-4 text-ink">{t.shopPage.contact}</h3>
                  <ContactList links={contactLinks} />
                </div>
              )}
            </section>
          </div>

          {/* ── Desktop booking card ── */}
          <aside className="hidden space-y-5 lg:sticky lg:top-[136px] lg:block" aria-label={t.shopPage.bookingBar}>
            <div className={cardClasses({ elevation: "raised", className: "space-y-5 rounded-2xl p-6" })}>
              <div className="space-y-1.5">
                <p className="text-h3 text-ink">{shopName}</p>
                {numReviews > 0 && (
                  <RatingStars
                    rating={avgRating}
                    size="sm"
                    value={ratingValue}
                    count={`(${reviewCountText})`}
                    label={`${ratingLabel} · ${reviewCountText}`}
                  />
                )}
                {openLabel && (
                  <p className={cn("flex items-center gap-1.5 text-sm", openState ? "font-semibold text-success-text" : "font-medium text-ink-soft")}>
                    <Clock3 aria-hidden="true" className="size-4" />
                    {openLabel}
                  </p>
                )}
                {(placeLine || shop.address) && (
                  <p className="text-meta flex items-start gap-1.5 text-ink-muted">
                    <MapPin aria-hidden="true" className="mt-px size-4 shrink-0" />
                    <span className="min-w-0">{placeLine || shop.address}</span>
                  </p>
                )}
              </div>
              {startingPrice !== null && (
                <p className="border-y border-line py-4 text-ink">
                  <span className="text-2xl font-bold tabular-nums">
                    {t.primitives.fromPrice.replace("{price}", priceText(startingPrice))}
                  </span>
                </p>
              )}
              <BookingCta shop={shop.id} entry="profile_card" src={src} fullWidth />
              <div className="space-y-1.5 text-center">
                <p className="text-meta flex items-center justify-center gap-1.5 text-ink-muted">
                  <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
                  <span>
                    {t.shopPage.noPaymentToday} · {cancelText}
                  </span>
                </p>
                <p className="text-meta">
                  <Link href={href("/policy")} className={cn(textLinkClasses, focusRing, "rounded-sm")}>
                    {t.shopPage.policyLink}
                  </Link>
                </p>
              </div>
              {(contactLinks.length > 0 || directionsHref) && (
                <div className="border-t border-line pt-4">
                  <ContactList
                    links={
                      directionsHref
                        ? [
                            ...contactLinks,
                            { key: "map", href: directionsHref, icon: Navigation, label: t.shopPage.viewOnMap, value: t.shopPage.viewOnMap, external: true },
                          ]
                        : contactLinks
                    }
                    compact
                  />
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

interface ContactLink {
  key: string;
  href: string;
  icon: typeof Phone;
  label: string;
  value: string;
  external: boolean;
}

function ContactList({ links, compact = false }: { links: ContactLink[]; compact?: boolean }) {
  return (
    <ul className={compact ? "flex flex-col" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {links.map(({ key, href: linkHref, icon: Icon, label, value, external }) => (
        <li key={key}>
          <a
            href={linkHref}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={
              compact
                ? cn(focusRing, "-mx-2 flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-sunken hover:text-ink")
                : cardClasses({ interactive: true, className: cn(focusRing, "flex items-center gap-3 p-4 hover:border-line-strong") })
            }
          >
            {compact ? (
              <Icon size={18} aria-hidden="true" className={cn("shrink-0 text-ink-muted", key === "map" && "rtl:-scale-x-100")} />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-text">
                <Icon size={18} aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              {!compact && <span className="text-meta block text-ink-muted">{label}</span>}
              <span
                className={compact ? "block truncate" : "block truncate text-[15px] font-semibold text-ink"}
                dir={key === "phone" || key === "wa" ? "ltr" : undefined}
              >
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
    <section aria-labelledby={headingId} className={boxed ? cardClasses({ className: "rounded-2xl p-6" }) : undefined}>
      <h2 id={headingId} className={cn(boxed ? "text-h3" : "text-h2", "mb-4 text-ink")}>
        {labels.title}
      </h2>
      {!hasHours ? (
        <p className="text-sm text-ink-muted">{labels.unavailable}</p>
      ) : (
        <dl className="divide-y divide-line text-[15px]">
          {hours.map((h) => {
            const isToday = h.day === todayDay;
            return (
              <div
                key={h.day}
                className={cn("flex items-center justify-between gap-4 py-2.5", isToday ? "font-semibold text-ink" : "text-ink-soft")}
              >
                <dt className="flex items-center gap-2">
                  {isToday && <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />}
                  {dayName(h.day)}
                  {isToday && <span className="sr-only">({labels.today})</span>}
                </dt>
                <dd className={cn("tabular-nums", !(h.open && h.close) && "text-ink-muted")}>
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
