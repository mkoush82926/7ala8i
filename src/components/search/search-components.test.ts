import { describe, expect, it } from "vitest";
import { isIosSafari, shouldOfferInstall } from "./pwa-install-prompt";
import { categorySearch } from "./category-tiles";

describe("shouldOfferInstall", () => {
  const now = Date.UTC(2026, 10, 25);
  it("never offers inside the installed app", () => {
    expect(shouldOfferInstall({ standalone: true, dismissedAt: null, now })).toBe(false);
  });
  it("waits 30 days after a dismissal", () => {
    expect(shouldOfferInstall({ standalone: false, dismissedAt: now - 2 * 86400000, now })).toBe(false);
    expect(shouldOfferInstall({ standalone: false, dismissedAt: now - 31 * 86400000, now })).toBe(true);
    expect(shouldOfferInstall({ standalone: false, dismissedAt: null, now })).toBe(true);
  });
});

describe("isIosSafari", () => {
  it("detects iOS Safari only", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const chrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
    const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
    expect(isIosSafari(safari)).toBe(true);
    expect(isIosSafari(chrome)).toBe(false);
    expect(isIosSafari(android)).toBe(false);
  });
});

describe("categorySearch", () => {
  it("searches by the localized category name", () => {
    const beard = { slug: "beard", nameEn: "Beard", nameAr: "لحية" };
    expect(categorySearch(beard, "en")).toEqual({ q: "Beard" });
    expect(categorySearch(beard, "ar")).toEqual({ q: "لحية" });
  });
  it("maps home service to the facet", () => {
    expect(categorySearch({ slug: "home-service", nameEn: "Home service", nameAr: "خدمة منزلية" }, "en")).toEqual({ filters: ["home_service"] });
  });
});
