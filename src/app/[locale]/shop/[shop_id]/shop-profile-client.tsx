"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  Share2,
  Star,
  Store,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
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
} from "../shop-utils";
import { loadShopProfile, type ShopProfileData } from "./shop-data";

// ─── Small presentational pieces ───

function Stars({ rating, size = 16, label }: { rating: number; size?: number; label?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          aria-hidden="true"
          strokeWidth={1.75}
          style={{
            color: s <= rounded ? "var(--accent-brass)" : "var(--border-subtle)",
            fill: s <= rounded ? "var(--accent-brass)" : "transparent",
          }}
        />
      ))}
    </span>
  );
}

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
    <div className="flex items-center gap-4 mb-6">
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
      <Skeleton className="h-64 sm:h-80 w-full rounded-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-20" />
          ))}
        </div>
        <Skeleton className="h-6 w-32 mt-8" />
        <Skeleton variant="card" className="h-40" />
      </div>
    </SkeletonGroup>
  );
}

// ─── Page ───

export default function ShopProfileClient({
  shopId,
  initialData,
}: {
  shopId: string;
  /** Server-fetched data (null in mock mode or when the server fetch failed). */
  initialData: ShopProfileData | null;
}) {
  const router = useRouter();
  const { t, dir, isRTL, FF, FFD, href, formatCurrency, formatDate, formatTime, formatDuration, formatNumber } =
    useTranslation();

  const [data, setData] = useState<ShopProfileData | null>(initialData);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "error">(initialData ? "ok" : "loading");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [openState, setOpenState] = useState<boolean | null>(null);
  const [todayDay, setTodayDay] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await loadShopProfile(createClient(), shopId);
      if (result.status === "ok") {
        setData(result.data);
        setStatus("ok");
      } else {
        setStatus(result.status);
      }
    } catch {
      setStatus("error");
    }
  }, [shopId]);

  useEffect(() => {
    // Data fetch on mount; the loader sets state after awaiting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initialData) load();
  }, [initialData, load]);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) setStickyVisible(heroRef.current.getBoundingClientRect().bottom < 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const weeklyHours = useMemo(() => computeWeeklyHours(data?.hours ?? []), [data?.hours]);
  const ratingSummary = useMemo(() => summarizeRatings(data?.ratings ?? []), [data?.ratings]);
  const timeZone = data?.shop.timezone || "Asia/Amman";

  // "Open now" depends on the viewer's clock, so compute it after mount only
  // (avoids a server/client hydration mismatch).
  useEffect(() => {
    if (!data) return;
    const update = () => {
      setOpenState(isOpenAt(weeklyHours, new Date(), timeZone));
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date());
      setTodayDay(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts));
    };
    try {
      update();
    } catch {
      // Invalid shop time zone: hide the open/closed badge instead of guessing.
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

  const { shop, services, reviews, barbers } = data;
  const currency = shop.currency || "JOD";
  const cover = coverForShop(shop.id);
  const avgRating = ratingSummary.average;
  const numReviews = ratingSummary.count;
  const startingPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;
  const bookHref = href(`/book/${shop.id}`);
  const mapHref = mapsUrl(shop.google_maps_url, shop.address);
  const phoneHref = telHref(shop.phone);
  const waHref = whatsappUrl(shop.whatsapp);
  const igHref = instagramUrl(shop.instagram);
  const policyHours = shop.cancellation_policy_hours ?? 0;
  const cancelText =
    policyHours > 0 ? interpolate(t.shopPage.freeCancellationHours, { hours: policyHours }) : t.shopPage.freeCancellation;
  const reviewCountText =
    numReviews === 1 ? t.shopPage.reviewOne : interpolate(t.shopPage.reviewsCount, { count: formatNumber(numReviews) });
  const ratingLabel = interpolate(t.shopPage.ratingLabel, { rating: avgRating.toFixed(1) });
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 6);
  const hasHours = weeklyHours.some((h) => h.open);

  const contactLinks = [
    phoneHref && { key: "phone", href: phoneHref, icon: Phone, label: t.shopPage.call, value: shop.phone ?? "", external: false },
    waHref && { key: "wa", href: waHref, icon: MessageCircle, label: t.shopPage.whatsapp, value: shop.whatsapp ?? "", external: true },
    igHref && { key: "ig", href: igHref, icon: Instagram, label: t.booking.instagram, value: shop.instagram ?? "", external: true },
    mapHref && { key: "map", href: mapHref, icon: MapPin, label: t.shopPage.viewOnMap, value: shop.address ?? "", external: true },
  ].filter(Boolean) as { key: string; href: string; icon: typeof Phone; label: string; value: string; external: boolean }[];

  const openBadge =
    openState === null ? null : (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{
          background: openState ? "var(--accent-mint-muted)" : "var(--bg-secondary)",
          color: openState ? "var(--accent-text)" : "var(--text-secondary)",
        }}
      >
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: openState ? "var(--accent-mint)" : "var(--text-muted)" }}
        />
        {openState ? t.explore.openNow : t.shopPage.closedNow}
      </span>
    );

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: FF }} dir={dir}>
      {/* ── Sticky booking bar (appears once the hero scrolls away) ── */}
      <div className={`sticky-booking-bar ${stickyVisible ? "visible" : ""}`} aria-hidden={!stickyVisible}>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-[var(--text-primary)] text-base truncate" style={{ fontFamily: FFD }}>
              {shop.name}
            </p>
            {numReviews > 0 && (
              <div className="flex items-center gap-1">
                <Stars rating={avgRating} size={12} />
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  {avgRating.toFixed(1)} ({formatNumber(numReviews)})
                </span>
              </div>
            )}
          </div>
          <Link href={bookHref} className="btn btn-primary shrink-0" tabIndex={stickyVisible ? 0 : -1} style={{ minHeight: 40, fontSize: 14 }}>
            {t.explore.bookNow}
          </Link>
        </div>
      </div>

      {/* ── Top bar ── */}
      <header className="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label={t.common.back}
            className="pointer-events-auto flex items-center gap-1.5 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors h-10 px-3.5 rounded-[8px] border border-[var(--border-subtle)] text-sm font-semibold"
          >
            <BackIcon size={18} aria-hidden="true" />
            <span className="hidden sm:inline">{t.common.back}</span>
          </button>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              aria-label={t.common.share}
              className="w-10 h-10 rounded-[8px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-brass)] transition-colors"
            >
              <Share2 size={18} aria-hidden="true" />
            </button>
            <Link
              href={bookHref}
              className="hidden sm:inline-flex items-center bg-[var(--bg-primary)] text-[var(--text-primary)] h-10 px-4 rounded-[8px] border border-[var(--border-subtle)] text-sm font-bold hover:border-[var(--accent-brass)] transition-colors"
            >
              {t.explore.bookNow}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Breadcrumb ── */}
      <nav aria-label={t.shopPage.breadcrumb} className="pt-16 bg-[var(--bg-primary)]">
        <ol className="max-w-6xl mx-auto px-4 sm:px-8 py-3 border-b border-[var(--border-subtle)] flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] overflow-x-auto no-scrollbar whitespace-nowrap">
          <li className="shrink-0">
            <Link href={href("/")} className="hover:text-[var(--text-primary)] transition-colors">
              {t.shopPage.home}
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--text-muted)] shrink-0">/</li>
          <li className="shrink-0">
            <Link href={href("/explore")} className="hover:text-[var(--text-primary)] transition-colors">
              {t.shopPage.barbers}
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--text-muted)] shrink-0">/</li>
          <li className="text-[var(--text-primary)] font-bold shrink-0 truncate max-w-[60vw]" aria-current="page">
            {shop.name}
          </li>
        </ol>
      </nav>

      {/* ── Hero: per-shop initials cover (no stock photos posing as the shop) ── */}
      <div ref={heroRef} className="relative overflow-hidden" style={{ background: cover.bg }}>
        <Scissors
          aria-hidden="true"
          className="absolute -bottom-10 end-[-2rem] opacity-[0.08] pointer-events-none"
          style={{ color: cover.fg, width: 280, height: 280 }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-12 sm:pt-14 sm:pb-16 flex items-end gap-5">
          <div
            aria-hidden="true"
            className="hidden sm:flex shrink-0 w-24 h-24 rounded-[12px] items-center justify-center text-3xl font-black"
            style={{ background: "rgba(255,255,255,0.1)", color: cover.fg, fontFamily: FFD }}
          >
            {shopInitials(shop.name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 break-words" style={{ color: cover.fg, fontFamily: FFD }}>
              {shop.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: cover.fg }}>
              {numReviews > 0 && (
                <span className="flex items-center gap-1.5">
                  <Stars rating={avgRating} size={14} label={ratingLabel} />
                  <span className="font-bold">{avgRating.toFixed(1)}</span>
                  <span className="opacity-75">({reviewCountText})</span>
                </span>
              )}
              {shop.address && (
                <span className="flex items-center gap-1.5 opacity-85 font-medium min-w-0">
                  <MapPin size={15} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{shop.address}</span>
                </span>
              )}
              {openBadge}
            </div>
          </div>
        </div>
      </div>

      <main className="pb-28 lg:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">
          <div className="min-w-0">
            {/* ── About ── */}
            {shop.description && (
              <section aria-labelledby="about-heading" className="mb-12">
                <SectionHeading id="about-heading">{t.shopPage.about}</SectionHeading>
                <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{shop.description}</p>
              </section>
            )}

            {/* ── Services ── */}
            <section aria-labelledby="services-heading" className="mb-12">
              <SectionHeading
                id="services-heading"
                aside={services.length > 0 ? interpolate(t.shopPage.servicesAvailable, { count: formatNumber(services.length) }) : undefined}
              >
                {t.booking.services}
              </SectionHeading>
              {services.length === 0 ? (
                <EmptyState icon={Scissors} size="sm" title={t.shopPage.noServices} />
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((service) => {
                    const name = isRTL && service.name_ar ? service.name_ar : service.name;
                    return (
                      <li
                        key={service.id}
                        className="flex items-center justify-between gap-3 p-4 bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] hover:border-[var(--accent-brass)] transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-[10px] bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                            <Scissors size={18} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-[var(--text-primary)] text-sm break-words">{name}</h3>
                            <p className="flex items-center gap-1 mt-0.5 text-xs text-[var(--text-secondary)] font-medium">
                              <Clock size={12} aria-hidden="true" />
                              {formatDuration(service.duration)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="font-black text-[var(--text-primary)] text-sm whitespace-nowrap">
                            {formatCurrency(service.price, currency)}
                          </span>
                          <Link
                            href={`${bookHref}?service=${encodeURIComponent(service.id)}`}
                            aria-label={interpolate(t.shopPage.bookServiceLabel, { service: name })}
                            className="text-xs font-bold text-[var(--accent-text)] underline underline-offset-2 hover:no-underline rounded-sm"
                          >
                            {t.shopPage.bookService}
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Team ── */}
            {barbers.length > 0 && (
              <section aria-labelledby="team-heading" className="mb-12">
                <SectionHeading id="team-heading" aside={formatNumber(barbers.length)}>
                  {t.shopPage.team}
                </SectionHeading>
                <ul className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                  {barbers.map((barber) => (
                    <li key={barber.id} className="flex flex-col items-center gap-2 shrink-0 w-[88px]">
                      <div className="relative w-16 h-16 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        {barber.avatar_url ? (
                          <Image
                            src={barber.avatar_url}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                            // Only Supabase Storage is allow-listed in next.config images;
                            // other hosts (OAuth avatars, mock data) load as-is.
                            unoptimized={!barber.avatar_url.includes("/storage/v1/object/public/")}
                          />
                        ) : (
                          <div aria-hidden="true" className="w-full h-full flex items-center justify-center text-xl font-black text-[var(--text-secondary)]">
                            {shopInitials(barber.full_name).charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] line-clamp-1 text-center">
                        {barber.full_name.split(" ")[0]}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Opening hours + contact (mobile/tablet; desktop shows them in the sidebar) ── */}
            <div className="lg:hidden mb-12 space-y-8">
              <HoursCard
                hours={weeklyHours}
                hasHours={hasHours}
                todayDay={todayDay}
                openBadge={openBadge}
                labels={{ title: t.shopPage.hours, closed: t.shopPage.closed, unavailable: t.shopPage.hoursUnavailable, today: t.common.today }}
                dayName={(d) => formatDate(referenceDateForWeekday(d), { weekday: "long" })}
                fmtTime={(v) => formatTime(v)}
                headingId="hours-heading-mobile"
              />
              {contactLinks.length > 0 && (
                <section aria-labelledby="contact-heading-mobile">
                  <SectionHeading id="contact-heading-mobile">{t.shopPage.contact}</SectionHeading>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contactLinks.map(({ key, href: linkHref, icon: Icon, label, value, external }) => (
                      <li key={key}>
                        <a
                          href={linkHref}
                          target={external ? "_blank" : undefined}
                          rel={external ? "noopener noreferrer" : undefined}
                          className="flex items-center gap-3 p-4 bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] hover:border-[var(--accent-brass)] transition-colors"
                        >
                          <span className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-[var(--text-secondary)]">{label}</span>
                            <span className="block font-bold text-sm text-[var(--text-primary)] truncate" dir={key === "phone" || key === "wa" ? "ltr" : undefined}>
                              {value}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ── Reviews ── */}
            <section aria-labelledby="reviews-heading" className="mb-12">
              <SectionHeading id="reviews-heading">{t.shopPage.reviews}</SectionHeading>
              {numReviews === 0 ? (
                <EmptyState icon={Star} size="sm" title={t.shopPage.noReviews} description={t.shopPage.noReviewsDesc} />
              ) : (
                <>
                  <div className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-5 sm:p-6 mb-6">
                    <div className="flex gap-6 sm:gap-8 items-center">
                      <div className="text-center shrink-0">
                        <div className="text-5xl font-black text-[var(--text-primary)] leading-none tabular-nums" style={{ fontFamily: FFD }}>
                          {avgRating.toFixed(1)}
                        </div>
                        <div className="mt-2">
                          <Stars rating={avgRating} size={16} label={ratingLabel} />
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
                                <Stars rating={review.rating} size={12} label={interpolate(t.shopPage.ratingLabel, { rating: review.rating })} />
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

            {/* ── Closing CTA ── */}
            <section className="rounded-[12px] p-8 md:p-12 text-center mb-8 bg-[var(--text-primary)]">
              <h2 className="text-2xl sm:text-3xl font-black text-[var(--bg-primary)] mb-3" style={{ fontFamily: FFD }}>
                {t.shopPage.ctaTitle}
              </h2>
              <p className="mb-8 max-w-md mx-auto text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
                {interpolate(t.shopPage.ctaDesc, { name: shop.name })}
              </p>
              <Link href={bookHref} className="btn inline-flex bg-[var(--bg-primary)] text-[var(--text-primary)] font-bold px-10" style={{ minHeight: 52 }}>
                {t.explore.bookNow}
                <ArrowRight size={18} aria-hidden="true" className="rtl:-scale-x-100" />
              </Link>
            </section>
          </div>

          {/* ── Desktop sidebar: book + trust info ── */}
          <aside className="hidden lg:block lg:sticky space-y-6" style={{ top: 96 }}>
            <div className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] p-6 shadow-[0_8px_30px_-14px_rgba(28,22,17,0.18)]">
              <h2 className="text-xl font-black text-[var(--text-primary)] mb-1" style={{ fontFamily: FFD }}>
                {shop.name}
              </h2>
              {numReviews > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Stars rating={avgRating} size={14} label={ratingLabel} />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-[var(--text-secondary)]">({reviewCountText})</span>
                </div>
              )}
              {shop.address && (
                <p className="flex items-start gap-1.5 text-sm text-[var(--text-secondary)] font-medium mb-4">
                  <MapPin size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
                  {shop.address}
                </p>
              )}

              {startingPrice !== null && (
                <div className="flex items-baseline gap-1.5 py-4 border-y border-[var(--border-subtle)] mb-4">
                  <span className="text-xs text-[var(--text-secondary)] font-semibold">{t.shopPage.fromPrice}</span>
                  <span className="text-2xl font-black text-[var(--text-primary)]">{formatCurrency(startingPrice, currency)}</span>
                </div>
              )}

              <Link href={bookHref} className="btn btn-primary w-full mb-3" style={{ minHeight: 52 }}>
                <CalendarCheck size={18} aria-hidden="true" />
                {t.explore.bookNow}
              </Link>
              <p className="text-center text-xs text-[var(--text-secondary)] mb-1">
                {t.shopPage.noPaymentToday} · {cancelText}
              </p>
              <p className="text-center text-xs mb-5">
                <Link href={href("/policy")} className="text-[var(--accent-text)] underline underline-offset-2 hover:no-underline">
                  {t.shopPage.policyLink}
                </Link>
              </p>

              {contactLinks.length > 0 && (
                <ul className="flex flex-col gap-1 pt-4 border-t border-[var(--border-subtle)]">
                  {contactLinks.map(({ key, href: linkHref, icon: Icon, label, value, external }) => (
                    <li key={key}>
                      <a
                        href={linkHref}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className="flex items-center gap-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-sm"
                      >
                        <Icon size={17} aria-hidden="true" className="shrink-0" />
                        <span className="truncate" dir={key === "phone" || key === "wa" ? "ltr" : undefined}>
                          {key === "map" ? label : value || label}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <HoursCard
              hours={weeklyHours}
              hasHours={hasHours}
              todayDay={todayDay}
              openBadge={openBadge}
              labels={{ title: t.shopPage.hours, closed: t.shopPage.closed, unavailable: t.shopPage.hoursUnavailable, today: t.common.today }}
              dayName={(d) => formatDate(referenceDateForWeekday(d), { weekday: "long" })}
              fmtTime={(v) => formatTime(v)}
              headingId="hours-heading-desktop"
              boxed
            />
          </aside>
        </div>
      </main>

      {/* ── Mobile bottom bar ── */}
      <nav
        aria-label={t.shopPage.bookingBar}
        className="fixed bottom-0 inset-x-0 z-50 flex items-center gap-3 px-4 pt-3 lg:hidden bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 flex-1">
          {startingPrice !== null ? (
            <p className="text-sm font-black text-[var(--text-primary)] truncate">
              <span className="text-xs font-semibold text-[var(--text-secondary)] me-1">{t.shopPage.fromPrice}</span>
              {formatCurrency(startingPrice, currency)}
            </p>
          ) : null}
          <p className="text-[11px] text-[var(--text-secondary)] truncate">{cancelText}</p>
        </div>
        <Link href={href("/customer")} aria-label={t.explore.navAccount} className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-secondary)] shrink-0">
          <UserRound size={20} aria-hidden="true" />
        </Link>
        <Link href={bookHref} className="btn btn-primary shrink-0" style={{ minHeight: 44 }}>
          <CalendarCheck size={16} aria-hidden="true" />
          {t.explore.bookNow}
        </Link>
      </nav>
    </div>
  );
}

function HoursCard({
  hours,
  hasHours,
  todayDay,
  openBadge,
  labels,
  dayName,
  fmtTime,
  headingId,
  boxed = false,
}: {
  hours: { day: number; open: string | null; close: string | null }[];
  hasHours: boolean;
  todayDay: number | null;
  openBadge: React.ReactNode;
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
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id={headingId} className={boxed ? "text-base font-black text-[var(--text-primary)]" : "text-xl font-black text-[var(--text-primary)]"}>
          {labels.title}
        </h2>
        {openBadge}
      </div>
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
