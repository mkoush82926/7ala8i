import { describe, it, expect } from "vitest";
import {
  appendChip,
  barberSurcharge,
  dateRange,
  deserializeBooking,
  freeCancellationUntil,
  initialStep,
  lineQuote,
  normalizeService,
  offersAll,
  parseEntryParams,
  persistKey,
  quoteLines,
  serializeBooking,
  toggleLine,
  type ServiceRow,
} from "./booking-state";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333333";
const B1 = "44444444-4444-4444-8444-444444444444";
const SHOP = "55555555-5555-4555-8555-555555555555";

const haircut: ServiceRow = normalizeService(
  { id: S1, name: "Haircut", duration: 30, price: 5, price_type: "fixed" },
  [{ id: V1, service_id: S1, name_en: "Long hair", name_ar: "شعر طويل", price: 7, duration: 45, sort: 0 }],
);
const beard: ServiceRow = normalizeService({ id: S2, name: "Beard", duration: 15, price: 3, price_type: "from" });
const map = new Map([
  [S1, haircut],
  [S2, beard],
]);

describe("parseEntryParams", () => {
  it("reads service(s), staff/barber, src and entry", () => {
    const sp = new URLSearchParams(`service=${S1}&services=${S2},bad,${S1}&staff=${B1}&src=IG&entry=profile_card`);
    expect(parseEntryParams(sp)).toEqual({ serviceIds: [S1, S2], barberId: B1, src: "ig", entry: "profile_card", rescheduleId: null });
    expect(parseEntryParams(new URLSearchParams("barber=any&src=<x>")).barberId).toBe("any");
    expect(parseEntryParams(new URLSearchParams("src=<x>")).src).toBeNull();
    expect(parseEntryParams(null).serviceIds).toEqual([]);
  });
});

describe("pricing", () => {
  it("uses variant, then barber override, then catalogue", () => {
    expect(lineQuote(haircut, V1)).toEqual({ price: 7, duration: 45, isFrom: false });
    expect(lineQuote(haircut, null, { service_id: S1, price_override: 6, duration_override: 40 })).toEqual({
      price: 6,
      duration: 40,
      isFrom: false,
    });
    expect(lineQuote(haircut, null)).toEqual({ price: 5, duration: 30, isFrom: false });
  });

  it("treats free as 0 and flags from-prices", () => {
    const free = normalizeService({ id: S2, name: "Wash", duration: 10, price: 2, price_type: "free" });
    expect(lineQuote(free, null).price).toBe(0);
    const q = quoteLines(
      [
        { serviceId: S1, variantId: null, note: "" },
        { serviceId: S2, variantId: null, note: "" },
      ],
      map,
    );
    expect(q).toEqual({ price: 8, duration: 45, isFrom: true });
  });

  it("computes a barber surcharge", () => {
    const lines = [{ serviceId: S1, variantId: null, note: "" }];
    expect(barberSurcharge(lines, map, [{ service_id: S1, price_override: 7 }])).toBe(2);
    expect(barberSurcharge(lines, map, [])).toBe(0);
  });

  it("checks barber capability", () => {
    expect(offersAll([], [S1])).toBe(true);
    expect(offersAll([{ service_id: S1 }], [S1, S2])).toBe(false);
    expect(offersAll([{ service_id: S1 }, { service_id: S2, is_active: false }], [S2])).toBe(false);
  });
});

describe("toggleLine", () => {
  it("adds, switches variant, removes", () => {
    let lines = toggleLine([], S1);
    expect(lines).toEqual([{ serviceId: S1, variantId: null, note: "" }]);
    lines = toggleLine(lines, S1, V1);
    expect(lines[0].variantId).toBe(V1);
    expect(toggleLine(lines, S1)).toEqual([]);
  });
});

describe("freeCancellationUntil", () => {
  it("subtracts the policy hours", () => {
    expect(freeCancellationUntil("2026-09-01T10:00:00.000Z", 24)?.toISOString()).toBe("2026-08-31T10:00:00.000Z");
    expect(freeCancellationUntil("2026-09-01T10:00:00.000Z", 0)).toBeNull();
    expect(freeCancellationUntil(null, 24)).toBeNull();
  });
});

describe("persistence", () => {
  const base = {
    shopId: SHOP,
    step: "review" as const,
    lines: [{ serviceId: S1, variantId: V1, note: "short" }],
    barber: "any",
    date: "2026-09-01",
    slot: { startIso: "2026-09-01T10:00:00.000Z", localDate: "2026-09-01", localTime: "13:00" },
    name: "Ahmad",
    phone: "0791234567",
    notes: "",
    otp: { phone: "0791234567", token: "abc", sentAt: 1, verifiedAt: 2 },
  };

  it("round-trips and survives a refresh", () => {
    const raw = serializeBooking(base, 1000);
    const back = deserializeBooking(raw, SHOP, 2000);
    expect(back?.lines).toEqual(base.lines);
    expect(back?.otp?.token).toBe("abc");
    expect(back?.slot?.localTime).toBe("13:00");
    expect(persistKey(SHOP)).toContain(SHOP);
  });

  it("drops stale, foreign or malformed state", () => {
    const raw = serializeBooking(base, 0);
    expect(deserializeBooking(raw, SHOP, 3 * 60 * 60 * 1000)).toBeNull();
    expect(deserializeBooking(raw, S1, 1)).toBeNull();
    expect(deserializeBooking("{oops", SHOP)).toBeNull();
  });

  it("never resumes past a missing input", () => {
    const params = parseEntryParams(null);
    const restored = deserializeBooking(serializeBooking({ ...base, slot: null }, 1), SHOP, 2)!;
    expect(initialStep(params, restored, new Set([S1]))).toBe("time");
    expect(initialStep(parseEntryParams(new URLSearchParams(`service=${S1}`)), null, new Set([S1]))).toBe("barber");
    expect(initialStep(parseEntryParams(new URLSearchParams(`service=${S1}&staff=${B1}`)), null, new Set([S1]))).toBe("time");
    expect(initialStep(parseEntryParams(new URLSearchParams(`service=${S2}`)), null, new Set([S1]))).toBe("services");
  });
});

describe("misc", () => {
  it("builds date ranges across months", () => {
    expect(dateRange("2026-01-30", 3)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });

  it("appends chips once", () => {
    expect(appendChip("", "First visit")).toBe("First visit");
    expect(appendChip("First visit", "Skin fade")).toBe("First visit, Skin fade");
    expect(appendChip("First visit, Skin fade", "Skin fade")).toBe("First visit, Skin fade");
    expect(appendChip("", "أول زيارة")).toBe("أول زيارة");
  });
});
