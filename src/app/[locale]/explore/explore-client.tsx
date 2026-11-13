"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarDays,
  Compass,
  MapPin,
  Search,
  SearchX,
  Star,
  Store,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { coverForShop, shopInitials, summarizeRatings } from "../shop/shop-utils";
import { filterShops, type ExploreShop } from "./explore-utils";

function ShopCardSkeleton() {
  return (
    <div className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 space-y-2.5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export default function ExploreClient() {
  const { FF, FFD, dir, t, isRTL, href, formatCurrency, formatDuration, formatNumber } = useTranslation();
  const pathname = usePathname() || "";
  const [shops, setShops] = useState<ExploreShop[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [searchTerm, setSearchTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const supabase = createClient();
      const [{ data: auth }, shopsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("shops").select("id, name, address, currency").order("name"),
      ]);
      setIsLoggedIn(!!auth?.user);
      if (shopsRes.error) {
        setStatus("error");
        return;
      }
      const rows = (shopsRes.data ?? []) as { id: string; name: string; address: string | null; currency: string | null }[];
      const ids = rows.map((s) => s.id);

      let reviewRows: { shop_id: string; rating: number }[] = [];
      let serviceRows: { shop_id: string; name: string; name_ar: string | null; duration: number; price: number }[] = [];
      if (ids.length > 0) {
        const [reviewsRes, servicesRes] = await Promise.all([
          supabase.from("reviews").select("shop_id, rating").in("shop_id", ids).limit(5000),
          supabase
            .from("services")
            .select("shop_id, name, name_ar, duration, price")
            .in("shop_id", ids)
            .eq("is_active", true)
            .order("price", { ascending: true }),
        ]);
        reviewRows = (reviewsRes.data ?? []) as typeof reviewRows;
        serviceRows = (servicesRes.data ?? []) as typeof serviceRows;
      }

      setShops(
        rows.map((s) => {
          const shopServices = serviceRows.filter((r) => r.shop_id === s.id);
          const ratings = summarizeRatings(reviewRows.filter((r) => r.shop_id === s.id).map((r) => r.rating));
          const cheapest = shopServices[0];
          return {
            id: s.id,
            name: s.name,
            address: s.address,
            currency: s.currency || "JOD",
            rating: ratings.count > 0 ? { avg: ratings.average, count: ratings.count } : null,
            cheapest: cheapest ? { price: Number(cheapest.price) || 0, duration: cheapest.duration } : null,
            serviceNames: shopServices.flatMap((r) => [r.name, r.name_ar ?? ""]).filter(Boolean),
          };
        }),
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Data fetch on mount; the loader sets state after awaiting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const filtered = useMemo(() => filterShops(shops, searchTerm), [shops, searchTerm]);
  const overallRating = useMemo(() => {
    const rated = shops.filter((s) => s.rating);
    const count = rated.reduce((a, s) => a + (s.rating?.count ?? 0), 0);
    if (count === 0) return null;
    return rated.reduce((a, s) => a + (s.rating!.avg * s.rating!.count), 0) / count;
  }, [shops]);

  const loading = status === "loading";
  const accountHref = isLoggedIn ? href("/customer") : href("/auth/login");
  const onExplore = /\/explore\/?$/.test(pathname);

  const trustPills = [
    { icon: Store, text: interpolate(t.explore.shopsInfo, { count: loading ? "—" : formatNumber(shops.length) }) },
    overallRating !== null && { icon: Star, text: interpolate(t.explore.avgRatingValue, { rating: overallRating.toFixed(1) }) },
    { icon: CalendarCheck, text: t.explore.freeCancel },
    { icon: Wallet, text: t.explore.payInShop },
  ].filter(Boolean) as { icon: typeof Store; text: string }[];

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: FF }} dir={dir}>
      {/* ── Navbar ── */}
      <header
        className="fixed top-0 inset-x-0 z-[60] bg-[var(--bg-primary)] transition-colors"
        style={{ borderBottom: `1px solid ${scrolled ? "var(--border-subtle)" : "transparent"}` }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-3 sm:gap-6">
          <Link
            href={isLoggedIn ? href("/customer") : href("/landing")}
            className="text-xl font-black text-[var(--text-primary)] shrink-0 rounded-sm"
            style={{ fontFamily: FFD }}
          >
            Halaqy.
          </Link>

          <form role="search" className="flex-1 min-w-0 max-w-[440px]" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="explore-search" className="sr-only">
              {t.explore.searchLabel}
            </label>
            <div className="relative">
              <Search
                size={17}
                aria-hidden="true"
                className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[var(--text-secondary)] pointer-events-none"
              />
              <input
                ref={inputRef}
                id="explore-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.explore.searchPlaceholder}
                autoComplete="off"
                enterKeyHint="search"
                className="field-input has-icon has-action w-full"
                style={{ height: 42, fontSize: 16 }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    inputRef.current?.focus();
                  }}
                  aria-label={t.explore.clearSearch}
                  className="field-action"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </form>

          <div className="hidden md:flex items-center gap-2 ms-auto shrink-0">
            {isLoggedIn ? (
              <Link href={href("/customer")} className="btn btn-ghost text-[14px]" style={{ minHeight: 40 }}>
                <CalendarDays size={16} aria-hidden="true" />
                {t.explore.myBookings}
              </Link>
            ) : (
              <Link href={href("/auth/login")} className="btn btn-ghost text-[14px]" style={{ minHeight: 40 }}>
                {t.explore.signIn}
              </Link>
            )}
            {!isLoggedIn && (
              <Link href={href("/auth/signup")} className="btn btn-primary text-[14px]" style={{ minHeight: 40 }}>
                {t.explore.getStarted}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="pt-16 pb-24 md:pb-0">
        {/* ── Hero ── */}
        <section className="border-b border-[var(--border-subtle)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}>
              <p className="eyebrow mb-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-secondary)] px-3.5 py-1.5 text-[11px] font-bold">
                {t.explore.premierDir}
              </p>
              <h1
                className="font-black text-[var(--text-primary)] mb-4"
                style={{
                  fontSize: "clamp(34px, 5.5vw, 64px)",
                  lineHeight: 1.06,
                  fontFamily: FFD,
                  letterSpacing: headingTracking(isRTL, "0.018em"),
                }}
              >
                {t.explore.findNext}
                <br />
                <span className="text-[var(--text-secondary)]">{t.explore.perfectCut}</span>
              </h1>
              <p className="text-base sm:text-[17px] text-[var(--text-secondary)] leading-relaxed max-w-[520px] mb-8">{t.explore.subtitle}</p>
              <ul className="flex flex-wrap gap-2.5">
                {trustPills.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-secondary)]"
                  >
                    <Icon size={15} aria-hidden="true" className="text-[var(--accent-brass)]" />
                    {text}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* ── Results bar ── */}
        <div className="sticky top-16 z-50 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-3 min-h-[44px] flex items-center">
            <p className="text-xs font-semibold text-[var(--text-secondary)]" aria-live="polite">
              {status === "ok" ? interpolate(t.explore.found, { count: formatNumber(filtered.length) }) : ""}
            </p>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
          {loading ? (
            <SkeletonGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <ShopCardSkeleton key={i} />
              ))}
            </SkeletonGroup>
          ) : status === "error" ? (
            <EmptyState
              icon={Store}
              tone="error"
              title={t.explore.loadErrorTitle}
              description={t.explore.loadErrorDesc}
              action={{ label: t.common.retry, onClick: load }}
            />
          ) : shops.length === 0 ? (
            <EmptyState icon={Store} title={t.explore.emptyTitle} description={t.explore.emptyDesc} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t.explore.noResults}
              description={t.explore.tryDifferent}
              action={{
                label: t.explore.clearSearch,
                onClick: () => {
                  setSearchTerm("");
                  inputRef.current?.focus();
                },
              }}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((shop, idx) => {
                const cover = coverForShop(shop.id);
                const shopHref = href(`/shop/${shop.id}`);
                return (
                  <motion.li
                    key={shop.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx, 8) * 0.04, ease: [0.25, 1, 0.5, 1] }}
                    className="group relative flex flex-col rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-primary)] transition-[transform,border-color] duration-150 hover:-translate-y-1 hover:border-[var(--accent-brass)] focus-within:border-[var(--accent-brass)]"
                  >
                    {/* Cover tile — per-shop accent + initials (no stock photos) */}
                    <div
                      aria-hidden="true"
                      className="relative aspect-[4/3] flex items-center justify-center overflow-hidden"
                      style={{ background: cover.bg }}
                    >
                      <span className="text-[40px] font-black" style={{ color: cover.fg, fontFamily: FFD }}>
                        {shopInitials(shop.name)}
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 p-5">
                      <h2 className="text-base font-black text-[var(--text-primary)] mb-1 truncate" style={{ fontFamily: FFD }}>
                        {/* Stretched link: the whole card opens the shop; the CTAs sit above it. */}
                        <Link href={shopHref} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                          {shop.name}
                        </Link>
                      </h2>
                      {shop.rating ? (
                        <p
                          className="flex items-center gap-1 mb-1.5 text-[13px]"
                          aria-label={interpolate(t.explore.ratingCount, {
                            rating: shop.rating.avg.toFixed(1),
                            count: formatNumber(shop.rating.count),
                          })}
                        >
                          <Star size={14} aria-hidden="true" style={{ color: "var(--accent-brass)", fill: "var(--accent-brass)" }} />
                          <span aria-hidden="true" className="font-bold text-[var(--text-primary)]">
                            {shop.rating.avg.toFixed(1)}
                          </span>
                          <span aria-hidden="true" className="text-xs text-[var(--text-secondary)]">
                            ({formatNumber(shop.rating.count)})
                          </span>
                        </p>
                      ) : null}
                      <p className="flex items-center gap-1 mb-4 text-[13px] text-[var(--text-secondary)] min-w-0">
                        <MapPin size={13} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">{shop.address || t.explore.locationUnavailable}</span>
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-3 pt-3.5 border-t border-[var(--border-subtle)]">
                        {shop.cheapest ? (
                          <p className="min-w-0 text-sm">
                            <span className="font-extrabold text-[var(--text-primary)]">
                              {interpolate(t.explore.fromAmount, { price: formatCurrency(shop.cheapest.price, shop.currency) })}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)] ms-1.5">· {formatDuration(shop.cheapest.duration)}</span>
                          </p>
                        ) : (
                          <span />
                        )}
                        <Link
                          href={href(`/book/${shop.id}`)}
                          aria-label={interpolate(t.explore.bookAt, { name: shop.name })}
                          className="relative z-10 shrink-0 inline-flex items-center rounded-full px-4 py-2 text-xs font-bold bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
                        >
                          {t.explore.bookNow}
                        </Link>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
          <div className="rounded-[12px] px-6 py-12 sm:px-12 sm:py-14 text-center bg-[var(--text-primary)]">
            <h2
              className="font-black text-[var(--bg-primary)] mb-3"
              style={{ fontSize: "clamp(24px, 3vw, 36px)", fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.014em") }}
            >
              {t.explore.readyToLook}
            </h2>
            <p className="text-[15px] mb-8" style={{ color: "rgba(255,255,255,0.72)" }}>
              {isLoggedIn ? t.explore.bookNextInSeconds : t.explore.createFreeAccount}
            </p>
            <Link
              href={isLoggedIn ? href("/customer") : href("/auth/signup")}
              className="btn inline-flex rounded-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-bold px-9"
              style={{ minHeight: 50 }}
            >
              {isLoggedIn ? t.explore.goToDashboard : t.explore.getStartedFree}
            </Link>
          </div>
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label={t.explore.mainNav}
        className="md:hidden fixed bottom-0 inset-x-0 z-[60] flex justify-around items-center bg-[var(--bg-primary)] border-t border-[var(--border-subtle)] px-4 pt-2.5"
        style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      >
        {[
          { key: "explore", label: t.explore.navExplore, icon: Compass, to: href("/explore"), active: onExplore },
          { key: "bookings", label: t.explore.navBookings, icon: CalendarDays, to: isLoggedIn ? href("/customer") : href("/auth/login"), active: false },
          { key: "account", label: t.explore.navAccount, icon: UserRound, to: accountHref, active: false },
        ].map(({ key, label, icon: Icon, to, active }) => (
          <Link
            key={key}
            href={to}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-1 rounded-[8px] text-[11px] font-bold ${
              active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            <span
              className={`w-10 h-8 rounded-full flex items-center justify-center ${active ? "bg-[var(--bg-secondary)]" : ""}`}
              aria-hidden="true"
            >
              <Icon size={20} />
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
