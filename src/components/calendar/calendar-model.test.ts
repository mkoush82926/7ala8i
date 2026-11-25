import { describe, expect, it } from "vitest";
import {
  EMPTY_SCHEDULE,
  barberColor,
  bucketByLaneDay,
  buildBlockRows,
  canMarkNoShow,
  cardColor,
  countByDay,
  densityLevel,
  fromIsoDay,
  hourRangeFor,
  isoDay,
  keyboardMove,
  moveBy,
  moveItem,
  orderTeam,
  overlapping,
  rangeFor,
  resizeBy,
  scheduledIds,
  selectTeam,
  shiftAnchor,
  verticalPlacement,
  workRanges,
  yToMinutes,
  BARBER_PALETTE,
} from "./calendar-model";

const at = (day: string, hh: number, mm = 0) => {
  const d = fromIsoDay(day);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};

describe("ranges", () => {
  it("weeks start on Saturday", () => {
    const r = rangeFor("week", fromIsoDay("2026-11-18")); // Wednesday
    expect(r.days[0]).toBe("2026-11-14"); // Saturday
    expect(r.days).toHaveLength(7);
    expect(fromIsoDay(r.days[6]).getDay()).toBe(5); // Friday
  });

  it("3-day and month ranges", () => {
    expect(rangeFor("3day", fromIsoDay("2026-12-31")).days).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    const m = rangeFor("month", fromIsoDay("2026-11-13"));
    expect(m.days.length % 7).toBe(0);
    expect(m.days).toContain("2026-11-01");
    expect(m.days).toContain("2026-11-30");
    expect(fromIsoDay(m.from).getDay()).toBe(6);
  });

  it("shiftAnchor pages by the range size", () => {
    const d = fromIsoDay("2026-11-13");
    expect(isoDay(shiftAnchor("day", d, 1))).toBe("2026-11-14");
    expect(isoDay(shiftAnchor("3day", d, -1))).toBe("2026-11-10");
    expect(isoDay(shiftAnchor("week", d, 1))).toBe("2026-11-20");
    expect(isoDay(shiftAnchor("month", d, 1))).toBe("2026-12-01");
  });
});

describe("geometry and moves", () => {
  const appt = { startTime: at("2026-11-14", 10), endTime: at("2026-11-14", 10, 45), barberId: "a" };

  it("verticalPlacement and yToMinutes", () => {
    const p = verticalPlacement(appt.startTime, appt.endTime, "2026-11-14", { startHour: 8, endHour: 20 }, 1);
    expect(p).toEqual({ top: 120, height: 45 });
    expect(verticalPlacement(appt.startTime, appt.endTime, "2026-11-15", { startHour: 8, endHour: 20 }, 1)).toBeNull();
    expect(yToMinutes(62, 8, 1)).toBe(8 * 60 + 60);
  });

  it("moveBy keeps the duration, snaps and changes lane/day", () => {
    const m = moveBy(appt, 33, { barberId: "b", dayShift: 1 });
    expect(m.barberId).toBe("b");
    expect(m.startIso).toBe(at("2026-11-15", 10, 35));
    expect(new Date(m.endIso).getTime() - new Date(m.startIso).getTime()).toBe(45 * 60000);
    expect(moveBy(appt, 0).barberId).toBe("a");
  });

  it("resizeBy never goes below 5 minutes", () => {
    expect(resizeBy(appt, 15)).toBe(at("2026-11-14", 11));
    expect(resizeBy(appt, -500)).toBe(at("2026-11-14", 10, 5));
  });

  it("keyboard move mirrors left/right in RTL", () => {
    const s = { deltaMinutes: 0, laneIndex: 1, dayShift: 0 };
    expect(keyboardMove(s, "ArrowRight", { isRTL: false, laneCount: 3 })!.laneIndex).toBe(2);
    expect(keyboardMove(s, "ArrowRight", { isRTL: true, laneCount: 3 })!.laneIndex).toBe(0);
    expect(keyboardMove(s, "ArrowLeft", { isRTL: true, laneCount: 3 })!.laneIndex).toBe(2);
    expect(keyboardMove(s, "ArrowDown", { isRTL: false, laneCount: 3, shift: true })!.deltaMinutes).toBe(60);
    expect(keyboardMove(s, "ArrowUp", { isRTL: false, laneCount: 3 })!.deltaMinutes).toBe(-15);
    expect(keyboardMove({ ...s, laneIndex: 2 }, "ArrowRight", { isRTL: false, laneCount: 3 })!.laneIndex).toBe(2);
    expect(keyboardMove(s, "a", { isRTL: false, laneCount: 3 })).toBeNull();
  });

  it("hourRangeFor widens for late items and night shifts", () => {
    expect(hourRangeFor([])).toEqual({ startHour: 8, endHour: 20 });
    expect(hourRangeFor([{ startTime: at("2026-11-14", 6, 30), endTime: at("2026-11-14", 7) }])).toEqual({ startHour: 6, endHour: 20 });
    expect(hourRangeFor([], [[600, 1500]])).toEqual({ startHour: 8, endHour: 24 });
  });

  it("overlapping treats null-barber blocks as shop-wide only when asked", () => {
    const target = { startIso: at("2026-11-14", 10), endIso: at("2026-11-14", 11), barberId: "a" };
    const items = [
      { id: "1", startTime: at("2026-11-14", 10, 30), endTime: at("2026-11-14", 11, 30), barberId: null },
      { id: "2", startTime: at("2026-11-14", 10, 30), endTime: at("2026-11-14", 11, 30), barberId: "b" },
      { id: "3", startTime: at("2026-11-14", 11), endTime: at("2026-11-14", 12), barberId: "a" },
    ];
    expect(overlapping(target, items).map((i) => i.id)).toEqual([]);
    expect(overlapping(target, items, { nullIsShopWide: true }).map((i) => i.id)).toEqual(["1"]);
  });
});

