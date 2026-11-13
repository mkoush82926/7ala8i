import { describe, expect, it } from "vitest";
import {
  BARBERSHOP_SERVICES,
  FRIDAY,
  MIDNIGHT_CLOSE,
  WEEK_ORDER_SAT_FIRST,
  defaultHours,
  hoursPreset,
  normalizeDuration,
  normalizePrice,
  timeOptions,
  toMinutes,
  validateDayHours,
} from "./barbershop";

const CATEGORY_SLUGS = ["haircut", "fade", "beard", "shave", "kids", "styling", "colour", "treatments", "facial", "packages", "home-service"];

describe("barbershop template", () => {
  it("has unique keys, bilingual names and sane prices", () => {
    const keys = BARBERSHOP_SERVICES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of BARBERSHOP_SERVICES) {
      expect(s.nameAr).toMatch(/[؀-ۿ]/);
      expect(s.nameEn).toMatch(/^[A-Za-z]/);
      expect(s.duration).toBeGreaterThanOrEqual(5);
      expect(s.duration).toBeLessThanOrEqual(480);
      expect(s.price).toBeGreaterThan(0);
      expect(CATEGORY_SLUGS).toContain(s.category);
      expect(["scissors", "sparkles"]).toContain(s.icon);
    }
  });

  it("includes the core Jordanian barber vocabulary", () => {
    const ar = BARBERSHOP_SERVICES.map((s) => s.nameAr).join(" ");
    for (const word of ["حلاقة", "تحديد", "دقن", "سشوار", "ماسك أسود"]) expect(ar).toContain(word);
  });
});

describe("hours presets", () => {
  it("lists Saturday first", () => {
    expect(WEEK_ORDER_SAT_FIRST[0]).toBe(6);
    expect(defaultHours().map((h) => h.day)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it("adds a Jumu'ah break only on Friday", () => {
    const week = hoursPreset("jumuahBreak");
    const fri = week.find((h) => h.day === FRIDAY)!;
    expect(fri.breakStart).toBe("12:00");
    expect(fri.breakEnd).toBe("13:30");
    expect(week.filter((h) => h.breakStart)).toHaveLength(1);
  });

  it("supports Friday afternoon and Friday off", () => {
    expect(hoursPreset("fridayAfternoon").find((h) => h.day === FRIDAY)!.start).toBe("14:00");
    expect(hoursPreset("fridayOff").find((h) => h.day === FRIDAY)!.open).toBe(false);
    expect(hoursPreset("standard").every((h) => h.open && !h.breakStart)).toBe(true);
  });

  it("produces valid days for every preset", () => {
    for (const id of ["standard", "jumuahBreak", "fridayAfternoon", "fridayOff"] as const) {
      expect(hoursPreset(id).map(validateDayHours).filter(Boolean)).toEqual([]);
    }
  });
});

describe("validateDayHours", () => {
  const base = { day: 1, open: true, start: "10:00", end: "22:00", breakStart: null, breakEnd: null };
  it("accepts closed days whatever the times", () => {
    expect(validateDayHours({ ...base, open: false, start: "22:00", end: "10:00" })).toBeNull();
  });
  it("rejects end before start", () => {
    expect(validateDayHours({ ...base, end: "09:00" })).toBe("endBeforeStart");
  });
  it("rejects half or out-of-range breaks", () => {
    expect(validateDayHours({ ...base, breakStart: "12:00" })).toBe("breakIncomplete");
    expect(validateDayHours({ ...base, breakStart: "09:00", breakEnd: "11:00" })).toBe("breakOutside");
    expect(validateDayHours({ ...base, breakStart: "13:00", breakEnd: "12:00" })).toBe("breakOutside");
  });
  it("rejects malformed times", () => {
    expect(validateDayHours({ ...base, start: "25:00" })).toBe("invalidTime");
  });
});

describe("helpers", () => {
  it("builds half-hour options", () => {
    const opts = timeOptions();
    expect(opts).toHaveLength(48);
    expect(opts[0]).toBe("00:00");
    expect(opts.at(-1)).toBe("23:30");
  });
  it("parses HH:MM", () => {
    expect(toMinutes("01:30")).toBe(90);
    expect(Number.isNaN(toMinutes("x"))).toBe(true);
  });
  it("normalises prices to 0.05 JD and clamps", () => {
    expect(normalizePrice("3,5")).toBe(3.5);
    expect(normalizePrice(2.333)).toBe(2.35);
    expect(normalizePrice(-1)).toBe(0);
    expect(normalizePrice(5000)).toBe(1000);
    expect(normalizePrice("abc")).toBe(0);
  });
  it("clamps durations", () => {
    expect(normalizeDuration(2)).toBe(5);
    expect(normalizeDuration(999)).toBe(480);
    expect(normalizeDuration("x")).toBe(30);
  });
});

describe("MIDNIGHT_CLOSE", () => {
  it("is a valid same-day closing time after any opening slot", () => {
    expect(validateDayHours({ day: 6, open: true, start: "23:30", end: MIDNIGHT_CLOSE, breakStart: null, breakEnd: null })).toBeNull();
    expect(toMinutes(MIDNIGHT_CLOSE)).toBe(24 * 60 - 1);
  });
});
