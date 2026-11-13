"use client";

import React, { useRef, useState } from "react";
import { Images } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { localizedText } from "./lib/media";
import type { ShopPhoto } from "./lib/types";
import { ShopImage } from "./shop-image";
import { Lightbox, type LightboxImage } from "./lightbox";

/**
 * Shop photos: a 16:9 swipe carousel with a 1/N counter on mobile, a mosaic
 * (one large + up to four small) on desktop, and a shared lightbox.
 * Renders nothing without photos (the page shows its initials cover).
 */
export function PhotoGallery({ photos, shopName, className }: { photos: readonly ShopPhoto[]; shopName: string; className?: string }) {
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

  const mosaic = images.slice(0, 5);

  return (
    <section aria-label={interpolate(t.shopProfile.galleryLabel, { name: shopName })} className={className}>
      {/* Mobile carousel */}
      <div className="relative md:hidden">
        <ul
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          aria-roledescription="carousel"
        >
          {images.map((img, i) => (
            <li key={img.id} className="relative w-full shrink-0 snap-center aspect-video bg-[var(--bg-secondary)]">
              <button
                type="button"
                className="focus-ring absolute inset-0"
                onClick={() => setOpen(i)}
                aria-label={`${img.alt} (${interpolate(t.shopProfile.photoCounter, { current: formatNumber(i + 1), total: formatNumber(total) })})`}
              >
                <ShopImage src={img.url} blurData={img.blurData} alt="" fill sizes="100vw" className="object-cover" priority={i === 0} />
              </button>
            </li>
          ))}
        </ul>
        {total > 1 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white tabular-nums"
          >
            {counter}
          </span>
        )}
      </div>

      {/* Desktop mosaic */}
      <div
        className={cn(
          "hidden md:grid gap-2 rounded-[12px] overflow-hidden relative",
          mosaic.length === 1 ? "grid-cols-1" : "grid-cols-4 grid-rows-2",
        )}
        style={{ aspectRatio: mosaic.length === 1 ? "16 / 9" : "32 / 11" }}
      >
        {mosaic.map((img, i) => {
          const big = i === 0;
          const span = mosaicSpan(mosaic.length, i);
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={img.alt}
              className={cn("focus-ring relative bg-[var(--bg-secondary)] group overflow-hidden", span)}
            >
              <ShopImage
                src={img.url}
                blurData={img.blurData}
                alt=""
                fill
                sizes={big ? "(min-width: 1024px) 576px, 50vw" : "(min-width: 1024px) 288px, 25vw"}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                priority={big}
              />
            </button>
          );
        })}
        {total > 1 && (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="focus-ring absolute bottom-3 end-3 inline-flex items-center gap-2 rounded-full bg-[var(--bg-elevated)] px-4 h-9 text-sm font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-sm"
          >
            <Images size={16} aria-hidden="true" />
            {t.shopProfile.showAllPhotos}
            <span className="text-[var(--text-secondary)] tabular-nums">({formatNumber(total)})</span>
          </button>
        )}
      </div>

      <Lightbox images={images} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </section>
  );
}

/** Grid placement for the 4×2 desktop mosaic. */
export function mosaicSpan(count: number, i: number): string {
  if (count <= 1) return "";
  if (i === 0 || count === 2) return "col-span-2 row-span-2";
  if (count === 3 || (count === 4 && i === 3)) return "col-span-2 row-span-1";
  return "col-span-1 row-span-1";
}

export default PhotoGallery;
