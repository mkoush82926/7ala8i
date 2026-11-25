// ═══════════════════════════════════════════════════════
// WS-1H · branded booking links (/{locale}/b/{slug}), channel attribution,
// share snippets and the booking-link theme. Pure helpers; no React.
// SQL mirrors: link_channel(), booking_source_category(),
// booking_link_theme_valid() in 20250101002710_links.sql.
// ═══════════════════════════════════════════════════════

/** Channels the owner can tag a link with (`?src=`). */
export const LINK_SOURCES = ["ig", "fb", "wa", "qr", "web", "google", "tiktok", "link"] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

/** Every value link_channel() can return. */
export const LINK_CHANNELS = [...LINK_SOURCES, "direct", "other"] as const;
export type LinkChannel = (typeof LINK_CHANNELS)[number];

/** `?entry=` written by every branded link (booking_attribution.entry). */
export const LINK_ENTRY = "link";

/** Same token rule as the booking API / booking_attribution CHECK. */
const TOKEN_RE = /^[a-z0-9_.:-]{1,40}$/;

export function normalizeToken(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return TOKEN_RE.test(v) ? v : null;
}

/** Mirror of SQL link_channel(text). */
export function linkChannel(raw: string | null | undefined): LinkChannel {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "direct";
  if (/^(ig|insta)/.test(v)) return "ig";
  if (/^(fb|facebook|meta)/.test(v)) return "fb";
  if (/^(wa|whatsapp)/.test(v)) return "wa";
  if (/^qr/.test(v)) return "qr";
  if (/^(web|website|site|embed)/.test(v)) return "web";
  if (/^(google|gmb|gbp|maps)/.test(v)) return "google";
  if (/^(tiktok|tt$)/.test(v)) return "tiktok";
  if (v === "link" || v === "bio" || v === "share") return "link";
  return "other";
}

/** Mirror of SQL booking_source_category(text): the appointments.source value. */
export function bookingSourceCategory(raw: string | null | undefined): string {
  const v = (raw ?? "").toLowerCase();
  if (!v) return "online";
  const known = ["online", "instagram", "google", "word_of_mouth", "walk_in", "whatsapp", "other", "qr", "facebook", "website"];
  if (known.includes(v)) return v;
  if (/^(ig|insta)/.test(v)) return "instagram";
  if (/^(wa|whatsapp)/.test(v)) return "whatsapp";
  if (/^(google|gmb|gbp|maps)/.test(v)) return "google";
  if (/^qr/.test(v)) return "qr";
  if (/^(fb|facebook|meta)/.test(v)) return "facebook";
  if (/^(web|website|site|embed)/.test(v)) return "website";
  return "online";
}

// ─── Link building ─────────────────────────────────────────────────────────

export interface LinkShop {
  id: string;
  slug?: string | null;
  slug_ar?: string | null;
}

/** Path segment: Arabic slug on /ar when there is one, else the Latin slug, else the id. */
export function linkSegment(shop: LinkShop, locale: string): string {
  if (locale === "ar" && shop.slug_ar) return shop.slug_ar;
  return shop.slug || shop.id;
}

export function trimOrigin(origin: string | null | undefined): string {
  return (origin ?? "").trim().replace(/\/+$/, "");
}

/**
 * Branded booking link. `src` is the channel tag; `entry` defaults to "link"
 * so the booking is attributed to the branded page.
 *   brandedLink({origin, locale:"ar", shop, src:"qr"}) → https://x/ar/b/slug?src=qr&entry=link
 */
export function brandedLink({
  origin,
  locale,
  shop,
  src,
  entry = LINK_ENTRY,
  embed = false,
}: {
  origin?: string | null;
  locale: string;
  shop: LinkShop;
  src?: LinkSource | string | null;
  entry?: string | null;
  embed?: boolean;
}): string {
  const loc = locale === "ar" ? "ar" : "en";
  const params = new URLSearchParams();
  const s = normalizeToken(src ?? null);
  const e = normalizeToken(entry ?? null);
  if (s) params.set("src", s);
  if (e) params.set("entry", e);
  if (embed) params.set("embed", "1");
  const qs = params.toString();
  return `${trimOrigin(origin)}/${loc}/b/${encodeURIComponent(linkSegment(shop, loc))}${qs ? `?${qs}` : ""}`;
}

