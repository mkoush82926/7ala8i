"use client";

import React, { useRef, useState } from "react";
import { Images } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { onPhotoChipClasses, focusRing, pressable } from "@/components/ui/recipes";
import { localizedText } from "./lib/media";
import type { ShopPhoto } from "./lib/types";
import { ShopImage } from "./shop-image";
import { Lightbox, type LightboxImage } from "./lightbox";

/**
 * Shop photos (§4 / §6.3): a full-bleed 4:3 swipe carousel with a 1/N
 * counter on mobile, a 2fr/1fr mosaic (one large + two stacked) on desktop
 * with "Show all photos (N)", and a shared lightbox. `mobileOverlay` sits on
 * top of the mobile carousel (back / share round buttons on the photo).
 * Renders nothing without photos (the page shows its branded cover).
 */
export function PhotoGallery({
  photos,
  shopName,
  className,
  mobileOverlay,
}: {
  photos: readonly ShopPhoto[];
  shopName: string;
  className?: string;
  mobileOverlay?: React.ReactNode;
}) {
  const { t, locale, formatNumber } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLUListElement>(null);

  if (photos.length === 0) return null;

  const images: LightboxImage[] = photos.map((p, i) => ({
    id: p.id,
    url: p.url,
    blurData: p.blur_data,
    alt: localizedText(locale, p.alt_en, p.alt_ar, interpolate(t.shopProfile.photoAlt, { name: shopName, n: i + 1 })),
  }));
  const total = images.length;
  const counter = interpolate(t.shopProfile.photoCounter, { current: formatNumber(current + 1), total: formatNumber(total) });

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth || 1;
    // scrollLeft is negative in RTL (Chrome/Firefox/Safari today).
    const idx = Math.round(Math.abs(track.scrollLeft) / width);
    if (idx !== current) setCurrent(Math.min(total - 1, Math.max(0, idx)));
  };

  const mosaic = images.slice(0, 3);

  return (
    <section aria-label={interpolate(t.shopProfile.galleryLabel, { name: shopName })} className={className}>
      {/* Mobile: full-bleed 4:3 carousel */}
      <div className="relative md:hidden">
        <ul
          ref={trackRef}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          aria-roledescription="carousel"
        >
          {images.map((img, i) => (
            <li key={img.id} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-sunken">
              <button
                type="button"
                className="focus-ring-inset absolute inset-0"
                onClick={() => setOpen(i)}
                aria-label={`${img.alt} (${interpolate(t.shopProfile.photoCounter, { current: formatNumber(i + 1), total: formatNumber(total) })})`}
              >
                <ShopImage src={img.url} blurData={img.blurData} alt="" fill sizes="100vw" className="object-cover" priority={i === 0} />
              </button>
            </li>
          ))}
        </ul>
        {/* Top scrim keeps the on-photo buttons legible on bright photos. */}
        {mobileOverlay && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(11_21_20/0.35)] to-transparent" />
        )}
        {mobileOverlay}
        {total > 1 && (
          <span aria-hidden="true" className={cn(onPhotoChipClasses, "pointer-events-none absolute bottom-3 end-3 tabular-nums")}>
            <Images className="size-3.5" aria-hidden="true" />
            {counter}
          </span>
        )}
      </div>

      {/* Desktop: mosaic */}
      <div
        className={cn(
          "relative hidden h-[440px] gap-2 overflow-hidden rounded-2xl md:grid",
          mosaic.length === 1 ? "grid-cols-1" : "grid-cols-[2fr_1fr] grid-rows-2",
        )}
      >
        {mosaic.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={img.alt}
            className={cn("focus-ring-inset group relative overflow-hidden bg-sunken", mosaicSpan(mosaic.length, i))}
          >
            <ShopImage
              src={img.url}
              blurData={img.blurData}
              alt=""
              fill
              sizes={i === 0 ? "(min-width: 1280px) 800px, 66vw" : "(min-width: 1280px) 400px, 33vw"}
              className="object-cover transition-transform duration-500 ease-standard group-hover:scale-[1.03] motion-reduce:transform-none"
              priority={i === 0}
            />
            <span aria-hidden="true" className="absolute inset-0 bg-ink/0 transition-colors duration-200 group-hover:bg-ink/10" />
          </button>
        ))}
        {total > 1 && (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className={cn(
              "absolute bottom-4 end-4 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-raised hover:bg-sunken",
              focusRing,
              pressable,
            )}
          >
            <Images className="size-4" aria-hidden="true" />
            {t.shopProfile.showAllPhotos}
            <span className="tabular-nums text-ink-muted">({formatNumber(total)})</span>
          </button>
        )}
      </div>

      <Lightbox images={images} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </section>
  );
}

/** Grid placement for the 2fr/1fr × 2-row desktop mosaic. */
export function mosaicSpan(count: number, i: number): string {
  if (count <= 1) return "";
  if (i === 0) return "row-span-2";
  if (count === 2) return "row-span-2";
  return "row-span-1";
}

export default PhotoGallery;
