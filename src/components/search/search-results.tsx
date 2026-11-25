"use client";

// The results page body: sticky pre-filled search bar, filter chips, Shops /
// Barbers tabs, list + map. State lives in the URL; this component reads it,
// fetches through the search RPCs from the browser (so the per-IP rate limit
// applies to the visitor, not the server) and writes changes back with
// history.pushState so nothing re-renders on the server.
//
// v2 (§6.2): desktop (≥1024px) splits list and map, the map sticky and flush
// to the inline-end edge under the sticky search/filter bar. Phones: a
// floating ink Map / List pill swaps the two in a reserved, fixed-height area
// (no layout shift). The map library is lazy-loaded and never blocks first
// paint.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, List, LocateOff, Map as MapIcon, MapPin, SearchX, Store, UserRound } from "lucide-react";
import { useTranslation, interpolate, localizeHref } from "@/hooks/use-translation";
import { pluralLabel } from "@/components/ui/booking-cta";
import { EmptyState, type EmptyStateAction } from "@/components/ui/empty-state";
import { ShopCardSkeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buttonClasses, spinnerClasses } from "@/components/ui/recipes";
import { readSrc } from "@/components/shop/lib/booking";
import { shopPath } from "@/components/shop/lib/slug";
import { createClient } from "@/lib/supabase/client";
import { formatJOD, formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  findCity,
  localName,
  parseSearchParams,
  readLastCity,
  requestGeolocation,
  resolveOrigin,
  sameQuery,
  searchBarbers,
  searchErrorCode,
  searchHref,
  searchShops,
  serializeSearchState,
  showsDistance,
  writeLastCity,
  SEARCH_PAGE_SIZE,
  type BarberResult,
  type GeoFailure,
  type GeoPoint,
  type SearchCategory,
  type SearchCity,
  type SearchErrorCode,
  type SearchPage,
  type SearchRpcClient,
  type SearchState,
  type ShopResult,
} from "@/lib/search";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { ShopCard } from "./shop-card";
import { BarberCard } from "./barber-card";
import type { MapPin as Pin } from "./results-map";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-sunken" />,
});

type Item = ShopResult | BarberResult;

export interface SearchResultsProps {
  cities: SearchCity[];
  categories: SearchCategory[];
  /** Server-rendered first page for the URL state (null when SSR skipped it). */
  initial?: { state: SearchState; page: SearchPage<Item> } | null;
}

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatch(mq.matches);
    const fn = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return match;
}

const gridCls = "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-5 xl:grid-cols-2";

/** Height of the sticky search/filter bar, so the desktop map can sit flush under it. */
function useElementHeight(ref: React.RefObject<HTMLElement | null>, fallback: number): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

