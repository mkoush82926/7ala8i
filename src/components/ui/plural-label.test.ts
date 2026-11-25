import { describe, it, expect } from "vitest";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { pluralLabel, servicesCountLabel } from "./booking-cta";
import { formatNumber } from "@/lib/utils";

describe("pluralLabel", () => {
  it("uses the Arabic dual and Arabic-Indic digits for reviews and services", () => {
    expect(pluralLabel(ar.primitives.reviewsCount, 2, "ar", formatNumber(2, "ar"))).toBe("تقييمان");
    expect(pluralLabel(ar.primitives.reviewsCount, 1, "ar", formatNumber(1, "ar"))).toBe("تقييم واحد");
    expect(pluralLabel(ar.primitives.reviewsCount, 5, "ar", "٥")).toBe("٥ تقييمات");
    expect(servicesCountLabel(ar.primitives.servicesCount, 2, "ar", "٢")).toBe("خدمتان");
  });
  it("English one / other", () => {
    expect(pluralLabel(en.primitives.reviewsCount, 1, "en", "1")).toBe("1 review");
    expect(pluralLabel(en.primitives.reviewsCount, 2, "en", "2")).toBe("2 reviews");
  });
});
