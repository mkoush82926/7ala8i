import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/amman-official.json";
import {
  AMMAN,
  PRAYERS,
  computePrayerTimes,
  defaultPrayerRules,
  isoWeekday,
  minutesBetween,
  normalizePrayerRules,
  planPrayerBlocks,
  prayerRange,
  timeInZone,
  addDays,
} from "./index";

type Row = { date: string; fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string };
const rows = fixture.rows as Row[];
const KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

function maxDiff(method: Parameters<typeof computePrayerTimes>[2], key: (typeof KEYS)[number]) {
  return Math.max(
    ...rows.map((row) => {
      const day = computePrayerTimes(AMMAN, row.date, method);
      return Math.abs(minutesBetween(row[key], timeInZone(day[key], "Asia/Amman")));
    }),
  );
}

describe("jordan_awqaf method vs the Ministry's Amman timetable", () => {
  it("covers published days across seasons (winter and summer)", () => {
    expect(rows.length).toBeGreaterThanOrEqual(7);
    expect(new Set(rows.map((r) => r.date.slice(5, 7))).size).toBeGreaterThanOrEqual(5);
  });

  it.each(KEYS)("%s is within ±1 minute on every published day", (key) => {
    expect(maxDiff("jordan_awqaf", key)).toBeLessThanOrEqual(1);
  });

  it("is a better fit than Muslim World League and Umm al-Qura", () => {
    // MWL has no tamkin minutes; Umm al-Qura uses a fixed 90-min Isha.
    expect(maxDiff("mwl", "maghrib")).toBeGreaterThan(2);
    expect(maxDiff("umm_al_qura", "isha")).toBeGreaterThan(2);
  });

  it("stays monotonic and in Amman's plausible ranges for every day of a year", () => {
    const days = prayerRange(AMMAN, "2026-01-01", 365);
    for (const d of days) {
      expect(d.fajr < d.sunrise && d.sunrise < d.dhuhr && d.dhuhr < d.asr && d.asr < d.maghrib && d.maghrib < d.isha).toBe(true);
      const dhuhr = timeInZone(d.dhuhr, "Asia/Amman");
      expect(dhuhr >= "12:15" && dhuhr <= "12:55").toBe(true);
    }
  });
});

describe("helpers", () => {
  it("isoWeekday and addDays", () => {
    expect(isoWeekday("2026-11-13")).toBe(5); // Friday
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("prayerRange returns ordered days", () => {
    const days = prayerRange(AMMAN, "2026-03-01", 3);
    expect(days.map((d) => d.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    for (const d of days) {
      expect(d.fajr < d.sunrise && d.sunrise < d.dhuhr && d.dhuhr < d.asr && d.asr < d.maghrib && d.maghrib < d.isha).toBe(true);
    }
  });

  it("normalizePrayerRules clamps to DB limits and fills gaps", () => {
    const rules = normalizePrayerRules([
      { prayer: "asr", enabled: true, minutes: 500, start_offset_minutes: -90, jumuah_minutes: 30 },
    ]);
    expect(rules.map((r) => r.prayer)).toEqual([...PRAYERS]);
    const asr = rules.find((r) => r.prayer === "asr")!;
    expect(asr).toMatchObject({ enabled: true, minutes: 180, start_offset_minutes: -60, jumuah_minutes: 0 });
    expect(rules.find((r) => r.prayer === "dhuhr")!.jumuah_minutes).toBe(60);
  });
});

describe("planPrayerBlocks", () => {
  it("blocks nothing by default except Jumu'ah on Friday", () => {
    const rules = defaultPrayerRules();
    expect(planPrayerBlocks(computePrayerTimes(AMMAN, "2026-11-12"), rules)).toHaveLength(0);
    const friday = planPrayerBlocks(computePrayerTimes(AMMAN, "2026-11-13"), rules);
    expect(friday).toHaveLength(1);
    expect(friday[0].prayer).toBe("jumuah");
    expect((friday[0].end.getTime() - friday[0].start.getTime()) / 60000).toBe(60);
  });

  it("applies minutes, offset and allow_online", () => {
    const rules = normalizePrayerRules([
      { prayer: "maghrib", enabled: true, minutes: 10, start_offset_minutes: -5, allow_online: true },
      { prayer: "dhuhr", enabled: true, minutes: 20, jumuah_minutes: 0 },
    ]);
    const day = computePrayerTimes(AMMAN, "2026-11-13");
    const blocks = planPrayerBlocks(day, rules);
    expect(blocks.map((b) => b.prayer)).toEqual(["dhuhr", "maghrib"]);
    const maghrib = blocks[1];
    expect(maghrib.start.getTime()).toBe(day.maghrib.getTime() - 5 * 60000);
    expect((maghrib.end.getTime() - maghrib.start.getTime()) / 60000).toBe(10);
    expect(maghrib.allowOnline).toBe(true);
  });
});