export function SearchResults({ cities, categories, initial }: SearchResultsProps) {
  const { t, locale } = useTranslation();
  const S = t.search;
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => parseSearchParams(params), [params]);
  const src = useMemo(() => readSrc(params), [params]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const barRef = useRef<HTMLDivElement>(null);
  const barHeight = useElementHeight(barRef, 136);

  // ── Location fallback chain ───────────────────────────────────────────────
  const [lastCity, setLastCity] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | GeoFailure>("idle");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Client-only storage read after hydration.

    setLastCity(readLastCity());
    setReady(true);
  }, []);

  useEffect(() => {
    if (state.city) writeLastCity(state.city);
  }, [state.city]);

  useEffect(() => {
    if (!state.near || geo) return;
    let alive = true;

    setGeoState("locating");
    requestGeolocation().then((res) => {
      if (!alive) return;
      if ("point" in res) {
        setGeo(res.point);
        setGeoState("idle");
      } else setGeoState(res.error);
    });
    return () => {
      alive = false;
    };
  }, [state.near, geo]);

  const origin = useMemo(() => resolveOrigin(state, cities, { geo: state.near ? geo : null, lastCity }), [state, cities, geo, lastCity]);
  const distanceOn = showsDistance(origin);
  const originKey = `${origin.kind}:${origin.lat}:${origin.lng}:${origin.cityId}:${origin.areaId}:${origin.radiusKm}`;

  // ── URL writes (no server round trip) ────────────────────────────────────
  const navigate = useCallback(
    (next: SearchState, mode: "push" | "replace" = "push") => {
      let href = searchHref(locale, next);
      if (src) href += `${href.includes("?") ? "&" : "?"}src=${encodeURIComponent(src)}`;
      if (mode === "replace") window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    },
    [locale, src],
  );

  // ── Fetching ─────────────────────────────────────────────────────────────
  const queryKey = serializeSearchState({ ...state, view: "list" });
  const initialMatches = !!initial && sameQuery(initial.state, state);
  const [items, setItems] = useState<Item[]>(initialMatches ? initial!.page.items : []);
  const [total, setTotal] = useState<number | null>(initialMatches ? initial!.page.total : null);
  const [hasMore, setHasMore] = useState(initialMatches ? initial!.page.hasMore : false);
  const [status, setStatus] = useState<"loading" | "ok" | "error">(initialMatches ? "ok" : "loading");
  const [errorCode, setErrorCode] = useState<SearchErrorCode | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);
  const skipFirst = useRef(initialMatches);
  const clientRef = useRef<SearchRpcClient | null>(null);
  const client = () => (clientRef.current ??= createClient() as unknown as SearchRpcClient);

  const fetchPage = useCallback(
    async (offset: number) => {
      const run = state.tab === "barbers" ? searchBarbers : searchShops;
      return run(client(), state, origin, { offset, limit: SEARCH_PAGE_SIZE }) as Promise<SearchPage<Item>>;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey, originKey],
  );

  const load = useCallback(async () => {
    const id = ++seq.current;
    setStatus("loading");
    setErrorCode(null);
    try {
      const page = await fetchPage(0);
      if (id !== seq.current) return;
      setItems(page.items);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setStatus("ok");
    } catch (e) {
      if (id !== seq.current) return;
      setErrorCode(searchErrorCode(e));
      setStatus("error");
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!ready) return;
    if (state.near && geoState === "locating") return;
    // SSR already rendered this exact query from the default origin.
    if (skipFirst.current) {
      skipFirst.current = false;
      if (origin.kind !== "default" || !lastCity || lastCity === "amman" || !findCity(cities, lastCity)) return;
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, queryKey, originKey, geoState === "locating"]);

  async function loadMore() {
    const id = seq.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(items.length);
      if (id !== seq.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setHasMore(page.hasMore && page.items.length > 0);
    } catch (e) {
      if (id === seq.current) {
        setErrorCode(searchErrorCode(e));
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapBroken, setMapBroken] = useState(false);
  const pins: Pin[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Pin[] = [];
    for (const it of items) {
      if (it.lat === null || it.lng === null) continue;
      const shopId = it.kind === "shop" ? it.id : it.shop.id;
      if (seen.has(shopId)) continue;
      seen.add(shopId);
      const name = it.kind === "shop" ? localName({ en: it.name, ar: it.nameAr }, locale) || it.name : it.fullName;
      const price = it.minPrice !== null ? formatJOD(it.minPrice, { locale, trimZeros: true }) : null;
      const label = price ? interpolate(t.primitives.fromPrice, { price }) : name;
      out.push({
        id: it.id,
        lat: it.lat,
        lng: it.lng,
        label,
        ariaLabel: price ? interpolate(S.mapPin, { name, price }) : name,
      });
    }
    return out;
  }, [items, locale, t.primitives.fromPrice, S.mapPin]);

  const showMap = isDesktop || state.view === "map";
  const mapCenter = { lat: origin.lat ?? 31.9539, lng: origin.lng ?? 35.9106 };

  function selectPin(id: string) {
    setActiveId(id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (isDesktop) {
      document.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    // Phones: open the shop (the card is not visible behind the map).
    const shop = item.kind === "shop" ? item : item.shop;
    router.push(shopPath(shop, locale));
  }

  // ── Copy helpers ─────────────────────────────────────────────────────────
  const city = findCity(cities, state.city);
  const cityName = city ? (locale === "ar" ? city.nameAr : city.nameEn) : "";
  const fmtCount = (n: number) => formatLocalizedNumber(n, locale);
  const shownCount = total ?? items.length;
  // Hidden at zero: the empty state already says so (and "٠" reads like the meta dot).
  const countText =
    status !== "ok" || shownCount === 0
      ? ""
      : total === null && hasMore
        ? interpolate(S.resultsMany, { count: fmtCount(items.length) })
        : pluralLabel(S.resultsCountForms, shownCount, locale, fmtCount(shownCount));
  // Nothing narrows the query: zero results means the marketplace itself is empty here.
  const unfiltered =
    !state.q &&
    !state.area &&
    !state.city &&
    !state.near &&
    !state.when &&
    !state.time &&
    state.filters.length === 0 &&
    state.priceMin === null &&
    state.priceMax === null;

  const emptyActions: EmptyStateAction[] = [];
  if (state.area && city)
    emptyActions.push({
      label: interpolate(S.widenToCity, { city: cityName }),
      onClick: () => navigate({ ...state, area: "" }),
      icon: MapPin,
    });
  else if (state.city || state.near)
    emptyActions.push({ label: S.widenAnywhere, onClick: () => navigate({ ...state, city: "", area: "", near: false }), icon: MapPin });
  if (
    state.when !== "tomorrow" &&
    (state.when || state.time || state.filters.includes("available_today") || state.filters.includes("open_now"))
  ) {
    emptyActions.push({
      label: S.tryTomorrow,
      onClick: () =>
        navigate({ ...state, when: "tomorrow", filters: state.filters.filter((f) => f !== "available_today" && f !== "open_now") }),
      icon: CalendarClock,
    });
  }
  if (emptyActions.length < 2 && (state.filters.length || state.priceMin !== null || state.priceMax !== null)) {
    emptyActions.push({ label: S.clearAll, onClick: () => navigate({ ...state, filters: [], priceMin: null, priceMax: null }) });
  }
  if (emptyActions.length === 0 && state.q) emptyActions.push({ label: S.clearQueryAction, onClick: () => navigate({ ...state, q: "" }) });
  if (unfiltered) emptyActions.push({ label: S.listYourShop, href: localizeHref("/for-business", locale), icon: Store });

  const tabs = [
    { value: "shops" as const, label: S.tabShops, icon: <Store /> },
    { value: "barbers" as const, label: S.tabBarbers, icon: <UserRound /> },
  ];

  const list = (
    <section aria-labelledby="results-heading" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 id="results-heading" className="text-h2 min-w-0 text-ink">
          {state.q ? interpolate(S.resultsFor, { q: state.q }) : state.tab === "barbers" ? S.tabBarbers : S.tabShops}
        </h1>
        <p aria-live="polite" className="shrink-0 text-meta font-medium text-ink-muted tabular-nums">
          {countText}
        </p>
      </div>

      {state.near && geoState !== "idle" && geoState !== "locating" && (
        <p role="status" className="mb-4 flex items-start gap-2.5 rounded-xl bg-sunken px-4 py-3 text-sm text-ink-soft">
          <LocateOff size={18} aria-hidden="true" className="mt-px shrink-0 text-ink-muted" />
          <span>
            {geoState === "denied"
              ? interpolate(S.geoDenied, { city: lastCityName(cities, lastCity, locale, S.defaultCity) })
              : S.geoUnavailable}
          </span>
        </p>
      )}
      {state.near && geoState === "locating" && (
        <p role="status" className="mb-4 flex items-center gap-2.5 text-sm text-ink-muted">
          <span aria-hidden="true" className={spinnerClasses} />
          {S.locating}
        </p>
      )}

      {status === "loading" ? (
        <div aria-busy="true">
          <ShopCardSkeleton count={4} className={gridCls} />
          <span className="sr-only">{t.common.loading}</span>
        </div>
      ) : status === "error" ? (
        <EmptyState
          tone="error"
          icon={AlertTriangle}
          title={S.errorTitle}
          description={errorCode === "RATE_LIMITED" ? S.rateLimitedDesc : S.errorDesc}
          action={{ label: S.retry, onClick: () => load() }}
          headingLevel={2}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={unfiltered ? Store : SearchX}
          title={unfiltered ? S.noShopsYetTitle : S.noResultsTitle}
          description={unfiltered ? S.noShopsYetDesc : S.noResultsDesc}
          action={emptyActions[0]}
          secondaryAction={emptyActions[1]}
          headingLevel={2}
        />
      ) : (
        <>
          <ul className={gridCls}>
            {items.map((it, i) => (
              <li key={it.id} data-result-id={it.id} className="min-w-0">
                {it.kind === "shop" ? (
                  <ShopCard
                    shop={it}
                    showDistance={distanceOn}
                    active={activeId === it.id}
                    src={src}
                    priority={i < 2}
                    onHover={isDesktop ? setActiveId : undefined}
                  />
                ) : (
                  <BarberCard barber={it} showDistance={distanceOn} src={src} />
                )}
              </li>
            ))}
          </ul>
          {errorCode && status === "ok" && (
            <p role="alert" className="mt-5 text-center text-sm font-medium text-danger-text">
              {errorCode === "RATE_LIMITED" ? S.rateLimitedDesc : S.errorDesc}
            </p>
          )}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto sm:min-w-56" })}
              >
                {loadingMore && <span aria-hidden="true" className={spinnerClasses} />}
                {loadingMore ? t.common.loading : S.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <div className="w-full pb-28 lg:pb-0" style={{ ["--results-bar-h" as string]: `${barHeight}px` } as React.CSSProperties}>
      {/* Sticky, pre-filled search + filters, under the site header (h-16) */}
      <div ref={barRef} className="sticky top-16 z-30 border-b border-line bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-page/85">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:max-w-none lg:px-8">
          <SearchBar
            variant="compact"
            initial={state}
            cities={cities}
            categories={categories}
            onSearch={(next) => {
              if (next.city) writeLastCity(next.city);
              navigate(next);
            }}
          />
          <FilterBar state={state} onChange={(next) => navigate(next)} className="mt-3" />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* List column — phones: list OR map in the same slot; desktop: both */}
        <div
          className={cn(
            "mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:max-w-none lg:px-8 lg:pb-12 lg:pt-6",
            !isDesktop && state.view === "map" && "hidden",
          )}
        >
          {/* Shops / Barbers */}
          <SegmentedControl
            semantics="tabs"
            variant="pill"
            idPrefix="results"
            ariaLabel={S.resultsTabsLabel}
            value={state.tab}
            onChange={(tab) => navigate({ ...state, tab })}
            options={tabs}
            className="mb-5"
          />
          <div id={`results-panel-${state.tab}`} role="tabpanel" aria-labelledby={`results-tab-${state.tab}`}>
            {list}
          </div>
        </div>

        {showMap && (
          <div
            className={cn(
              "relative mx-4 mt-4 overflow-hidden rounded-2xl border border-line shadow-card sm:mx-6",
              "h-[calc(100dvh-15rem)] min-h-[360px]",
              "lg:sticky lg:top-[calc(4rem+var(--results-bar-h,8.5rem))] lg:m-0 lg:h-[calc(100dvh-4rem-var(--results-bar-h,8.5rem))] lg:min-h-0 lg:rounded-none lg:border-0 lg:border-s lg:shadow-none",
            )}
          >
            {mapBroken ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-sunken p-6 text-center">
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-card text-ink-muted shadow-xs">
                  <MapIcon size={22} />
                </span>
                <p className="max-w-xs text-sm text-ink-soft">{S.mapUnavailable}</p>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <ResultsMap
                  pins={pins}
                  center={mapCenter}
                  activeId={activeId}
                  onSelect={selectPin}
                  onHover={isDesktop ? setActiveId : undefined}
                  onUnavailable={() => setMapBroken(true)}
                  className="h-full w-full"
                />
                {status === "ok" && items.length > 0 && pins.length === 0 && (
                  <p className="absolute inset-x-3 bottom-3 rounded-xl border border-line bg-card/95 p-3 text-center text-meta text-ink-soft shadow-raised">
                    {S.mapNoPins}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phones: Map / List pill */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(24px,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => navigate({ ...state, view: state.view === "map" ? "list" : "map" }, "replace")}
          aria-pressed={state.view === "map"}
          className={buttonClasses({ variant: "ink", size: "md", className: "pointer-events-auto shadow-float" })}
        >
          {state.view === "map" ? <List aria-hidden="true" /> : <MapIcon aria-hidden="true" />}
          {state.view === "map" ? S.viewList : S.viewMap}
        </button>
      </div>
    </div>
  );
}

function lastCityName(cities: SearchCity[], slug: string | null, locale: string, fallback: string): string {
  const c = findCity(cities, slug) ?? findCity(cities, "amman");
  if (!c) return fallback;
  return locale === "ar" ? c.nameAr : c.nameEn;
}

export default SearchResults;
