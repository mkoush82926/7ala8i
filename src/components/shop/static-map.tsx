"use client";

import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { googleMapsDirectionsUrl, tileSource, tilesForViewport, TILE_SIZE, wazeUrl } from "./lib/map";

/** Virtual canvas; the container crops it around the centred pin. */
const CANVAS_W = 768;
const CANVAS_H = 320;

/**
 * Static OSM/MapTiler tile map with a centred pin (no map library, no JS
 * work after render). Map geometry is physical (maps do not mirror in RTL);
 * the controls around it use logical properties.
 */
export function StaticMap({
  lat,
  lng,
  label,
  zoom = 16,
  className,
}: {
  lat: number;
  lng: number;
  label: string;
  zoom?: number;
  className?: string;
}) {
  const source = tileSource(process.env.NEXT_PUBLIC_MAPTILER_KEY);
  const tiles = tilesForViewport({ lat, lng }, zoom, CANVAS_W, CANVAS_H);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative h-48 sm:h-56 overflow-hidden rounded-[12px] bg-[var(--bg-secondary)] isolate", className)}
      dir="ltr"
    >
      <div aria-hidden="true" className="absolute top-1/2" style={{ left: "50%", width: CANVAS_W, height: CANVAS_H, transform: "translate(-50%, -50%)" }}>
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={source.url(tile)}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
      </div>
      <span aria-hidden="true" className="absolute top-1/2 -translate-x-1/2 -translate-y-full" style={{ left: "50%" }}>
        <MapPin size={40} strokeWidth={2} className="drop-shadow-md" style={{ color: "var(--cta-bg)", fill: "var(--bg-elevated)" }} />
      </span>
      <a
        href={source.attributionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 end-0 bg-white/85 px-1.5 py-0.5 text-[10px] text-[#3a332b] rounded-ss-[6px]"
      >
        {source.attribution}
      </a>
    </div>
  );
}

/** Location block: map (when pinned), address, landmark and deep links. */
export function LocationCard({
  name,
  lat,
  lng,
  address,
  landmark,
  placeLine,
  googleMapsUrl,
  headingId,
}: {
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  landmark: string | null;
  /** "Khalda, Amman" */
  placeLine: string | null;
  googleMapsUrl: string | null;
  headingId: string;
}) {
  const { t } = useTranslation();
  const point = lat != null && lng != null ? { lat, lng } : null;
  const ownMaps = googleMapsUrl && /^https?:\/\//i.test(googleMapsUrl) ? googleMapsUrl : null;
  const gmaps = ownMaps ?? googleMapsDirectionsUrl(point, [address, placeLine].filter(Boolean).join(", "));
  const waze = wazeUrl(point);
  if (!point && !address && !placeLine) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-xl font-black text-[var(--text-primary)]">
        {t.shopProfile.location}
      </h2>
      {point && <StaticMap lat={point.lat} lng={point.lng} label={interpolate(t.shopProfile.mapLabel, { name })} />}
      <div className="space-y-1.5 text-sm">
        {(address || placeLine) && (
          <p className="flex items-start gap-2 font-semibold text-[var(--text-primary)]">
            <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
            <span>{[address, placeLine].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {landmark && (
          <p className="ps-6 text-[var(--text-secondary)]">
            <span className="font-semibold">{t.shopProfile.landmark}:</span> {landmark}
          </p>
        )}
      </div>
      {(gmaps || waze) && (
        <div className="flex flex-wrap gap-2">
          {gmaps && (
            <a
              href={gmaps}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] hover:border-[var(--accent-brass)]"
            >
              <Navigation size={16} aria-hidden="true" />
              {t.shopProfile.openInGoogleMaps}
            </a>
          )}
          {waze && (
            <a
              href={waze}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] hover:border-[var(--accent-brass)]"
            >
              <Navigation size={16} aria-hidden="true" />
              {t.shopProfile.openInWaze}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export default StaticMap;