/** Query string to forward to the booking engine (only the params it reads). */
export const FORWARDED_PARAMS = ["service", "services", "staff", "barber", "src", "entry", "embed", "lang"] as const;

export function forwardQuery(search: Record<string, string | string[] | undefined> | null | undefined): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) {
    const raw = search?.[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v === "string" && v.length > 0 && v.length <= 400) params.set(key, v);
  }
  return params;
}

/**
 * The branded page always books with entry=link (so the funnel can tell it
 * apart from the marketplace). Returns the query to redirect to, or null when
 * the current query is already complete.
 */
export function ensureLinkEntry(
  search: Record<string, string | string[] | undefined> | null | undefined,
): string | null {
  const params = forwardQuery(search);
  if (normalizeToken(params.get("entry"))) return null;
  params.set("entry", LINK_ENTRY);
  return params.toString();
}

// ─── Theme ────────────────────────────────────────────────────────────────

export const LINK_ACCENTS = ["ink", "brass", "paper"] as const;
export type LinkAccent = (typeof LINK_ACCENTS)[number];
export const WELCOME_MAX = 160;

export interface BookingLinkTheme {
  accent: LinkAccent;
  show_cover: boolean;
  show_logo: boolean;
  welcome_en: string | null;
  welcome_ar: string | null;
}

export const DEFAULT_LINK_THEME: BookingLinkTheme = {
  accent: "ink",
  show_cover: true,
  show_logo: true,
  welcome_en: null,
  welcome_ar: null,
};

function cleanWelcome(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, WELCOME_MAX);
  return s || null;
}

/** Tolerant read of shops.booking_link_theme (any shape → a full theme). */
export function parseLinkTheme(raw: unknown): BookingLinkTheme {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    accent: (LINK_ACCENTS as readonly unknown[]).includes(o.accent) ? (o.accent as LinkAccent) : DEFAULT_LINK_THEME.accent,
    show_cover: typeof o.show_cover === "boolean" ? o.show_cover : DEFAULT_LINK_THEME.show_cover,
    show_logo: typeof o.show_logo === "boolean" ? o.show_logo : DEFAULT_LINK_THEME.show_logo,
    welcome_en: cleanWelcome(o.welcome_en),
    welcome_ar: cleanWelcome(o.welcome_ar),
  };
}

/** Payload for the shops.booking_link_theme column (passes booking_link_theme_valid). */
export function serializeLinkTheme(theme: BookingLinkTheme): Record<string, unknown> {
  const t = parseLinkTheme(theme);
  return {
    accent: t.accent,
    show_cover: t.show_cover,
    show_logo: t.show_logo,
    welcome_en: t.welcome_en,
    welcome_ar: t.welcome_ar,
  };
}

/** Welcome line for a locale, falling back to the other language. */
export function welcomeFor(theme: BookingLinkTheme, locale: string): string | null {
  return locale === "ar" ? theme.welcome_ar || theme.welcome_en : theme.welcome_en || theme.welcome_ar;
}

// ─── Snippets ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Ink & Brass button for any website (inline styles: no stylesheet needed). */
export function buttonSnippet(url: string, label: string, accent: LinkAccent = "ink", dir: "ltr" | "rtl" = "ltr"): string {
  const bg = accent === "brass" ? "#7c5a26" : accent === "paper" ? "#ffffff" : "#1c1611";
  const fg = accent === "paper" ? "#1c1611" : "#ffffff";
  const border = accent === "paper" ? "#1c1611" : bg;
  return [
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" dir="${dir}"`,
    `   style="display:inline-block;padding:14px 28px;border-radius:8px;border:2px solid ${border};`,
    `          background:${bg};color:${fg};font:700 16px/1.2 system-ui,sans-serif;text-decoration:none">`,
    `  ${escapeHtml(label)}`,
    `</a>`,
  ].join("\n");
}

