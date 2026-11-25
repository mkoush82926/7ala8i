import { describe, expect, it } from "vitest";
import { CHANNEL_ROWS, channelLinks, linkSiteOrigin } from "./links-settings-logic";

const shop = { id: "11111111-1111-4111-8111-111111111111", slug: "abu-omar", slug_ar: "ابو-عمر" };

describe("channelLinks", () => {
  it("tags one link per channel with entry=link", () => {
    const rows = channelLinks("https://halaqy.com", "en", shop);
    expect(rows.map((r) => r.src)).toEqual([...CHANNEL_ROWS]);
    expect(rows[0].url).toBe("https://halaqy.com/en/b/abu-omar?src=ig&entry=link");
    for (const r of rows) expect(r.url).toContain(`src=${r.src}`);
  });

  it("uses the Arabic slug on /ar", () => {
    const [ig] = channelLinks("https://halaqy.com", "ar", shop);
    expect(ig.url.startsWith(`https://halaqy.com/ar/b/${encodeURIComponent("ابو-عمر")}?`)).toBe(true);
  });

  it("never offers qr as a plain channel row (the poster carries it)", () => {
    expect(CHANNEL_ROWS).not.toContain("qr");
  });
});

describe("linkSiteOrigin", () => {
  it("prefers a valid configured URL and strips paths", () => {
    expect(linkSiteOrigin("https://halaqy.com/some/path/", "http://localhost:3000")).toBe("https://halaqy.com");
  });
  it("falls back for empty, invalid or non-http values", () => {
    expect(linkSiteOrigin("", "http://localhost:3000/")).toBe("http://localhost:3000");
    expect(linkSiteOrigin("not a url", "https://a.test")).toBe("https://a.test");
    expect(linkSiteOrigin("javascript:alert(1)", "https://a.test")).toBe("https://a.test");
    expect(linkSiteOrigin(undefined, "https://a.test")).toBe("https://a.test");
  });
});
