"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useModalBehavior } from "@/components/ui/dialog";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { ShopImage } from "./shop-image";

export interface LightboxImage {
  id: string;
  url: string;
  alt: string;
  caption?: string | null;
  blurData?: string | null;
}

/**
 * Full-screen image viewer: arrow keys (mirrored in RTL), swipe, 1/N counter,
 * focus trap and Escape via the shared modal behaviour.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  label,
}: {
  images: readonly LightboxImage[];
  /** Open image index, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  label?: string;
}) {
  const { t, isRTL, formatLocalNumber: formatNumber } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const open = index !== null && images.length > 0;
  const [touchX, setTouchX] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Portal target exists only after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useModalBehavior({ open, onClose, containerRef: panelRef });

  const total = images.length;
  const go = useCallback(
    (delta: number) => {
      if (index === null || total === 0) return;
      onIndexChange((index + delta + total) % total);
    },
    [index, total, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(isRTL ? -1 : 1);
      else if (e.key === "ArrowLeft") go(isRTL ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, isRTL]);

  if (!open || !mounted || index === null) return null;
  const image = images[Math.min(index, total - 1)];
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const counter = interpolate(t.shopProfile.photoCounter, { current: formatNumber(index + 1), total: formatNumber(total) });

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 text-white outline-none"
      dir={isRTL ? "rtl" : "ltr"}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
        setTouchX(null);
        if (Math.abs(dx) < 40) return;
        // Swipe left = next in LTR, previous in RTL.
        go(dx < 0 ? (isRTL ? -1 : 1) : isRTL ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 h-14 shrink-0">
        <h2 id={titleId} className="text-sm font-semibold tabular-nums">
          <span className="sr-only">{label ?? t.shopProfile.lightboxLabel}: </span>
          {counter}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.shopProfile.closeViewer}
          className="focus-ring w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <ShopImage
          key={image.id}
          src={image.url}
          blurData={image.blurData}
          alt={image.alt}
          fill
          sizes="100vw"
          className="object-contain"
          priority
        />
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t.shopProfile.previousPhoto}
              className="focus-ring absolute start-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              <PrevIcon size={24} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t.shopProfile.nextPhoto}
              className="focus-ring absolute end-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              <NextIcon size={24} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <p className="min-h-12 px-4 py-3 text-center text-sm text-white/85" aria-live="polite">
        {image.caption || image.alt}
      </p>
    </div>,
    document.body,
  );
}

export default Lightbox;