/** Booking flow inside the shop's own website (requires framing of /b/* — see handoff). */
export function embedSnippet(url: string, title: string, height = 760): string {
  const h = Math.max(480, Math.min(1400, Math.round(height)));
  return [
    `<iframe src="${escapeHtml(url)}" title="${escapeHtml(title)}"`,
    `        style="width:100%;max-width:760px;height:${h}px;border:0;border-radius:12px"`,
    `        loading="lazy" allow="clipboard-write"></iframe>`,
  ].join("\n");
}

/** wa.me link with prefilled text (no recipient: the owner picks the chat). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Fills {name} / {link} in a template string. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// ─── Posters ──────────────────────────────────────────────────────────────

export const POSTER_SIZES = ["a4", "a5"] as const;
export type PosterSize = (typeof POSTER_SIZES)[number];
export const POSTER_LANGS = ["both", "ar", "en"] as const;
export type PosterLang = (typeof POSTER_LANGS)[number];

/** Paper size in millimetres (portrait). */
export const POSTER_MM: Record<PosterSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a5: { w: 148, h: 210 },
};

/** Pixel size for the PNG at a given DPI (default 150 dpi: crisp, < 2 MB). */
export function posterPixels(size: PosterSize, dpi = 150): { w: number; h: number } {
  const mm = POSTER_MM[size];
  return { w: Math.round((mm.w / 25.4) * dpi), h: Math.round((mm.h / 25.4) * dpi) };
}

export function posterFileName(slug: string, size: PosterSize, lang: PosterLang): string {
  const safe = slug.normalize("NFKD").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `halaqy-${safe || "shop"}-qr-${size}-${lang}.png`;
}

/** URL without the protocol, for printing under the QR. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
}

// ─── Funnel ───────────────────────────────────────────────────────────────

export interface LinkStatRow {
  channel: string;
  visits: number;
  bookings: number;
  completed: number;
}

export interface LinkFunnel {
  rows: (LinkStatRow & { channel: LinkChannel; conversion: number | null })[];
  totals: LinkStatRow & { conversion: number | null };
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Normalises get_link_stats() rows (bigint may arrive as string) and adds conversion. */
export function buildFunnel(raw: unknown): LinkFunnel {
  const merged = new Map<LinkChannel, LinkStatRow>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const row = (r ?? {}) as Record<string, unknown>;
    const rawChannel = typeof row.channel === "string" ? row.channel : null;
    const channel = (LINK_CHANNELS as readonly (string | null)[]).includes(rawChannel)
      ? (rawChannel as LinkChannel)
      : linkChannel(rawChannel);
    const prev = merged.get(channel) ?? { channel, visits: 0, bookings: 0, completed: 0 };
    prev.visits += num(row.visits);
    prev.bookings += num(row.bookings);
    prev.completed += num(row.completed);
    merged.set(channel, prev);
  }
  const conv = (b: number, v: number) => (v > 0 ? Math.min(1, b / v) : null);
  const rows = [...merged.values()]
    .map((r) => ({ ...r, channel: r.channel as LinkChannel, conversion: conv(r.bookings, r.visits) }))
    .sort((a, b) => b.visits - a.visits || b.bookings - a.bookings || a.channel.localeCompare(b.channel));
  const totals = rows.reduce(
    (acc, r) => ({ ...acc, visits: acc.visits + r.visits, bookings: acc.bookings + r.bookings, completed: acc.completed + r.completed }),
    { channel: "all", visits: 0, bookings: 0, completed: 0 } as LinkStatRow,
  );
  return { rows, totals: { ...totals, conversion: conv(totals.bookings, totals.visits) } };
}

/** sessionStorage key so one visitor counts once per tab session and channel. */
export function visitKey(shopId: string, src: string | null): string {
  return `halaqy:lv:${shopId}:${linkChannel(src)}`;
}
