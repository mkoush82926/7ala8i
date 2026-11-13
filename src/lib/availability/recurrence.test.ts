import { describe, expect, it } from "vitest";
import { MAX_OCCURRENCES, expandRecurrence, parseRrule } from "./recurrence";

describe("parseRrule", () => {
  it("parses the supported subset", () => {
    expect(parseRrule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR,MO,FR;UNTIL=20261231T235959Z")).toEqual({
      freq: "WEEKLY",
      interval: 2,
      count: null,
      until: "2026-12-31",
      byDay: [1, 5],
    });
    expect(parseRrule("freq=daily;count=3")).toEqual({ freq: "DAILY", interval: 1, count: 3, until: null, byDay: [] });
  });

  it("rejects unsupported or malformed rules", () => {
    expect(parseRrule(null)).toBeNull();
    expect(parseRrule("FREQ=MONTHLY")).toBeNull();
    expect(parseRrule("FREQ=DAILY;BYDAY=MO")).toBeNull();
    expect(parseRrule("FREQ=WEEKLY;BYDAY=XX")).toBeNull();
    expect(parseRrule("FREQ=DAILY;INTERVAL=0")).toBeNull();
    expect(parseRrule("FREQ=DAILY;COUNT=-1")).toBeNull();
    expect(parseRrule("FREQ=DAILY;UNTIL=2026-12-31")).toBeNull();
    expect(parseRrule("FREQ")).toBeNull();
  });
});

describe("expandRecurrence", () => {
  it("daily with count", () => {
    expect(expandRecurrence("FREQ=DAILY;COUNT=3", "2026-12-30")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("daily every 2 days until a date", () => {
    expect(expandRecurrence("FREQ=DAILY;INTERVAL=2;UNTIL=20261107", "2026-11-01")).toEqual([
      "2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07",
    ]);
  });

  it("weekly on Friday prayer (start date weekday by default)", () => {
    // 2026-11-13 is a Friday.
    expect(expandRecurrence("FREQ=WEEKLY;COUNT=3", "2026-11-13")).toEqual(["2026-11-13", "2026-11-20", "2026-11-27"]);
  });

  it("weekly by day skips days before the start", () => {
    // Start Wednesday 2026-11-11, rule Mon+Fri.
    expect(expandRecurrence("FREQ=WEEKLY;BYDAY=MO,FR;COUNT=3", "2026-11-11")).toEqual(["2026-11-13", "2026-11-16", "2026-11-20"]);
  });

  it("biweekly with a hard end", () => {
    expect(expandRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=SU", "2026-11-01", "2026-11-30")).toEqual(["2026-11-01", "2026-11-15", "2026-11-29"]);
  });

  it("caps open-ended rules", () => {
    expect(expandRecurrence("FREQ=DAILY", "2026-01-01")).toHaveLength(MAX_OCCURRENCES);
  });

  it("returns [] for bad input", () => {
    expect(expandRecurrence("FREQ=YEARLY", "2026-01-01")).toEqual([]);
    expect(expandRecurrence("FREQ=DAILY", "01/01/2026")).toEqual([]);
  });
});
