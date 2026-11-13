import { describe, it, expect } from "vitest";
import { filterShops, normalizeSearch } from "./explore-utils";

const shops = [
  { name: "The Gentleman's Chair", address: "Amman, Abdoun", serviceNames: ["Skin Fade", "حلاقة ذقن"] },
  { name: "صالون الأناقة", address: "إربد", serviceNames: [] },
];

describe("explore search", () => {
  it("normalizes Arabic variants", () => {
    expect(normalizeSearch("  أَربد  ")).toBe("اربد");
    expect(normalizeSearch("صالةٌ")).toBe("صاله");
  });
  it("matches name, address and services; every term must match", () => {
    expect(filterShops(shops, "")).toHaveLength(2);
    expect(filterShops(shops, "fade")).toHaveLength(1);
    expect(filterShops(shops, "amman chair")).toHaveLength(1);
    expect(filterShops(shops, "amman irbid")).toHaveLength(0);
    expect(filterShops(shops, "اربد")).toHaveLength(1);
    expect(filterShops(shops, "ذقن")).toHaveLength(1);
  });
});
