import { describe, expect, it } from "vitest";
import { buildWaLink, enqueueMessage, enqueueMessages, normalizePhoneForWa } from "./messaging-stub";

describe("messaging stub", () => {
  it("normalises Jordanian numbers", () => {
    expect(normalizePhoneForWa("0791234567")).toBe("962791234567");
    expect(normalizePhoneForWa("791234567")).toBe("962791234567");
    expect(normalizePhoneForWa("+962 79 123 4567")).toBe("962791234567");
    expect(normalizePhoneForWa("00962791234567")).toBe("962791234567");
    expect(normalizePhoneForWa("٠٧٩١٢٣٤٥٦٧")).toBe("962791234567");
    expect(normalizePhoneForWa("abc")).toBeNull();
    expect(normalizePhoneForWa(null)).toBeNull();
  });

  it("builds wa.me links", () => {
    expect(buildWaLink("0791234567", "مرحبا 1")).toBe(`https://wa.me/962791234567?text=${encodeURIComponent("مرحبا 1")}`);
    expect(buildWaLink(null, "hi")).toBe("https://wa.me/?text=hi");
  });

  it("falls back to a wa.me link and skips unusable input", async () => {
    await expect(enqueueMessage({ shopId: "s", to: "0791234567", template: "schedule_change", body: "x" })).resolves.toEqual({
      status: "fallback",
      waLink: "https://wa.me/962791234567?text=x",
    });
    await expect(enqueueMessage({ shopId: "s", to: "", template: "generic", body: "x" })).resolves.toEqual({
      status: "skipped",
      reason: "NO_PHONE",
    });
    await expect(enqueueMessage({ shopId: "s", to: "0791234567", template: "generic", body: "  " })).resolves.toEqual({
      status: "skipped",
      reason: "EMPTY_BODY",
    });
    const many = await enqueueMessages([
      { shopId: "s", to: "0791234567", template: "generic", body: "a" },
      { shopId: "s", to: null, template: "generic", body: "b" },
    ]);
    expect(many.map((r) => r.status)).toEqual(["fallback", "skipped"]);
  });
});
