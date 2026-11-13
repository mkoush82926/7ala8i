import { describe, it, expect } from "vitest";
import {
  computeWeeklyHours,
  coverForShop,
  instagramUrl,
  isOpenAt,
  mapsUrl,
  referenceDateForWeekday,
  shopInitials,
  summarizeRatings,
  telHref,
  whatsappUrl,
  zonedDayAndTime,
} from "./shop-utils";

describe("shop-utils", () => {
  it("builds initials safely", () => {
    expect(shopInitials("The Gentleman's Chair")).toBe("TG");
    expect(shopInitials("  ")).toBe("?");
    expect(shopInitials(null)).toBe("?");
    expect(shopInitials("صالون الأناقة")).toBe("صا");
  });

  it("gives a stable cover per id", () => {
    expect(coverForShop("abc")).toEqual(coverForShop("abc"));
    expect(coverForShop("")).toBeTruthy();
  });

  it("builds external links", () => {
    expect(mapsUrl("https://maps.google.com/?q=x", "Amman")).toBe("https://maps.google.com/?q=x");
    expect(mapsUrl("javascript:alert(1)", "Amman, Abdoun")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Amman%2C%20Abdoun",
    );
    expect(mapsUrl(null, null)).toBeNull();
    expect(whatsappUrl("+962 79 123 4567")).toBe("https://wa.me/962791234567");
    expect(whatsappUrl("0096279123456")).toBe("https://wa.me/96279123456");
    expect(whatsappUrl("12")).toBeNull();
    expect(instagramUrl("@shop.name")).toBe("https://instagram.com/shop.name");
    expect(instagramUrl("")).toBeNull();
    expect(telHref("+962 (79) 123-4567")).toBe("tel:+962791234567");
  });

  it("summarizes ratings", () => {
    const s = summarizeRatings([5, 4, 5, 0, 9]);
    expect(s.count).toBe(3);
    expect(s.average).toBeCloseTo(14 / 3);
    expect(s.distribution[0]).toEqual({ star: 5, count: 2 });
    expect(summarizeRatings([]).average).toBe(0);
  });

  it("collapses barber hours into shop hours, Saturday first", () => {
    const hours = computeWeeklyHours([
      { day_of_week: 0, is_working: true, start_time: "10:00:00", end_time: "18:00:00" },
      { day_of_week: 0, is_working: true, start_time: "09:00", end_time: "16:00" },
      { day_of_week: 5, is_working: false, start_time: "00:00", end_time: "00:00" },
    ]);
    expect(hours.map((h) => h.day)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(hours[1]).toEqual({ day: 0, open: "09:00", close: "18:00" });
    expect(hours[6]).toEqual({ day: 5, open: null, close: null });
  });

  it("computes open/closed in the shop time zone", () => {
    const hours = computeWeeklyHours([{ day_of_week: 0, is_working: true, start_time: "09:00", end_time: "18:00" }]);
    // Sunday 2024-01-07 10:00 in Amman (UTC+3) = 07:00Z
    expect(isOpenAt(hours, new Date("2024-01-07T07:00:00Z"), "Asia/Amman")).toBe(true);
    expect(isOpenAt(hours, new Date("2024-01-07T16:00:00Z"), "Asia/Amman")).toBe(false);
    expect(isOpenAt([], new Date(), "Asia/Amman")).toBeNull();
    expect(zonedDayAndTime(new Date("2024-01-07T07:05:00Z"), "Bad/Zone")).toEqual({ day: 0, time: "10:05" });
  });

  it("maps weekday numbers to dates", () => {
    expect(referenceDateForWeekday(0).getDay()).toBe(0);
    expect(referenceDateForWeekday(6).getDay()).toBe(6);
  });
});
