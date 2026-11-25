"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn, nameInitials } from "@/lib/utils";
import { photoScrimClasses } from "./recipes";

/**
 * Image-led media frame (§4): fixed aspect box, next/image `fill` +
 * object-cover, 200ms fade-in on load (none under reduced motion), and a
 * branded placeholder — never a grey box — when there is no photo or it
 * fails to load.
 *
 *   <PhotoFrame src={shop.cover_url} alt={shop.name} ratio="4/3" fallbackName={shop.name}
 *               seed={shop.id} sizes={SHOP_CARD_SIZES} hoverZoom rounded="none">
 *     <div className="absolute top-3 start-3"><Pill tone="on-photo">…</Pill></div>
 *   </PhotoFrame>
 *   <PhotoFrame src={null} alt="" ratio="1/1" fallbackName="Ahmad Saleh" rounded="full" />
 *
 * Children render on top of the image (badges, buttons, counters).
 */
export const PHOTO_RATIOS = {
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "1/1": "aspect-square",
  "4/5": "aspect-[4/5]",
  "16/9": "aspect-video",
  "3/1": "aspect-[3/1]",
} as const;
export type PhotoRatio = keyof typeof PHOTO_RATIOS;

/** `sizes` for shop-card media in grids/rails. */
export const SHOP_CARD_SIZES = "(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw";

export interface PlaceholderFill {
  key: "teal" | "sand" | "ink" | "amber";
  /** CSS background (gradient). */
  bg: string;
  /** Initials colour (AA on the fill). */
  fg: string;
  /** Sand-stripe hatch colour suited to the fill. */
  hatch: string;
}

/**
 * The four branded placeholder fills (§4). Brand art, not surfaces: the same
 * in light and dark. Hexes also usable by canvas/PNG code.
 */
export const PLACEHOLDER_FILLS: readonly PlaceholderFill[] = [
  { key: "teal", bg: "linear-gradient(135deg,#0F766E 0%,#134E4A 100%)", fg: "#FFFFFF", hatch: "rgb(255 255 255 / 0.06)" },
  { key: "sand", bg: "linear-gradient(135deg,#F1EFEA 0%,#E7E4DD 100%)", fg: "#115E59", hatch: "rgb(15 23 42 / 0.04)" },
  { key: "ink", bg: "linear-gradient(135deg,#1E293B 0%,#0F172A 100%)", fg: "#F8F7F4", hatch: "rgb(255 255 255 / 0.06)" },
  { key: "amber", bg: "linear-gradient(135deg,#FEF3C7 0%,#FDE68A 100%)", fg: "#92400E", hatch: "rgb(15 23 42 / 0.04)" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic fill: same seed (shop/barber id) → same placeholder everywhere. */
export function placeholderFill(seed: string | null | undefined): PlaceholderFill {
  return PLACEHOLDER_FILLS[hashString(seed || "") % PLACEHOLDER_FILLS.length];
}

/** Up to two letter initials: "The Gentleman's Chair" → "GC", "Mohammad (Mo)" → "MM". */
export function placeholderInitials(name: string | null | undefined): string {
  return nameInitials(name, "·");
}

export interface BrandedPlaceholderProps {
  /** Name the initials come from. */
  name?: string | null;
  /** Seed for the fill (defaults to name). */
  seed?: string | null;
  /** Force a fill instead of hashing. */
  fill?: PlaceholderFill["key"];
  /** Hide initials (pure motif, e.g. banners). */
  hideInitials?: boolean;
  className?: string;
  initialsClassName?: string;
}

/** Fills its (positioned) parent: gradient + sand-stripe hatch + initials. */
export function BrandedPlaceholder({ name, seed, fill, hideInitials = false, className, initialsClassName }: BrandedPlaceholderProps) {
  const f = fill ? PLACEHOLDER_FILLS.find((p) => p.key === fill)! : placeholderFill(seed ?? name ?? "");
  return (
    <div
      aria-hidden="true"
      data-placeholder={f.key}
      className={cn("absolute inset-0 grid place-items-center select-none", className)}
      style={{
        backgroundColor: "#0F766E",
        backgroundImage: `repeating-linear-gradient(135deg, ${f.hatch} 0 2px, transparent 2px 12px), ${f.bg}`,
        color: f.fg,
      }}
    >
      {!hideInitials && (
        <span className={cn("text-[34px] leading-none font-extrabold tracking-tight rtl:tracking-normal md:text-[40px]", initialsClassName)}>
          {placeholderInitials(name)}
        </span>
      )}
    </div>
  );
}

const ROUNDED = {
  none: "",
  sm: "rounded-sm",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

export interface PhotoFrameProps {
  src?: string | null;
  /** Bilingual alt; "" for decorative images. */
  alt: string;
  /** Aspect ratio; "none" when the parent sizes the frame (e.g. mosaic cells). */
  ratio?: PhotoRatio | "none";
  /** Name for placeholder initials. */
  fallbackName?: string | null;
  /** Seed for the placeholder fill (shop / barber id). */
  seed?: string | null;
  sizes?: string;
  priority?: boolean;
  /** Override next/image optimisation (default: only Supabase storage + local paths are optimised). */
  unoptimized?: boolean;
  /** data:image/… blur placeholder. */
  blurDataURL?: string | null;
  rounded?: keyof typeof ROUNDED;
  /** Zoom the image 3% when a parent `.group` is hovered (shop cards). */
  hoverZoom?: boolean;
  /** Bottom scrim for text over the photo. */
  scrim?: boolean;
  /** Placeholder initials size override. */
  initialsClassName?: string;
  className?: string;
  imgClassName?: string;
  /** Overlays (absolutely positioned by the caller). */
  children?: React.ReactNode;
}

function canOptimize(src: string): boolean {
  return src.startsWith("/") || src.includes("/storage/v1/object/public/");
}

export function PhotoFrame({
  src,
  alt,
  ratio = "4/3",
  fallbackName,
  seed,
  sizes = "100vw",
  priority = false,
  unoptimized,
  blurDataURL,
  rounded = "none",
  hoverZoom = false,
  scrim = false,
  initialsClassName,
  className,
  imgClassName,
  children,
}: PhotoFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = (src ?? "").trim();
  const showImage = url !== "" && failedSrc !== url;
  const blur = blurDataURL && blurDataURL.startsWith("data:image/") ? blurDataURL : null;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-sunken",
        ratio !== "none" && PHOTO_RATIOS[ratio],
        ROUNDED[rounded],
        className,
      )}
    >
      {showImage ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          unoptimized={unoptimized ?? !canOptimize(url)}
          placeholder={blur ? "blur" : "empty"}
          blurDataURL={blur ?? undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailedSrc(url)}
          className={cn(
            "object-cover transition-[opacity,transform] duration-200 ease-standard motion-reduce:transition-none",
            loaded || blur ? "opacity-100" : "opacity-0 motion-reduce:opacity-100",
            hoverZoom && "duration-500 group-hover:scale-[1.03] motion-reduce:transform-none",
            imgClassName,
          )}
        />
      ) : (
        <>
          <BrandedPlaceholder name={fallbackName} seed={seed ?? fallbackName} initialsClassName={initialsClassName} />
          {alt ? (
            <span role="img" aria-label={alt} className="absolute inset-0" />
          ) : null}
        </>
      )}
      {scrim && <div aria-hidden="true" className={photoScrimClasses} />}
      {children}
    </div>
  );
}

export default PhotoFrame;
