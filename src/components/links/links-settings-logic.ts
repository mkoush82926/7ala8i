// Pure helpers for /settings/links (no React).

import { brandedLink, trimOrigin, type LinkShop, type LinkSource } from "./link-utils";

export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** Channels listed with their own tagged link (qr has the poster section). */
export const CHANNEL_ROWS: readonly LinkSource[] = ["ig", "fb", "wa", "web", "google", "tiktok"];

export function channelLinks(origin: string, locale: string, shop: LinkShop): { src: LinkSource; url: string }[] {
  return CHANNEL_ROWS.map((src) => ({ src, url: brandedLink({ origin, locale, shop, src }) }));
}

/**
 * Origin printed in links and posters: the configured public site URL when it
 * is a valid http(s) URL, else the dashboard's own origin.
 */
export function linkSiteOrigin(configured: string | null | undefined, fallback: string): string {
  const raw = (configured ?? "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || u.protocol === "http:") return trimOrigin(u.origin);
    } catch {
      // fall through
    }
  }
  return trimOrigin(fallback);
}
