"use client";

// The results page body: sticky pre-filled search bar, filter chips, Shops /
// Barbers tabs, list + map. State lives in the URL; this component reads it,
// fetches through the search RPCs from the browser (so the per-IP rate limit
// applies to the visitor, not the server) and writes changes back with
// history.pushState so nothing re-renders on the server.
//
// Desktop (≥1024px): list and map side by side. Phones: a floating
// Map / List pill swaps the two in a reserved, fixed-height area (no layout
// shift). The map library is lazy-loaded and never blocks first paint.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, List, LocateOff, Map as MapIcon, MapPin, SearchX, Store, UserRound } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { EmptyState, type EmptyStateAction } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--bg-secondary)]" />,
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

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-primary)]" aria-hidden="true">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function SearchResults({ cities, categories, initial }: SearchResultsProps) {
  const { t, locale } = useTranslation();
  const S = t.search;
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => parseSearchParams(params), [params]);
  const src = useMemo(() => readSrc(params), [params]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

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

  const origin = useMemo(
    () => resolveOrigin(state, cities, { geo: state.near ? geo : null, lastCity }),
    [state, cities, geo, lastCity],
  );
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
  const countText =
    status !== "ok"
      ? ""
      : total !== null
        ? interpolate(S.resultsCount, { count: fmtCount(total) })
        : interpolate(hasMore ? S.resultsMany : S.resultsCount, { count: fmtCount(items.length) });

  const emptyActions: EmptyStateAction[] = [];
  if (state.area && city) emptyActions.push({ label: interpolate(S.widenToCity, { city: cityName }), onClick: () => navigate({ ...state, area: "" }), icon: MapPin });
  else if (state.city || state.near) emptyActions.push({ label: S.widenAnywhere, onClick: () => navigate({ ...state, city: "", area: "", near: false }), icon: MapPin });
  if (state.when !== "tomorrow" && (state.when || state.time || state.filters.includes("available_today") || state.filters.includes("open_now"))) {
    emptyActions.push({
      label: S.tryTomorrow,
      onClick: () => navigate({ ...state, when: "tomorrow", filters: state.filters.filter((f) => f !== "available_today" && f !== "open_now") }),
      icon: CalendarClock,
    });
  }
  if (emptyActions.length < 2 && (state.filters.length || state.priceMin !== null || state.priceMax !== null)) {
    emptyActions.push({ label: S.clearAll, onClick: () => navigate({ ...state, filters: [], priceMin: null, priceMax: null }) });
  }
  if (emptyActions.length === 0 && state.q) emptyActions.push({ label: S.clearQueryAction, onClick: () => navigate({ ...state, q: "" }) });

  const tabs: { id: SearchState["tab"]; label: string; icon: typeof Store }[] = [
    { id: "shops", label: S.tabShops, icon: Store },
    { id: "barbers", label: S.tabBarbers, icon: UserRound },
  ];

  const list = (
    <section aria-labelledby="results-heading" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h1 id="results-heading" className="text-[20px] font-bold text-[var(--text-primary)] md:text-[22px]">
          {state.q ? interpolate(S.resultsFor, { q: state.q }) : state.tab === "barbers" ? S.tabBarbers : S.tabShops}
        </h1>
        <p aria-live="polite" className="shrink-0 text-[13px] text-[var(--text-secondary)]">
          {countText}
        </p>
      </div>

      {state.near && geoState !== "idle" && geoState !== "locating" && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 text-[13.5px] text-[var(--text-secondary)]">
          <LocateOff size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{geoState === "denied" ? interpolate(S.geoDenied, { city: lastCityName(cities, lastCity, locale, S.defaultCity) }) : S.geoUnavailable}</span>
        </p>
      )}
      {state.near && geoState === "locating" && (
        <p role="status" className="mb-3 text-[13.5px] text-[var(--text-secondary)]">
          {S.locating}
        </p>
      )}

      {status === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
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
          icon={SearchX}
          title={S.noResultsTitle}
          description={S.noResultsDesc}
          action={emptyActions[0]}
          secondaryAction={emptyActions[1]}
          headingLevel={2}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((it, i) => (
              <li key={it.id} data-result-id={it.id}>
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
            <p role="alert" className="mt-4 text-center text-[13.5px] text-[var(--accent-rose)]">
              {errorCode === "RATE_LIMITED" ? S.rateLimitedDesc : S.errorDesc}
            </p>
          )}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore} className="btn btn-secondary !rounded-full !px-6">
                {loadingMore ? t.common.loading : S.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-28 lg:pb-12">
      {/* Sticky, pre-filled search + filters */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 px-4 pb-3 pt-3 backdrop-blur">
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

      {/* Shops / Barbers */}
      <div role="tablist" aria-label={S.resultsTabsLabel} className="mt-4 flex gap-1 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = state.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="results-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => navigate({ ...state, tab: tab.id })}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const other = tab.id === "shops" ? "barbers" : "shops";
                  navigate({ ...state, tab: other });
                  requestAnimationFrame(() => document.getElementById(`tab-${other}`)?.focus());
                }
              }}
              className={cn(
                "focus-ring -mb-px inline-flex h-11 items-center gap-2 border-b-2 px-4 text-[14.5px] font-semibold",
                selected ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id="results-panel" role="tabpanel" aria-labelledby={`tab-${state.tab}`} className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-6">
        {/* Phones: list OR map in the same slot; desktop: both */}
        <div className={cn(!isDesktop && state.view === "map" && "hidden")}>{list}</div>

        {showMap && (
          <div
            className={cn(
              "overflow-hidden rounded-[16px] border border-[var(--border-subtle)]",
              "h-[calc(100dvh-15rem)] min-h-[360px] lg:sticky lg:top-[13.5rem] lg:h-[calc(100dvh-15rem)]",
            )}
          >
            {mapBroken ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-[14px] text-[var(--text-secondary)]">{S.mapUnavailable}</div>
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
                  <p className="absolute inset-x-3 bottom-3 rounded-xl bg-[var(--bg-primary)]/95 p-3 text-center text-[13px] text-[var(--text-secondary)] shadow">
                    {S.mapNoPins}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phones: Map / List pill */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => navigate({ ...state, view: state.view === "map" ? "list" : "map" }, "replace")}
          aria-pressed={state.view === "map"}
          className="focus-ring pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-[15px] font-bold text-[var(--bg-primary)] shadow-[0_12px_32px_-12px_rgba(28,22,17,0.6)]"
        >
          {state.view === "map" ? <List size={18} aria-hidden="true" /> : <MapIcon size={18} aria-hidden="true" />}
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
