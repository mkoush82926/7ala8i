import { describe, expect, it } from "vitest";
import { fitFontSize, hasArabic, posterHeight, posterLayout, toPercent, POSTER_UNITS, type PosterInput, type PosterText } from "./poster-layout";
import { drawPoster, FALLBACK_FONTS, type PosterContext } from "./poster-png";

const strings = {
  en: { headline: "Book your next cut", sub: "Scan with your phone camera", footer: "Online booking by Halaqy" },
  ar: { headline: "احجز موعدك القادم", sub: "امسح الرمز بكاميرا هاتفك", footer: "الحجز الإلكتروني عبر حلاقي" },
};

function input(over: Partial<PosterInput> = {}): PosterInput {
  return { size: "a4", lang: "both", shopName: "Abu Omar Barbers", url: "halaqy.com/ar/b/abu-omar", ...strings, ...over };
}

function texts(layout: ReturnType<typeof posterLayout>): PosterText[] {
  return layout.elements.filter((e): e is PosterText => e.kind === "text");
}

describe("poster layout", () => {
  it("keeps the paper aspect ratio for A4 and A5", () => {
    expect(posterHeight("a4")).toBe(1414);
    expect(posterHeight("a5")).toBe(1419);
  });

  it("puts Arabic first on bilingual posters, then English", () => {
    const ids = texts(posterLayout(input())).map((t) => t.id);
    expect(ids.indexOf("headline-ar")).toBeLessThan(ids.indexOf("headline-en"));
    expect(ids).toContain("sub-ar");
    expect(ids).toContain("sub-en");
  });

  it("single-language posters contain only that language", () => {
    const ids = texts(posterLayout(input({ lang: "en" }))).map((t) => t.id);
    expect(ids).toContain("headline-en");
    expect(ids).not.toContain("headline-ar");
    const footer = texts(posterLayout(input({ lang: "en" }))).find((t) => t.id === "footer");
    expect(footer?.text).toBe(strings.en.footer);
    expect(footer?.dir).toBe("ltr");
  });

  it("Arabic lines are right-to-left with the Arabic font", () => {
    const ar = texts(posterLayout(input({ lang: "ar", shopName: "صالون أبو عمر" })));
    expect(ar.find((t) => t.id === "headline-ar")?.dir).toBe("rtl");
    expect(ar.find((t) => t.id === "name")?.font).toBe("ar");
    // The URL is always Latin.
    expect(ar.find((t) => t.id === "url")?.dir).toBe("ltr");
  });

  it("every element stays on the page and text never overlaps vertically", () => {
    for (const lang of ["both", "ar", "en"] as const) {
      for (const size of ["a4", "a5"] as const) {
        const l = posterLayout(input({ lang, size }));
        for (const e of l.elements) {
          if (e.kind === "rect") {
            expect(e.x).toBeGreaterThanOrEqual(0);
            expect(e.y + e.h).toBeLessThanOrEqual(l.height);
          } else if (e.kind === "qr") {
            expect(e.y + e.size).toBeLessThanOrEqual(l.height);
            expect(e.size).toBeGreaterThanOrEqual(400);
          } else {
            expect(e.y - e.size / 2).toBeGreaterThanOrEqual(0);
            expect(e.y + e.size / 2).toBeLessThanOrEqual(l.height);
          }
        }
        const lines = texts(l).sort((a, b) => a.y - b.y);
        for (let i = 1; i < lines.length; i++) {
          const prev = lines[i - 1];
          const cur = lines[i];
          expect(cur.y - cur.size / 2).toBeGreaterThanOrEqual(prev.y + prev.size / 2 - 1);
        }
        const qr = l.elements.find((e) => e.kind === "qr")!;
        if (qr.kind === "qr") {
          for (const t of lines) {
            const insideQr = t.y > qr.y && t.y < qr.y + qr.size;
            expect(insideQr).toBe(false);
          }
        }
      }
    }
  });

  it("shrinks long shop names to fit the header", () => {
    const long = "The Very Long Name Gentlemen's Grooming Lounge and Barber Studio";
    const name = texts(posterLayout(input({ shopName: long }))).find((t) => t.id === "name")!;
    expect(name.size).toBeLessThan(92);
    expect(Array.from(name.text)).toHaveLength(40);
    expect(name.text.endsWith("…")).toBe(true);
    expect(name.size * Array.from(name.text).length * 0.56).toBeLessThanOrEqual(name.maxWidth);
  });

  it("falls back to a placeholder name when the shop has none", () => {
    expect(texts(posterLayout(input({ shopName: "  " }))).find((t) => t.id === "name")?.text).toBe("Halaqy");
  });

  it("fitFontSize and hasArabic", () => {
    expect(fitFontSize("", 50, 100)).toBe(50);
    expect(fitFontSize("ab", 50, 1000)).toBe(50);
    expect(fitFontSize("x".repeat(100), 50, 500)).toBeLessThan(50);
    expect(fitFontSize("x".repeat(1000), 50, 10)).toBe(22.5);
    expect(hasArabic("حلاقي")).toBe(true);
    expect(hasArabic("Halaqy 123")).toBe(false);
  });

  it("toPercent", () => {
    expect(toPercent(500, 1000)).toBe("50%");
    expect(toPercent(1, 3)).toBe("33.33%");
  });
});

