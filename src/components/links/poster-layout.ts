// ═══════════════════════════════════════════════════════
// WS-1H · QR poster layout. One pure description of the poster drives both
// the on-screen/print DOM preview (percentages + cqw) and the PNG canvas
// renderer, so the download and the printout always match.
//
// Units: the poster is POSTER_UNITS wide; its height follows the paper
// aspect ratio (A4 and A5 are both 1:√2). Every element is centred on the
// vertical axis, so the layout needs no left/right (and no RTL mirroring):
// only the text direction changes per language.
// ═══════════════════════════════════════════════════════

import { POSTER_MM, type PosterLang, type PosterSize } from "./link-utils";

export const POSTER_UNITS = 1000;

/** Fixed print colours (paper output, not themed): Ink & Brass. */
export const POSTER_COLORS = {
  paper: "#fbf7ef",
  ink: "#1c1611",
  brass: "#a67c3d",
  brassText: "#7c5a26",
  muted: "#5a5147",
  white: "#ffffff",
} as const;

export type PosterFont = "ar" | "en";

export interface PosterRect {
  kind: "rect";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export interface PosterText {
  kind: "text";
  id: string;
  text: string;
  /** Vertical centre of the line. */
  y: number;
  size: number;
  weight: 400 | 600 | 700 | 900;
  color: string;
  dir: "ltr" | "rtl";
  font: PosterFont;
  /** Widest the line may be (centred). */
  maxWidth: number;
}

export interface PosterQr {
  kind: "qr";
  id: string;
  x: number;
  y: number;
  size: number;
}

export type PosterElement = PosterRect | PosterText | PosterQr;

export interface PosterStrings {
  headline: string;
  sub: string;
  footer: string;
}

export interface PosterInput {
  size: PosterSize;
  lang: PosterLang;
  shopName: string;
  /** Short URL printed under the code (no protocol). */
  url: string;
  en: PosterStrings;
  ar: PosterStrings;
}

export interface PosterLayout {
  width: number;
  height: number;
  elements: PosterElement[];
}

export function posterHeight(size: PosterSize): number {
  const mm = POSTER_MM[size];
  return Math.round((POSTER_UNITS * mm.h) / mm.w);
}

/** Arabic script anywhere in the string. */
export function hasArabic(s: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s);
}

/**
 * Font size so a single line of `text` fits `maxWidth`. Average glyph
 * advance is ~0.56em for Latin bold and ~0.5em for Arabic (Cairo); the
 * canvas renderer still measures and shrinks as a safety net.
 */
export function fitFontSize(text: string, base: number, maxWidth: number, min = base * 0.45): number {
  const chars = Array.from(text.trim()).length;
  if (chars === 0) return base;
  const advance = hasArabic(text) ? 0.5 : 0.56;
  const fit = maxWidth / (chars * advance);
  return Math.max(min, Math.min(base, Math.floor(fit)));
}

/** Longest shop name printed in full; longer names end with an ellipsis. */
export const NAME_MAX = 40;

export function truncate(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : s;
}

function text(
  id: string,
  value: string,
  y: number,
  size: number,
  weight: PosterText["weight"],
  color: string,
  font: PosterFont,
  maxWidth = 820,
  min?: number,
): PosterText {
  return {
    kind: "text",
    id,
    text: value,
    y,
    size: fitFontSize(value, size, maxWidth, min),
    weight,
    color,
    dir: font === "ar" ? "rtl" : "ltr",
    font,
    maxWidth,
  };
}

/** Builds the poster. Bilingual posters lead with Arabic (Arabic-first copy). */
export function posterLayout(input: PosterInput): PosterLayout {
  const W = POSTER_UNITS;
  const H = posterHeight(input.size);
  const c = POSTER_COLORS;
  const name = truncate(input.shopName.trim(), NAME_MAX) || "Halaqy";
  const nameFont: PosterFont = hasArabic(name) ? "ar" : "en";
  const langs: PosterFont[] = input.lang === "both" ? ["ar", "en"] : [input.lang];
  const primary = langs[0];
  const els: PosterElement[] = [];

  // Paper and the ink header band.
  els.push({ kind: "rect", id: "paper", x: 0, y: 0, w: W, h: H, fill: c.paper });
  const bandH = Math.round(H * 0.2);
  els.push({ kind: "rect", id: "band", x: 0, y: 0, w: W, h: bandH, fill: c.ink });
  els.push({ kind: "rect", id: "rule", x: W / 2 - 60, y: bandH - 46, w: 120, h: 8, fill: c.brass, radius: 4 });
  els.push(text("name", name, bandH * 0.47, 92, 900, c.white, nameFont, 860, 30));

  // Headlines (one per language).
  let y = bandH + 80;
  langs.forEach((l, i) => {
    const s = l === "ar" ? input.ar : input.en;
    const size = i === 0 ? 76 : 52;
    els.push(text(`headline-${l}`, s.headline, y, size, i === 0 ? 900 : 700, c.ink, l));
    y += i === 0 ? 80 : 64;
  });

  // QR in a white card with a brass frame.
  const qrCard = 560;
  const cardY = y + 4;
  els.push({
    kind: "rect",
    id: "qr-card",
    x: (W - qrCard) / 2,
    y: cardY,
    w: qrCard,
    h: qrCard,
    fill: c.white,
    stroke: c.brass,
    strokeWidth: 10,
    radius: 36,
  });
  const qrInset = 50;
  const qrSize = qrCard - 2 * qrInset;
  els.push({ kind: "qr", id: "qr", x: (W - qrSize) / 2, y: cardY + qrInset, size: qrSize });
  y = cardY + qrCard + 58;

  // "Scan with your camera" in each language.
  langs.forEach((l) => {
    const s = l === "ar" ? input.ar : input.en;
    els.push(text(`sub-${l}`, s.sub, y, l === primary ? 40 : 34, 600, c.muted, l));
    y += 52;
  });

  // URL and footer.
  els.push(text("url", input.url, Math.min(y + 20, H - 130), 34, 700, c.brassText, "en", 880));
  const footer = (primary === "ar" ? input.ar : input.en).footer;
  els.push({ kind: "rect", id: "footer-rule", x: 120, y: H - 92, w: W - 240, h: 2, fill: c.brass });
  els.push(text("footer", footer, H - 52, 26, 600, c.muted, primary, 760));

  return { width: W, height: H, elements: els };
}

/** CSS percentages for the DOM preview. */
export function toPercent(value: number, total: number): string {
  return `${Math.round((value / total) * 10000) / 100}%`;
}
