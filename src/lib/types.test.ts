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

describe("marketplace statuses (WS-P0)", () => {
  it("adds arrived / in_chair / awaiting_deposit and keeps the existing values", async () => {
    const { APPOINTMENT_STATUSES: all } = await import("./types");
    for (const s of ["pending", "confirmed", "completed", "no_show", "cancelled", "arrived", "in_chair", "awaiting_deposit"]) {
      expect(all).toContain(s);
    }
    expect(all).toHaveLength(8);
  });

  it("treats the new statuses as time-occupying", async () => {
    const { isActiveAppointmentStatus } = await import("./types");
    expect(isActiveAppointmentStatus("arrived")).toBe(true);
    expect(isActiveAppointmentStatus("in_chair")).toBe(true);
    expect(isActiveAppointmentStatus("awaiting_deposit")).toBe(true);
    expect(isActiveAppointmentStatus("completed")).toBe(false);
  });

  it("defines a transition list for every status and only to known statuses", async () => {
    const { APPOINTMENT_STATUSES: all, APPOINTMENT_STATUS_TRANSITIONS: tr, canTransitionAppointment } = await import("./types");
    expect(Object.keys(tr).sort()).toEqual([...all].sort());
    for (const targets of Object.values(tr)) for (const t of targets) expect(all).toContain(t);
    expect(canTransitionAppointment("confirmed", "arrived")).toBe(true);
    expect(canTransitionAppointment("arrived", "in_chair")).toBe(true);
    expect(canTransitionAppointment("in_chair", "completed")).toBe(true);
    expect(canTransitionAppointment("in_chair", "no_show")).toBe(false);
    expect(canTransitionAppointment("awaiting_deposit", "confirmed")).toBe(true);
    expect(canTransitionAppointment("completed", "confirmed")).toBe(false);
  });

  it("normalises check-in spellings", () => {
    expect(normalizeAppointmentStatus("in-chair")).toBe("in_chair");
    expect(normalizeAppointmentStatus("checked in")).toBe("arrived");
    expect(normalizeAppointmentStatus("awaiting-deposit")).toBe("awaiting_deposit");
  });
});