function fakeContext() {
  const calls: { op: string; args: unknown[]; font?: string; dir?: string }[] = [];
  const ctx: PosterContext & { calls: typeof calls } = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    direction: "inherit",
    imageSmoothingEnabled: true,
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: () => undefined,
    lineTo: () => undefined,
    arcTo: () => undefined,
    closePath: () => undefined,
    fill: () => calls.push({ op: "fill", args: [] }),
    stroke: () => calls.push({ op: "stroke", args: [] }),
    fillRect: (...args) => calls.push({ op: "fillRect", args }),
    fillText(text, x, y, max) {
      calls.push({ op: "fillText", args: [text, x, y, max], font: this.font, dir: this.direction });
    },
    // 0.6em per char at the current font size.
    measureText(text) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      return { width: Array.from(text).length * size * 0.6 };
    },
    drawImage: (...args) => calls.push({ op: "drawImage", args }),
  };
  return ctx;
}

describe("drawPoster", () => {
  it("draws every text centred, the QR scaled and the frame stroked", () => {
    const layout = posterLayout(input());
    const ctx = fakeContext();
    const qr = {} as CanvasImageSource;
    drawPoster(ctx, layout, 2000, qr, FALLBACK_FONTS);
    const textCalls = ctx.calls.filter((c) => c.op === "fillText");
    expect(textCalls).toHaveLength(texts(layout).length);
    for (const c of textCalls) expect(c.args[1]).toBe(1000);
    const img = ctx.calls.find((c) => c.op === "drawImage")!;
    const q = layout.elements.find((e) => e.kind === "qr")!;
    if (q.kind === "qr") expect(img.args[3]).toBe(q.size * 2);
    expect(ctx.calls.some((c) => c.op === "stroke")).toBe(true);
    expect(ctx.imageSmoothingEnabled).toBe(true);
    const ar = textCalls.find((c) => c.args[0] === strings.ar.headline)!;
    expect(ar.dir).toBe("rtl");
  });

  it("shrinks text that the measured font still overflows", () => {
    const layout = posterLayout(input({ shopName: "W".repeat(40) }));
    const ctx = fakeContext();
    drawPoster(ctx, layout, POSTER_UNITS, null);
    const name = ctx.calls.find((c) => c.op === "fillText" && c.args[0] === "W".repeat(40))!;
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(name.font!)?.[1]);
    expect(40 * size * 0.6).toBeLessThanOrEqual(860 + 1);
  });

  it("skips the QR when none is ready", () => {
    const ctx = fakeContext();
    drawPoster(ctx, posterLayout(input()), 1000, null);
    expect(ctx.calls.some((c) => c.op === "drawImage")).toBe(false);
  });
});
