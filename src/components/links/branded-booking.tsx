"use client";

import React, { Suspense } from "react";
import { Languages, MapPin, MessageCircle, Phone } from "lucide-react";
import { BookingEngine } from "@/components/booking/booking-engine";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { buildWaLink } from "@/lib/messaging-stub";
import { cn } from "@/lib/utils";
import type { PublicBookingSecurity } from "@/lib/otp/config";
import { LinkVisitBeacon } from "./link-visit-beacon";
import { welcomeFor, type LinkAccent } from "./link-utils";
import { shopDisplayName, shopLandmark, type BrandedShop } from "./branded-shop";

const ACCENT_CLASS: Record<LinkAccent, string> = {
  ink: "bg-inverse text-on-inverse",
  brass: "bg-brand text-on-brand",
  paper: "bg-card text-ink border-b border-line",
};

const ICON_BUTTON =
  "focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-150";

function iconButtonTone(accent: LinkAccent): string {
  return accent === "paper"
    ? "border-line bg-card text-ink hover:bg-sunken"
    : "border-white/25 bg-white/10 text-current hover:bg-white/20";
}

/**
 * Branded booking page for /{locale}/b/{slug}: the shop's own header and the
 * 1D booking engine, with no marketplace chrome, search or other shops.
 * `embed` (?embed=1) drops the header for the website iframe.
 */
export function BrandedBooking({
  shop,
  security,
  src,
  entry,
  embed = false,
  altLocaleHref,
}: {
  shop: BrandedShop;
  security?: PublicBookingSecurity;
  src: string | null;
  entry: string | null;
  embed?: boolean;
  altLocaleHref: string;
}) {
  const { t, locale, dir, FF, FFD, href } = useTranslation();
  const tl = t.links;
  const pageKey = (locale === "ar" ? shop.slug_ar || shop.slug : shop.slug) || shop.id;
  const brandedHref = href(`/b/${encodeURIComponent(pageKey)}`);
  const theme = shop.theme;
  const name = shopDisplayName(shop, locale);
  const landmark = shopLandmark(shop, locale);
  const welcome = welcomeFor(theme, locale);
  const waNumber = shop.whatsapp || shop.phone;
  const waHref = waNumber ? buildWaLink(waNumber, interpolate(tl.page.whatsappText, { name })) : null;
  const telHref = shop.phone ? `tel:${shop.phone.replace(/[^\d+]/g, "")}` : null;
  const cover = theme.show_cover ? shop.cover_url : null;
  const logo = theme.show_logo ? shop.logo_url : null;
  const initial = Array.from(name.trim())[0] ?? "";

  const engine = (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" aria-label={t.common.loading}>
          <Skeleton variant="text" style={{ height: 14, width: 120, marginBottom: 12 }} />
          <Skeleton variant="text" style={{ height: 32, width: "60%", marginBottom: 24 }} />
          <Skeleton variant="card" style={{ height: 240, width: "100%" }} />
        </div>
      }
    >
      {/* The engine reads ?service(s)= ?staff= ?src= ?entry= from the URL. */}
      <BookingEngine shopId={shop.id} security={security} shopHref={brandedHref} />
    </Suspense>
  );

  if (embed) {
    return (
      <div dir={dir} className="min-h-dvh bg-card text-ink" style={{ fontFamily: FF }}>
        <LinkVisitBeacon shopId={shop.id} src={src} entry={entry} />
        <main id="booking-main" aria-label={interpolate(tl.page.bookAt, { name })} className="mx-auto w-full max-w-[760px] px-4 py-4">
          {engine}
        </main>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-dvh bg-page text-ink" style={{ fontFamily: FF }}>
      <LinkVisitBeacon shopId={shop.id} src={src} entry={entry} />
      <a href="#booking-main" className="skip-link">{t.booking.skipToBooking}</a>

      <header className={cn("relative", ACCENT_CLASS[theme.accent])}>
        {cover && (
          <div className="mx-auto w-full max-w-[760px] sm:px-4 sm:pt-4">
            <div className="relative aspect-[16/9] max-h-[260px] w-full overflow-hidden bg-sunken sm:rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- any https cover URL, sized by CSS */}
              <img src={cover} alt={interpolate(tl.page.coverAlt, { name })} className="size-full object-cover" fetchPriority="high" />
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[760px] items-start gap-3 px-4 py-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small logo, any https URL
            <img
              src={logo}
              alt={interpolate(tl.page.logoAlt, { name })}
              className={cn("size-14 shrink-0 rounded-xl border-2 border-card bg-card object-cover shadow-xs", cover && "-mt-10")}
            />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold",
                theme.accent === "paper" ? "bg-inverse text-on-inverse" : "bg-white/15 text-current",
                cover && "-mt-10 border-2 border-card",
              )}
            >
              {initial}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs font-semibold opacity-80">{tl.page.eyebrow}</p>
            <h1 className="text-h2 m-0 truncate" style={{ fontFamily: FFD }}>
              {name}
            </h1>
            {landmark && (
              <p className="m-0 mt-0.5 flex items-center gap-1 truncate text-sm opacity-85">
                <MapPin size={14} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{landmark}</span>
              </p>
            )}
          </div>

          <nav aria-label={tl.page.contactNav} className="flex shrink-0 items-center gap-2">
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label={tl.page.whatsappShop}
                className={cn(ICON_BUTTON, iconButtonTone(theme.accent))}>
                <MessageCircle size={18} aria-hidden="true" />
              </a>
            )}
            {telHref && (
              <a href={telHref} aria-label={tl.page.callShop} className={cn(ICON_BUTTON, iconButtonTone(theme.accent))}>
                <Phone size={18} aria-hidden="true" />
              </a>
            )}
            <a href={altLocaleHref} hrefLang={locale === "ar" ? "en" : "ar"} lang={locale === "ar" ? "en" : "ar"}
              aria-label={tl.page.switchLanguage}
              className={cn(ICON_BUTTON, "w-auto gap-1.5 px-4 text-sm font-semibold", iconButtonTone(theme.accent))}>
              <Languages size={16} aria-hidden="true" />
              <span>{tl.page.otherLanguage}</span>
            </a>
          </nav>
        </div>

        {welcome && (
          <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
            <p className="m-0 text-sm leading-relaxed opacity-90">{welcome}</p>
          </div>
        )}
      </header>

      <main id="booking-main" aria-label={interpolate(tl.page.bookAt, { name })} className="pb-10 pt-6">
        <div className="mx-auto w-full max-w-[760px] px-4">{engine}</div>
      </main>

      <footer className="mx-auto w-full max-w-[760px] border-t border-line px-4 py-6 text-center text-[13px] text-ink-muted">
        {tl.page.poweredBy}
      </footer>
    </div>
  );
}
