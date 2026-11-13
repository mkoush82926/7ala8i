"use client";

// Pin picker on MapLibre GL. Uses MapTiler when NEXT_PUBLIC_MAPTILER_KEY is
// set, otherwise OpenStreetMap raster tiles. If the map cannot load (tiles
// blocked, WebGL missing, offline) it reports onUnavailable and the step
// falls back to the area centre + landmark, which is enough to publish.

import { useEffect, useRef } from "react";
import type { Map as MlMap, MapMouseEvent, Marker as MlMarker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "@/hooks/use-translation";

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

function mapStyle(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
  return key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}` : OSM_STYLE;
}

export interface LocationMapProps {
  lat: number | null;
  lng: number | null;
  /** Where to centre when there is no pin yet. */
  fallback: { lat: number; lng: number; zoom: number };
  onChange: (lat: number, lng: number) => void;
  onUnavailable: () => void;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function LocationMap({ lat, lng, fallback, onChange, onUnavailable }: LocationMapProps) {
  const { t, isRTL } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<MlMarker | null>(null);
  const cb = useRef({ onChange, onUnavailable });
  cb.current = { onChange, onUnavailable };

  // Create once.
  useEffect(() => {
    let cancelled = false;
    let loadedTiles = false;
    let failTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        const start = lat !== null && lng !== null ? { lat, lng, zoom: 16 } : fallback;
        const m = new ml.Map({
          container: el.current,
          style: mapStyle(),
          center: [start.lng, start.lat],
          zoom: start.zoom,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), isRTL ? "top-left" : "top-right");

        const mk = new ml.Marker({ draggable: true, color: "#7c5a26" }).setLngLat([start.lng, start.lat]).addTo(m);
        mk.getElement().setAttribute("aria-label", t.start.location.pinLabel);
        marker.current = mk;
        mk.on("dragend", () => {
          const p = mk.getLngLat();
          cb.current.onChange(round6(p.lat), round6(p.lng));
        });
        m.on("click", (e: MapMouseEvent) => {
          mk.setLngLat(e.lngLat);
          cb.current.onChange(round6(e.lngLat.lat), round6(e.lngLat.lng));
        });
        m.on("data", (e: unknown) => {
          if ((e as { dataType?: string }).dataType === "source") loadedTiles = true;
        });
        m.on("error", () => {
          if (!loadedTiles) cb.current.onUnavailable();
        });
        failTimer = setTimeout(() => {
          if (!loadedTiles && !cancelled) cb.current.onUnavailable();
        }, 10000);
      } catch {
        if (!cancelled) cb.current.onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
      if (failTimer) clearTimeout(failTimer);
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external changes (area picked, "use my location").
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk) return;
    const target = lat !== null && lng !== null ? { lat, lng, zoom: 16 } : fallback;
    const cur = mk.getLngLat();
    if (Math.abs(cur.lat - target.lat) < 1e-6 && Math.abs(cur.lng - target.lng) < 1e-6) return;
    mk.setLngLat([target.lng, target.lat]);
    m.easeTo({ center: [target.lng, target.lat], zoom: Math.max(m.getZoom(), target.zoom) });
  }, [lat, lng, fallback]);

  return (
    <div
      ref={el}
      role="application"
      aria-label={t.start.location.mapLabel}
      className="h-[260px] w-full overflow-hidden rounded-[var(--radius-lg)] border sm:h-[320px]"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
    />
  );
}

export default LocationMap;
