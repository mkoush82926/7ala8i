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
import { META_SEPARATOR } from "@/lib/format";
import { cn } from "@/lib/utils";
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
    <SkeletonGroup className="min-h-dvh bg-[var(--bg-primary)]">
      <div className="h-16" />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="w-24 h-24" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-16" />
        ))}
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
  const { t, dir, isRTL, FF, FFD, href, locale, formatDate, formatNumber } = useTranslation();
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
      <main className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4" dir={dir} style={{ fontFamily: FF }}>
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
  const ratingText =
    barber.rating_count > 0 && barber.rating_avg != null
      ? `${formatNumber(barber.rating_avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${formatNumber(barber.rating_count)})`
      : null;
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

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" dir={dir} style={{ fontFamily: FF }}>
      <header className="fixed top-0 inset-x-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href={shopHref} className="focus-ring flex items-center gap-1.5 h-10 px-2 rounded-[8px] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-w-0">
            <BackIcon size={18} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{interpolate(t.barberPage.backToShop, { shop: shopName })}</span>
          </Link>
          <button
            type="button"
            onClick={share}
            aria-label={t.common.share}
            className="focus-ring w-10 h-10 shrink-0 rounded-[8px] border border-[var(--border-subtle)] flex items-center justify-center hover:border-[var(--accent-brass)]"
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="pt-16 pb-28 lg:pb-16">
        {preview && (
          <div role="status" className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3 text-sm">
              <Eye size={16} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <p className="flex-1 font-semibold">{t.shopProfile.previewBanner}</p>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4">
          {/* ── Header ── */}
          <section className="py-8 flex flex-col sm:flex-row sm:items-center gap-5" aria-labelledby="barber-name">
            <BarberAvatar barber={barber} size={104} priority />
            <div className="min-w-0 flex-1">
              <h1 id="barber-name" className="text-3xl font-black break-words" style={{ fontFamily: FFD }}>
                {barber.full_name}
              </h1>
              <MetaLine
                items={[
                  title,
                  ratingText
                    ? {
                        key: "rating",
                        icon: <Star size={13} aria-hidden="true" style={{ color: "var(--accent-brass)", fill: "var(--accent-brass)" }} />,
                        label: ratingText,
                      }
                    : null,
                  barber.years_experience != null && barber.years_experience > 0
                    ? interpolate(t.barberPage.yearsExperience, { count: formatNumber(barber.years_experience) })
                    : null,
                ]}
                className="mt-1 text-sm text-[var(--text-secondary)]"
              />
              <p className="mt-1 text-sm">
                {t.barberPage.worksAt}{" "}
                <Link href={shopHref} className="focus-ring font-bold text-[var(--accent-text)] underline underline-offset-2">
                  {shopName}
                </Link>
              </p>
              <NextAvailable
                shopId={shop.id}
                serviceId={services[0]?.id ?? null}
                barberId={barber.id}
                timeZone={shop.timezone || "Asia/Amman"}
                className="mt-3 text-sm font-semibold"
              />
            </div>
            <Link
              href={bookHref}
              prefetch={false}
              className="focus-ring hidden lg:inline-flex items-center justify-center h-12 px-6 rounded-full bg-[var(--cta-bg)] text-[var(--cta-fg)] font-bold hover:opacity-90"
            >
              {bookLabel}
            </Link>
          </section>

          <div className="space-y-12">
            {(bio || languages.length > 0) && (
              <section aria-labelledby="barber-about">
                <h2 id="barber-about" className="text-xl font-black mb-3">
                  {t.barberPage.about}
                </h2>
                {bio && <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{bio}</p>}
                {languages.length > 0 && (
                  <p className="mt-3 text-sm">
                    <span className="font-bold">{t.barberPage.languages}:</span>{" "}
                    <span className="text-[var(--text-secondary)]">{languages.join(isRTL ? "، " : ", ")}</span>
                  </p>
                )}
              </section>
            )}

            <section aria-labelledby="barber-services">
              <h2 id="barber-services" className="text-xl font-black mb-4">
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
                <h2 id="barber-work" className="text-xl font-black mb-4">
                  {t.barberPage.work}
                </h2>
                <PortfolioGrid items={portfolio} services={services} />
              </section>
            )}

            <section aria-labelledby="barber-reviews">
              <h2 id="barber-reviews" className="text-xl font-black mb-4">
                {t.barberPage.reviews}
              </h2>
              {reviews.length === 0 ? (
                <EmptyState icon={Star} size="sm" title={interpolate(t.barberPage.noReviews, { name: barber.full_name.split(" ")[0] })} />
              ) : (
                <ul className="space-y-4">
                  {reviews.map((r) => {
                    const svc = (isRTL && r.service_name_ar) || r.service_name;
                    return (
                      <li key={r.id} className="rounded-[12px] border border-[var(--border-subtle)] p-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <RatingStars rating={r.rating} size={13} label={interpolate(t.shopPage.ratingLabel, { rating: r.rating })} />
                          <MetaLine
                            items={[r.reviewer_name?.trim() || t.shopPage.anonymousReviewer, formatDate(r.created_at, "medium"), svc]}
                            as="span"
                            className="text-xs text-[var(--text-secondary)]"
                          />
                        </div>
                        {r.comment && <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed break-words">{r.comment}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {colleagues.length > 0 && (
              <section aria-labelledby="barber-colleagues">
                <h2 id="barber-colleagues" className="text-xl font-black mb-4">
                  {interpolate(t.barberPage.otherBarbers, { shop: shopName })}
                </h2>
                <ul className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {colleagues.map((c) => (
                    <li key={c.id} className="shrink-0 w-24">
                      <Link href={barberPath(c.handle!, locale)} className="focus-ring flex flex-col items-center gap-2 text-center rounded-[8px] p-1">
                        <BarberAvatar barber={c} size={64} />
                        <span className="text-xs font-bold line-clamp-1">{c.full_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Mobile sticky booking bar (BookingCta styling; carries ?barber=) */}
      <div
        role="region"
        aria-label={t.primitives.bookingSummaryLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 backdrop-blur lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto flex max-w-screen-sm items-center gap-3 px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            <bdi>{barber.full_name}</bdi>
            {fromPrice != null && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-[var(--text-muted)]">
                  {META_SEPARATOR}
                </span>
                <bdi>{t.primitives.fromPrice.replace("{price}", formatJOD(fromPrice, { locale, trimZeros: true }))}</bdi>
              </>
            )}
          </p>
          <Link
            href={stickyHref}
            prefetch={false}
            className={cn("focus-ring inline-flex items-center justify-center h-12 px-6 rounded-full bg-[var(--cta-bg)] text-[var(--cta-fg)] font-bold whitespace-nowrap hover:opacity-90")}
          >
            {t.primitives.bookNow}
          </Link>
        </div>
      </div>
    </div>
  );
}
