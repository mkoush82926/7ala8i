"use client";

// MapLibre GL map of search results. Loaded with next/dynamic(ssr:false) by
// the results view, so neither the library nor its CSS touch first paint.
//
// Style: MapTiler streets when NEXT_PUBLIC_MAPTILER_KEY is set, otherwise
// OpenStreetMap raster tiles (no key). If WebGL or tiles fail, onUnavailable
// fires and the list keeps working.
//
// Pins are real <button>s ("from 5 JD") so they are focusable and named;
// controls sit on the inline-end side (left in RTL).

import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "@/hooks/use-translation";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  /** Visible pin text, e.g. "from 5 JD". */
  label: string;
  /** Accessible name, e.g. "The Razor, from 5 JD". */
  ariaLabel: string;
}

export interface ResultsMapProps {
  pins: MapPin[];
  center: { lat: number; lng: number };
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onUnavailable?: () => void;
  className?: string;
}

/**
 * MapLibre 6 loads its worker from a file next to its own module, which the
 * Next bundle does not emit, so the worker is vendored into /public. The file
 * name carries the package version; results-map.test.ts fails when
 * maplibre-gl is upgraded without refreshing it:
 *   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/vendor/maplibre-gl-worker-<version>.mjs
 */
export const MAPLIBRE_VERSION = "6.18.0";
export const MAPLIBRE_WORKER_URL = `/vendor/maplibre-gl-worker-${MAPLIBRE_VERSION}.mjs`;

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function mapStyle(key = process.env.NEXT_PUBLIC_MAPTILER_KEY): string | StyleSpecification {
  const k = key?.trim();
  return k && /^[A-Za-z0-9_-]{8,128}$/.test(k) ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(k)}` : OSM_STYLE;
}

const PIN_BASE =
  "halaqy-pin focus-ring cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-bold shadow-[0_6px_16px_-6px_rgba(28,22,17,0.5)] transition-transform";
const PIN_OFF = "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)]";
const PIN_ON = "border-transparent bg-[var(--cta-bg)] text-[var(--cta-fg)] scale-110";

export function ResultsMap({ pins, center, activeId, onSelect, onHover, onUnavailable, className }: ResultsMapProps) {
  const { t, isRTL } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, { marker: MlMarker; button: HTMLButtonElement }>>(new Map());
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const cb = useRef({ onSelect, onHover, onUnavailable });
  cb.current = { onSelect, onHover, onUnavailable };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const markerMap = markers.current;
    let loaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        lib.current = ml;
        ml.setWorkerUrl(new URL(MAPLIBRE_WORKER_URL, window.location.origin).href);
        const m = new ml.Map({
          container: el.current,
          style: mapStyle(),
          center: [center.lng, center.lat],
          zoom: 11,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), isRTL ? "top-left" : "top-right");
        m.on("data", (e: unknown) => {
          if ((e as { dataType?: string }).dataType === "source") loaded = true;
        });
        m.on("error", () => {
          if (!loaded) cb.current.onUnavailable?.();
        });
        m.on("load", () => syncMarkers());
        timer = setTimeout(() => {
          if (!loaded && !cancelled) cb.current.onUnavailable?.();
        }, 12000);
        syncMarkers();
      } catch {
        if (!cancelled) cb.current.onUnavailable?.();
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinsKey = pins.map((p) => `${p.id}:${p.lat},${p.lng}:${p.label}`).join("|");

  function syncMarkers() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const keep = new Set(pins.map((p) => p.id));
    markers.current.forEach((entry, id) => {
      if (!keep.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    });
    for (const p of pins) {
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.marker.setLngLat([p.lng, p.lat]);
        existing.button.textContent = p.label;
        existing.button.setAttribute("aria-label", p.ariaLabel);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${PIN_BASE} ${PIN_OFF}`;
      button.textContent = p.label;
      button.setAttribute("aria-label", p.ariaLabel);
      button.dataset.pinId = p.id;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onSelect?.(p.id);
      });
      button.addEventListener("mouseenter", () => cb.current.onHover?.(p.id));
      button.addEventListener("mouseleave", () => cb.current.onHover?.(null));
      button.addEventListener("focus", () => cb.current.onHover?.(p.id));
      button.addEventListener("blur", () => cb.current.onHover?.(null));
      const marker = new ml.Marker({ element: button, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.id, { marker, button });
    }
    if (pins.length > 0) {
      const b = new ml.LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 56, maxZoom: 15, duration: 0 });
    } else {
      m.jumpTo({ center: [center.lng, center.lat], zoom: 11 });
    }
  }

  // Follow the result set.
  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, center.lat, center.lng]);

  // Highlight the active pin.
  useEffect(() => {
    markers.current.forEach(({ button, marker }, id) => {
      const on = id === activeId;
      button.className = `${PIN_BASE} ${on ? PIN_ON : PIN_OFF}`;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      marker.getElement().style.zIndex = on ? "2" : "1";
    });
  }, [activeId, pinsKey]);

  return (
    <div
      ref={el}
      role="region"
      aria-label={t.search.mapLabel}
      className={className}
      style={{ background: "var(--bg-secondary)" }}
    />
  );
}

export default ResultsMap;
