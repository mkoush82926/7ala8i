import { describe, expect, it } from "vitest";
import {
  DEFAULT_LINK_THEME,
  bookingSourceCategory,
  brandedLink,
  buildFunnel,
  buttonSnippet,
  displayUrl,
  embedSnippet,
  ensureLinkEntry,
  fillTemplate,
  forwardQuery,
  linkChannel,
  linkSegment,
  parseLinkTheme,
  posterFileName,
  posterPixels,
  serializeLinkTheme,
  visitKey,
  welcomeFor,
} from "./link-utils";

const shop = { id: "11111111-1111-4111-8111-111111111111", slug: "fade-house", slug_ar: "بيت-الفيد" };

describe("linkChannel (mirror of SQL link_channel)", () => {
  it.each([
    ["ig", "ig"], ["Instagram", "ig"], ["fb", "fb"], ["facebook", "fb"], ["wa", "wa"], ["whatsapp", "wa"],
    ["qr", "qr"], ["qr-mirror", "qr"], ["web", "web"], ["embed", "web"], ["google", "google"], ["maps", "google"],
    ["tiktok", "tiktok"], ["link", "link"], ["bio", "link"], [null, "direct"], ["", "direct"], ["zzz", "other"],
  ])("%s → %s", (raw, expected) => {
    expect(linkChannel(raw as string | null)).toBe(expected);
  });
});

describe("bookingSourceCategory (mirror of SQL booking_source_category)", () => {
  it("keeps the 1D categories", () => {
    expect(bookingSourceCategory("ig")).toBe("instagram");
    expect(bookingSourceCategory("wa")).toBe("whatsapp");
    expect(bookingSourceCategory("gmb")).toBe("google");
    expect(bookingSourceCategory(null)).toBe("online");
    expect(bookingSourceCategory("link")).toBe("online");
    expect(bookingSourceCategory("walk_in")).toBe("walk_in");
  });
  it("adds qr, facebook and website", () => {
    expect(bookingSourceCategory("qr")).toBe("qr");
    expect(bookingSourceCategory("fb")).toBe("facebook");
    expect(bookingSourceCategory("web")).toBe("website");
  });
});

describe("brandedLink", () => {
  it("builds the tagged /b link with entry=link", () => {
    expect(brandedLink({ origin: "https://halaqy.jo/", locale: "en", shop, src: "qr" })).toBe(
      "https://halaqy.jo/en/b/fade-house?src=qr&entry=link",
    );
  });
  it("uses the Arabic slug on /ar", () => {
    const url = brandedLink({ origin: "https://halaqy.jo", locale: "ar", shop, src: "ig" });
    expect(url).toBe(`https://halaqy.jo/ar/b/${encodeURIComponent("بيت-الفيد")}?src=ig&entry=link`);
  });
  it("falls back to the id and drops invalid tokens", () => {
    expect(brandedLink({ locale: "en", shop: { id: "abc" }, src: "<x>", entry: null })).toBe("/en/b/abc");
    expect(linkSegment({ id: "abc", slug: null, slug_ar: "x" }, "en")).toBe("abc");
  });
  it("adds embed=1", () => {
    expect(brandedLink({ locale: "en", shop, src: "web", embed: true })).toBe("/en/b/fade-house?src=web&entry=link&embed=1");
  });
});

describe("forwardQuery / ensureLinkEntry", () => {
  it("keeps only engine params", () => {
    const q = forwardQuery({ src: "qr", utm_source: "x", service: ["a", "b"], staff: "s" });
    expect(q.toString()).toBe("service=a&staff=s&src=qr");
  });
  it("asks for a redirect only when entry is missing", () => {
    expect(ensureLinkEntry({ src: "qr" })).toBe("src=qr&entry=link");
    expect(ensureLinkEntry({})).toBe("entry=link");
    expect(ensureLinkEntry({ src: "qr", entry: "link" })).toBeNull();
    expect(ensureLinkEntry({ entry: "deal" })).toBeNull();
  });
});