describe("statuses", () => {
  it("no-show only after the start time", () => {
    const appt = { status: "confirmed" as const, startTime: "2026-11-14T10:00:00Z" };
    expect(canMarkNoShow(appt, new Date("2026-11-14T09:59:00Z"))).toBe(false);
    expect(canMarkNoShow(appt, new Date("2026-11-14T10:00:00Z"))).toBe(true);
    expect(canMarkNoShow({ ...appt, status: "completed" }, new Date("2026-11-15T00:00:00Z"))).toBe(false);
  });
});

describe("team", () => {
  const team = [
    { id: "a", name: "A", order: 2 },
    { id: "b", name: "B", order: null },
    { id: "c", name: "C", order: 1 },
  ];

  it("orders by saved order, then a local override", () => {
    expect(orderTeam(team).map((m) => m.id)).toEqual(["c", "a", "b"]);
    expect(orderTeam(team, ["b", "a"]).map((m) => m.id)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("selects scheduled / all / custom with sensible fallbacks", () => {
    expect(selectTeam("scheduled", team, new Set(["b"]), []).map((m) => m.id)).toEqual(["b"]);
    expect(selectTeam("scheduled", team, new Set(), [])).toHaveLength(3);
    expect(selectTeam("custom", team, new Set(), ["c", "a"]).map((m) => m.id)).toEqual(["a", "c"]);
    expect(selectTeam("all", team, new Set(), [])).toHaveLength(3);
  });

  it("colours: custom, palette, category and status", () => {
    expect(barberColor({ color: "#123456" }, 0)).toBe("#123456");
    expect(barberColor({ color: "red" }, 1)).toBe(BARBER_PALETTE[1]);
    const colors = new Map([["a", "#111111"]]);
    expect(cardColor("barber", { status: "confirmed", barberId: "a" }, colors)).toBe("#111111");
    expect(cardColor("category", { status: "confirmed", barberId: "a", categorySlug: "beard" }, colors)).not.toBe("#111111");
    expect(cardColor("status", { status: "no_show", barberId: "a" }, colors)).toMatch(/^#/);
  });
});

describe("schedules", () => {
  const sat = "2026-11-14"; // getDay() = 6
  const base = {
    ...EMPTY_SCHEDULE,
    workingHours: [
      { barber_id: "a", day_of_week: 6, start_time: "10:00:00", end_time: "22:00:00", is_working: true, break_start: "14:00", break_end: "15:00" },
      { barber_id: "a", day_of_week: 5, start_time: "10:00:00", end_time: "22:00:00", is_working: false },
    ],
  };

  it("weekly hours minus break, default 9–18, day off", () => {
    expect(workRanges("a", sat, base)).toEqual([[600, 840], [900, 1320]]);
    expect(workRanges("b", sat, base)).toEqual([[540, 1080]]);
    expect(workRanges("a", "2026-11-13", base)).toEqual([]);
  });

  it("override, special hours, closures and approved time off", () => {
    expect(workRanges("a", sat, { ...base, overrides: [{ barber_id: "a", date: sat, segments: [{ start: "18:00", end: "02:00" }] }] })).toEqual([[1080, 1560]]);
    expect(workRanges("a", sat, { ...base, specialHours: [{ date: sat, is_closed: false, segments: [{ start: "12:00", end: "16:00" }] }] })).toEqual([[720, 960]]);
    expect(workRanges("a", sat, { ...base, closures: [{ start_date: sat, end_date: sat }] })).toEqual([]);
    const off = { barber_id: "a", start_time: at(sat, 0), end_time: at(sat, 23, 59), status: "approved" };
    expect(workRanges("a", sat, { ...base, timeOff: [off] })).toEqual([]);
    expect(workRanges("a", sat, { ...base, timeOff: [{ ...off, status: "pending" }] })).toHaveLength(2);
    expect([...scheduledIds(["a", "b"], ["2026-11-13"], base)]).toEqual(["b"]);
  });
});

describe("month and week buckets", () => {
  it("counts by day and density", () => {
    const items = [
      { startTime: at("2026-11-14", 10), status: "confirmed" as const, barberId: "a" },
      { startTime: at("2026-11-14", 9), status: "cancelled" as const, barberId: "a" },
      { startTime: at("2026-11-15", 9), status: "completed" as const, barberId: null },
    ];
    const counts = countByDay(items);
    expect(counts.get("2026-11-14")).toBe(1);
    expect(densityLevel(0, 5)).toBe(0);
    expect(densityLevel(5, 5)).toBe(4);
    expect(densityLevel(1, 8)).toBe(1);
    const buckets = bucketByLaneDay(items);
    expect(buckets.get("a|2026-11-14")!.map((i) => i.startTime)).toEqual([at("2026-11-14", 9), at("2026-11-14", 10)]);
    expect(buckets.get("__unassigned__|2026-11-15")).toHaveLength(1);
  });

  it("buckets 6 barbers × 7 days × 8 appointments quickly", () => {
    const items = [];
    for (let b = 0; b < 6; b++)
      for (let d = 0; d < 7; d++)
        for (let h = 0; h < 8; h++)
          items.push({ startTime: at(`2026-11-${String(14 + d).padStart(2, "0")}`, 9 + h), barberId: `b${b}` });
    const t = performance.now();
    const buckets = bucketByLaneDay(items);
    expect(performance.now() - t).toBeLessThan(50);
    expect(buckets.size).toBe(42);
  });
});

describe("blocked time series", () => {
  let n = 0;
  const newId = () => `series-${++n}`;

  it("single block", () => {
    const rows = buildBlockRows("shop", { barberIds: ["a"], day: "2026-11-14", time: "13:00", minutes: 30, repeat: "none", until: null, typeId: "t", title: " Lunch ", allowOnline: false }, newId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ barber_id: "a", rrule: null, series_id: null, title: "Lunch", source: "manual" });
    expect(new Date(rows[0].end_time).getTime() - new Date(rows[0].start_time).getTime()).toBe(30 * 60000);
  });

  it("weekdays repeat skips Friday, one series per barber", () => {
    const rows = buildBlockRows("shop", { barberIds: ["a", null], day: "2026-11-14", time: "13:00", minutes: 30, repeat: "weekdays", until: "2026-11-20", typeId: null, title: null, allowOnline: true }, newId);
    // Sat 14 … Thu 19 = 6 days, Friday 20 skipped; × 2 lanes.
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.series_id)).size).toBe(2);
    expect(rows.every((r) => fromIsoDay(isoDay(new Date(r.start_time))).getDay() !== 5)).toBe(true);
    expect(rows[0].rrule).toContain("BYDAY=SA,SU,MO,TU,WE,TH");
  });
});
