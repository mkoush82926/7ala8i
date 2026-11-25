"use client";

import React, { useState } from "react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { buttonClasses } from "@/components/ui/recipes";
import { localizedText } from "./lib/media";
import type { BarberData, PortfolioItem, ServiceData } from "./lib/types";
import { ShopImage } from "./shop-image";
import { Lightbox, type LightboxImage } from "./lightbox";

/** Square (1:1) portfolio grid with a lightbox. Featured items come first. */
export function PortfolioGrid({
  items,
  barbers = [],
  services = [],
  limit = 9,
}: {
  items: readonly PortfolioItem[];
  barbers?: readonly Pick<BarberData, "id" | "full_name">[];
  services?: readonly Pick<ServiceData, "id" | "name" | "name_ar">[];
  limit?: number;
}) {
  const { t, locale, formatNumber } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const barberName = new Map(barbers.map((b) => [b.id, b.full_name]));
  const serviceName = new Map(services.map((s) => [s.id, (locale === "ar" && s.name_ar) || s.name]));
  const images: LightboxImage[] = items.map((item, i) => {
    const caption = localizedText(locale, item.caption, item.caption_ar, "");
    const by = item.barber_id ? barberName.get(item.barber_id) : null;
    const svc = item.service_id ? serviceName.get(item.service_id) : null;
    const parts = [caption || svc, by ? interpolate(t.shopProfile.portfolioBy, { name: by }) : null].filter(Boolean);
    return {
      id: item.id,
      url: item.url,
      blurData: item.blur_data,
      alt: parts.join(" · ") || interpolate(t.shopProfile.portfolioAlt, { n: i + 1 }),
      caption: parts.join(" · ") || null,
    };
  });
  const visible = expanded ? images : images.slice(0, limit);

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl sm:gap-2 sm:rounded-none">
        {visible.map((img, i) => (
          <li key={img.id} className="relative aspect-square overflow-hidden bg-sunken sm:rounded-lg">
            <button type="button" onClick={() => setOpen(i)} aria-label={img.alt} className="focus-ring-inset group absolute inset-0">
              <ShopImage
                src={img.url}
                blurData={img.blurData}
                alt=""
                fill
                sizes="(min-width: 1024px) 240px, 33vw"
                className="object-cover transition-transform duration-500 ease-standard group-hover:scale-[1.04] motion-reduce:transform-none"
              />
            </button>
          </li>
        ))}
      </ul>
      {!expanded && images.length > limit && (
        <div className="mt-5 flex justify-center">
          <button type="button" className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })} onClick={() => setExpanded(true)}>
            {interpolate(t.shopProfile.showAllWork, { count: formatNumber(images.length) })}
          </button>
        </div>
      )}
      <Lightbox images={images} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} label={t.shopProfile.portfolio} />
    </>
  );
}

export default PortfolioGrid;
