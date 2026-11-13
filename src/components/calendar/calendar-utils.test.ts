import { describe, it, expect } from "vitest";
import {
  STATUS_STYLES,
  computeHourRange,
  blockPlacement,
  nowPosition,
  packTracks,
  hourTicks,
  combineDayAndTime,
  initialsOf,
} from "./calendar-utils";
import { APPOINTMENT_STATUSES } from "@/lib/types";

const at = (h: number, m = 0) => new Date(2026, 0, 10, h, m).toISOString();

describe("STATUS_STYLES", () => {
  it("covers exactly the canonical statuses (no legacy 'no-show')", () => {
    expect(Object.keys(STATUS_STYLES).sort()).toEqual([...APPOINTMENT_STATUSES].sort());
  });
});

describe("computeHourRange", () => {
  it("defaults to 08:00–20:00", () => {
    expect(computeHourRange([])).toEqual({ startHour: 8, endHour: 20 });
  });

  it("widens to include early and late bookings", () => {
    expect(
      computeHourRange([
        { startTime: at(7, 30), endTime: at(8, 0) },
        { startTime: at(20, 0), endTime: at(21, 15) },
      ]),
    ).toEqual({ startHour: 7, endHour: 22 });
  });
});

describe("blockPlacement", () => {
  const range = { startHour: 8, endHour: 20 };
  it("positions a block proportionally", () => {
    const p = blockPlacement(at(14), at(15), range);
    expect(p.startPct).toBeCloseTo(50);
    expect(p.widthPct).toBeCloseTo(100 / 12);
  });

  it("clamps blocks that start before the range", () => {
    const p = blockPlacement(at(7), at(9), range);
    expect(p.startPct).toBe(0);
    expect(p.widthPct).toBeCloseTo(100 / 12);
  });
});

describe("nowPosition", () => {
  it("returns null outside the range", () => {
    expect(nowPosition(new Date(2026, 0, 10, 6), { startHour: 8, endHour: 20 })).toBeNull();
    expect(nowPosition(new Date(2026, 0, 10, 14), { startHour: 8, endHour: 20 })).toBeCloseTo(50);
  });
});

describe("packTracks", () => {
  it("stacks overlapping blocks and leaves separate ones full height", () => {
    const tracks = packTracks([
      { id: "a", startTime: at(10), endTime: at(11) },
      { id: "b", startTime: at(10, 30), endTime: at(11, 30) },
      { id: "c", startTime: at(12), endTime: at(13) },
    ]);
    expect(tracks.get("a")).toEqual({ track: 0, tracks: 2 });
    expect(tracks.get("b")).toEqual({ track: 1, tracks: 2 });
    expect(tracks.get("c")).toEqual({ track: 0, tracks: 1 });
  });
});

describe("small helpers", () => {
  it("hourTicks lists each hour start", () => {
    expect(hourTicks({ startHour: 8, endHour: 11 })).toEqual([8, 9, 10]);
  });

  it("combineDayAndTime builds a local date", () => {
    const d = combineDayAndTime("2026-03-05", "09:45");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 5, 9, 45]);
  });

  it("initialsOf is whitespace-safe", () => {
    expect(initialsOf("  omar   khaled ")).toBe("OK");
    expect(initialsOf("")).toBe("?");
  });
});
