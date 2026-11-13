import { describe, expect, it } from "vitest";
import { groupSpecialRows, presetDefaults, resolvePreset, segmentsLabel, validateRange } from "./hours-logic";
import { validateSegments } from "@/components/team/shifts/schedule-logic";

describe("validateRange", () => {
  const today = "2026-11-13";
  it("checks presence, order, past and length", () => {
    expect(validateRange("", "2026-11-20", "closed", today)).toBe("MISSING");
    expect(validateRange("2026-11-20", "2026-11-19", "closed", today)).toBe("ORDER");
    expect(validateRange("2026-11-01", "2026-11-05", "closed", today)).toBe("PAST");
    expect(validateRange("2026-11-14", "2027-02-01", "special", today)).toBe("TOO_LONG");
    expect(validateRange("2026-11-14", "2027-02-01", "closed", today)).toBeNull();
    expect(validateRange("2026-11-13", "2026-11-13", "special", today)).toBeNull();
  });
});

describe("Hijri presets for 1448", () => {
  it("resolves Ramadan to 29 days starting 8 Feb 2027 with valid default hours", () => {
    const r = resolvePreset("ramadan", 1448)!;
    expect(r.start).toBe("2027-02-08");
    expect(r.end).toBe("2027-03-08");
    expect(r.days).toBe(29);
    expect(r.kind).toBe("special");
    expect(validateSegments(r.segments)).toBeNull();
  });
  it("resolves Eid al-Fitr and Eid al-Adha closures", () => {
    expect(resolvePreset("eid_al_fitr", 1448)).toMatchObject({ start: "2027-03-09", end: "2027-03-11", kind: "closed" });
    expect(resolvePreset("eid_al_adha", 1448)).toMatchObject({ start: "2027-05-16", end: "2027-05-19", kind: "closed" });
    expect(resolvePreset("arafah", 1448)).toMatchObject({ start: "2027-05-15", end: "2027-05-15", kind: "special" });
  });
  it("defaults unknown-hours presets to a closure", () => {
    expect(presetDefaults("islamic_new_year").kind).toBe("closed");
  });
});

describe("groupSpecialRows", () => {
  const seg = [{ start: "11:00", end: "16:00" }];
  it("merges consecutive identical days and splits on gaps or changes", () => {
    const groups = groupSpecialRows([
      { id: "c", date: "2027-02-10", is_closed: false, segments: seg, note_en: "Ramadan", note_ar: "رمضان" },
      { id: "a", date: "2027-02-08", is_closed: false, segments: seg, note_en: "Ramadan", note_ar: "رمضان" },
      { id: "b", date: "2027-02-09", is_closed: false, segments: seg, note_en: "Ramadan", note_ar: "رمضان" },
      { id: "d", date: "2027-02-12", is_closed: false, segments: seg, note_en: "Ramadan", note_ar: "رمضان" },
      { id: "e", date: "2027-02-13", is_closed: true, segments: [], note_en: null, note_ar: null },
    ]);
    expect(groups.map((g) => [g.start, g.end, g.ids])).toEqual([
      ["2027-02-08", "2027-02-10", ["a", "b", "c"]],
      ["2027-02-12", "2027-02-12", ["d"]],
      ["2027-02-13", "2027-02-13", ["e"]],
    ]);
    expect(groups[2].isClosed).toBe(true);
  });
  it("labels segments", () => {
    expect(segmentsLabel([{ start: "20:30", end: "01:30" }, { start: "09:00", end: "24:00" }])).toBe("20:30–01:30 · 09:00–00:00");
  });
});