describe("theme", () => {
  it("parses junk to defaults", () => {
    expect(parseLinkTheme(null)).toEqual(DEFAULT_LINK_THEME);
    expect(parseLinkTheme([1])).toEqual(DEFAULT_LINK_THEME);
    expect(parseLinkTheme({ accent: "pink", show_cover: "yes" })).toEqual(DEFAULT_LINK_THEME);
  });
  it("trims and caps welcome text", () => {
    const t = parseLinkTheme({ accent: "brass", show_logo: false, welcome_en: "  Hi   there ", welcome_ar: "x".repeat(300) });
    expect(t.accent).toBe("brass");
    expect(t.show_logo).toBe(false);
    expect(t.welcome_en).toBe("Hi there");
    expect(t.welcome_ar).toHaveLength(160);
  });
  it("serialises only known keys", () => {
    const out = serializeLinkTheme({ ...DEFAULT_LINK_THEME, welcome_en: " " });
    expect(Object.keys(out).sort()).toEqual(["accent", "show_cover", "show_logo", "welcome_ar", "welcome_en"]);
    expect(out.welcome_en).toBeNull();
  });
  it("falls back between languages", () => {
    expect(welcomeFor({ ...DEFAULT_LINK_THEME, welcome_en: "Hi" }, "ar")).toBe("Hi");
    expect(welcomeFor({ ...DEFAULT_LINK_THEME, welcome_ar: "أهلاً" }, "en")).toBe("أهلاً");
  });
});

describe("snippets", () => {
  it("escapes the button snippet", () => {
    const s = buttonSnippet('https://x/b/a?src=web&entry=link', 'Book <now> "today"', "brass", "rtl");
    expect(s).toContain('href="https://x/b/a?src=web&amp;entry=link"');
    expect(s).toContain("Book &lt;now&gt; &quot;today&quot;");
    expect(s).toContain("#0F766E");
    expect(s).toContain('dir="rtl"');
  });
  it("clamps the iframe height", () => {
    expect(embedSnippet("https://x", "T", 100)).toContain("height:480px");
    expect(embedSnippet("https://x", "T", 99999)).toContain("height:1400px");
  });
  it("fills templates", () => {
    expect(fillTemplate("Book {name}: {link} {missing}", { name: "A", link: "L" })).toBe("Book A: L {missing}");
  });
});

describe("posters", () => {
  it("sizes A4/A5 at 150 dpi", () => {
    expect(posterPixels("a4")).toEqual({ w: 1240, h: 1754 });
    expect(posterPixels("a5")).toEqual({ w: 874, h: 1240 });
  });
  it("names files safely", () => {
    expect(posterFileName("Fade House!", "a5", "ar")).toBe("halaqy-fade-house-qr-a5-ar.png");
    expect(posterFileName("بيت", "a4", "both")).toBe("halaqy-shop-qr-a4-both.png");
  });
  it("prints a short url", () => {
    expect(displayUrl("https://halaqy.jo/en/b/x?src=qr&entry=link")).toBe("halaqy.jo/en/b/x");
  });
});

describe("buildFunnel", () => {
  it("normalises, merges and computes conversion", () => {
    const f = buildFunnel([
      { channel: "qr", visits: "10", bookings: "4", completed: "2" },
      { channel: "ig", visits: 5, bookings: 0, completed: 0 },
      { channel: "insta", visits: 5, bookings: 1, completed: 1 },
      { channel: "direct", visits: 0, bookings: 2, completed: 0 },
      { channel: "qr", visits: -3, bookings: null },
    ]);
    expect(f.rows.map((r) => r.channel)).toEqual(["qr", "ig", "direct"]);
    expect(f.rows[0]).toMatchObject({ visits: 10, bookings: 4, completed: 2, conversion: 0.4 });
    expect(f.rows[1]).toMatchObject({ visits: 10, bookings: 1, conversion: 0.1 });
    expect(f.rows[2].conversion).toBeNull();
    expect(f.totals).toMatchObject({ visits: 20, bookings: 7, completed: 3, conversion: 0.35 });
  });
  it("handles non-arrays", () => {
    expect(buildFunnel(null)).toEqual({ rows: [], totals: { channel: "all", visits: 0, bookings: 0, completed: 0, conversion: null } });
  });
  it("visitKey is per channel", () => {
    expect(visitKey("s", "instagram")).toBe("halaqy:lv:s:ig");
  });
});
