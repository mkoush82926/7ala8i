// ═══════════════════════════════════════════════════════
// WS-1H · PNG export of the QR poster. Draws a PosterLayout onto a canvas
// (fonts from the app's next/font variables) and returns a PNG blob.
// drawPoster() takes a structural 2D context so it can be unit-tested.
// ═══════════════════════════════════════════════════════

import { POSTER_UNITS, type PosterFont, type PosterLayout } from "./poster-layout";

/** Subset of CanvasRenderingContext2D used by drawPoster. */
export interface PosterContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction?: CanvasDirection;
  imageSmoothingEnabled?: boolean;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

export type PosterFonts = Record<PosterFont, string>;

export const FALLBACK_FONTS: PosterFonts = {
  ar: "'Segoe UI', Tahoma, Arial, sans-serif",
  en: "'Segoe UI', system-ui, Arial, sans-serif",
};

function roundedRect(ctx: PosterContext, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Paints the layout at `pixelWidth` (height follows the layout ratio).
 * Text that is still wider than its box after the layout's estimate is
 * shrunk step by step until it fits.
 */
export function drawPoster(
  ctx: PosterContext,
  layout: PosterLayout,
  pixelWidth: number,
  qr: CanvasImageSource | null,
  fonts: PosterFonts = FALLBACK_FONTS,
): void {
  const k = pixelWidth / POSTER_UNITS;
  for (const el of layout.elements) {
    if (el.kind === "rect") {
      ctx.fillStyle = el.fill;
      if (el.radius) {
        roundedRect(ctx, el.x * k, el.y * k, el.w * k, el.h * k, el.radius * k);
        ctx.fill();
        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = el.strokeWidth * k;
          ctx.stroke();
        }
      } else {
        ctx.fillRect(el.x * k, el.y * k, el.w * k, el.h * k);
      }
    } else if (el.kind === "qr") {
      if (qr) {
        // Crisp modules: never smooth a scaled QR.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qr, el.x * k, el.y * k, el.size * k, el.size * k);
        ctx.imageSmoothingEnabled = true;
      }
    } else {
      let size = el.size * k;
      const family = fonts[el.font] || FALLBACK_FONTS[el.font];
      const maxW = el.maxWidth * k;
      ctx.font = `${el.weight} ${size}px ${family}`;
      for (let i = 0; i < 20 && ctx.measureText(el.text).width > maxW && size > 8; i++) {
        size *= 0.92;
        ctx.font = `${el.weight} ${size}px ${family}`;
      }
      ctx.fillStyle = el.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = el.dir;
      ctx.fillText(el.text, (POSTER_UNITS / 2) * k, el.y * k, maxW);
    }
  }
}

/** Font families behind the app's next/font CSS variables (browser only). */
export function resolvePosterFonts(): PosterFonts {
  if (typeof document === "undefined") return FALLBACK_FONTS;
  const style = getComputedStyle(document.documentElement);
  const ar = style.getPropertyValue("--font-cairo").trim();
  const en = style.getPropertyValue("--font-bdo-grotesk").trim();
  return {
    ar: ar ? `${ar}, ${FALLBACK_FONTS.ar}` : FALLBACK_FONTS.ar,
    en: en ? `${en}, ${FALLBACK_FONTS.en}` : FALLBACK_FONTS.en,
  };
}

/** Makes sure the glyphs are loaded before the canvas draws them. */
async function loadFonts(fonts: PosterFonts): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`900 40px ${fonts.ar}`, "حلاقة"),
      document.fonts.load(`700 40px ${fonts.ar}`, "احجز"),
      document.fonts.load(`900 40px ${fonts.en}`, "Book"),
      document.fonts.load(`600 40px ${fonts.en}`, "Scan"),
    ]);
  } catch {
    // Fallback fonts still render.
  }
}

export async function renderPosterPng(
  layout: PosterLayout,
  pixelWidth: number,
  qr: CanvasImageSource | null,
): Promise<Blob> {
  const fonts = resolvePosterFonts();
  await loadFonts(fonts);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pixelWidth);
  canvas.height = Math.round((pixelWidth * layout.height) / layout.width);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  drawPoster(ctx, layout, canvas.width, qr, fonts);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG_FAILED"))), "image/png");
  });
}

/** Triggers a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
