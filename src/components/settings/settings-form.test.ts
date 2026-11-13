import { describe, it, expect } from "vitest";
import {
  parseSettingsTab,
  shopRowToForm,
  validateShopForm,
  isFormDirty,
  normalizeInstagram,
  rowsToWeek,
  validateWeek,
  weekToRows,
  isWeekDirty,
  copyDayToWorkingDays,
} from "./settings-form";

describe("parseSettingsTab", () => {
  it("accepts known tabs only", () => {
    expect(parseSettingsTab("hours")).toBe("hours");
    expect(parseSettingsTab("billing")).toBeNull();
    expect(parseSettingsTab(null)).toBeNull();
  });
});

describe("shop form", () => {
  const valid = shopRowToForm({ name: "Fade Lab", currency: "JOD", timezone: "Asia/Amman" });

  it("maps nulls to defaults", () => {
    const f = shopRowToForm(null, "Fallback");
    expect(f.name).toBe("Fallback");
    expect(f.currency).toBe("JOD");
    expect(f.timezone).toBe("Asia/Amman");
    expect(f.cancellation_policy_hours).toBe("24");
    expect(f.require_deposit).toBe(false);
  });

  it("builds a trimmed update with nulls for empty optional fields", () => {
    const { errors, update } = validateShopForm({ ...valid, name: "  Fade Lab ", instagram: "@fade.lab" });
    expect(errors).toEqual({});
    expect(update).toMatchObject({ name: "Fade Lab", email: null, whatsapp: null, instagram: "fade.lab", daily_goal: 120 });
  });

  it("flags invalid fields", () => {
    const { errors, update } = validateShopForm({
      ...valid,
      name: "x",
      email: "nope",
      whatsapp: "12",
      google_maps_url: "maps",
      cancellation_policy_hours: "1.5",
      cancellation_fee_percent: "150",
      daily_goal: "-1",
    });
    expect(update).toBeNull();
    expect(errors).toEqual({
      name: "name",
      email: "email",
      whatsapp: "phone",
      google_maps_url: "url",
      cancellation_policy_hours: "range",
      cancellation_fee_percent: "range",
      daily_goal: "range",
    });
  });

  it("requires a positive deposit when deposits are on, and caps percentages", () => {
    expect(validateShopForm({ ...valid, require_deposit: true, deposit_value: "0" }).errors.deposit_value).toBe("range");
    expect(validateShopForm({ ...valid, require_deposit: true, deposit_value: "120" }).errors.deposit_value).toBe("range");
    expect(
      validateShopForm({ ...valid, require_deposit: true, deposit_type: "fixed", deposit_value: "120" }).update?.deposit_value,
    ).toBe(120);
  });

  it("detects dirty state", () => {
    expect(isFormDirty(valid, { ...valid })).toBe(false);
    expect(isFormDirty(valid, { ...valid, phone: "1" })).toBe(true);
  });

  it("normalizes instagram handles and URLs", () => {
    expect(normalizeInstagram("https://www.instagram.com/fade.lab/")).toBe("fade.lab");
    expect(normalizeInstagram(" @abc ")).toBe("abc");
  });
});

describe("working hours", () => {
  it("fills all 7 days (including Sunday) and trims seconds", () => {
    const week = rowsToWeek([
      { day_of_week: 0, start_time: "09:00:00", end_time: "17:00:00", is_working: true, break_start: "12:00:00", break_end: "13:00:00" },
      { day_of_week: 5, start_time: "09:00:00", end_time: "17:00:00", is_working: false, break_start: null, break_end: null },
    ]);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ day: 0, start: "09:00", end: "17:00", hasBreak: true, breakStart: "12:00" });
    expect(week[5].isWorking).toBe(false);
    expect(week[3].isWorking).toBe(true);
  });

  it("validates order and breaks on working days only", () => {
    const week = rowsToWeek([]);
    week[1] = { ...week[1], start: "18:00", end: "09:00" };
    week[2] = { ...week[2], hasBreak: true, breakStart: "08:00", breakEnd: "09:00" };
    week[3] = { ...week[3], isWorking: false, start: "18:00", end: "09:00" };
    expect(validateWeek(week)).toEqual({ 1: "order", 2: "break" });
  });

  it("drops breaks for closed days when building rows", () => {
    const week = rowsToWeek([]);
    week[4] = { ...week[4], isWorking: false, hasBreak: true };
    const rows = weekToRows("b1", week);
    expect(rows).toHaveLength(7);
    expect(rows[4]).toMatchObject({ barber_id: "b1", day_of_week: 4, is_working: false, break_start: null, break_end: null });
  });

  it("copies a day to other working days and tracks dirtiness", () => {
    const week = rowsToWeek([]);
    week[6] = { ...week[6], isWorking: false };
    const edited = week.map((d) => (d.day === 1 ? { ...d, start: "08:00" } : d));
    const copied = copyDayToWorkingDays(edited, 1);
    expect(copied[2].start).toBe("08:00");
    expect(copied[6].start).toBe(week[6].start);
    expect(isWeekDirty(week, copied)).toBe(true);
    expect(isWeekDirty(week, rowsToWeek([]).map((d) => (d.day === 6 ? { ...d, isWorking: false } : d)))).toBe(false);
  });
});
