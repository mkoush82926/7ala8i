import { describe, it, expect } from "vitest";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_TRANSITIONS,
  isAppointmentStatus,
  normalizeAppointmentStatus,
} from "./types";

describe("appointment status enum", () => {
  it("uses 'no_show' as the canonical spelling", () => {
    expect(APPOINTMENT_STATUSES).toContain("no_show");
    expect(APPOINTMENT_STATUSES).not.toContain("no-show" as never);
  });

  it("normalises legacy spellings", () => {
    expect(normalizeAppointmentStatus("no-show")).toBe("no_show");
    expect(normalizeAppointmentStatus("No Show")).toBe("no_show");
    expect(normalizeAppointmentStatus("canceled")).toBe("cancelled");
    expect(normalizeAppointmentStatus("archived")).toBeNull();
  });

  it("guards unknown values", () => {
    expect(isAppointmentStatus("confirmed")).toBe(true);
    expect(isAppointmentStatus("no-show")).toBe(false);
  });

  it("treats completed / no_show / cancelled as terminal", () => {
    expect(APPOINTMENT_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.no_show).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.confirmed).toContain("no_show");
  });
});
