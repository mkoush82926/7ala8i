import { describe, it, expect } from "vitest";
import {
  cancellationState,
  classifyAppointment,
  errorMessageFor,
  isValidOptionalPhone,
  rebookingNudge,
  rpcErrorCode,
} from "./customer-utils";

const now = new Date("2026-11-12T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

describe("classifyAppointment", () => {
  it("upcoming means active and strictly in the future", () => {
    expect(classifyAppointment({ status: "confirmed", start_time: inHours(1) }, now)).toBe("upcoming");
    expect(classifyAppointment({ status: "pending", start_time: inHours(-1) }, now)).toBe("past");
    expect(classifyAppointment({ status: "completed", start_time: inHours(5) }, now)).toBe("past");
    expect(classifyAppointment({ status: "cancelled", start_time: inHours(5) }, now)).toBe("cancelled");
    expect(classifyAppointment({ status: "no-show", start_time: inHours(5) }, now)).toBe("past");
  });
});

describe("cancellationState", () => {
  it("allows cancelling outside the policy window", () => {
    const s = cancellationState({ status: "confirmed", start_time: inHours(30), cancellation_policy_hours: 24 }, now);
    expect(s.canCancel).toBe(true);
    expect(s.deadline?.toISOString()).toBe(inHours(6));
  });
  it("blocks inside the window, after start, and for terminal statuses", () => {
    expect(cancellationState({ status: "confirmed", start_time: inHours(10), cancellation_policy_hours: 24 }, now).reason).toBe("inside_window");
    expect(cancellationState({ status: "pending", start_time: inHours(-1) }, now).reason).toBe("started");
    expect(cancellationState({ status: "completed", start_time: inHours(48) }, now).reason).toBe("status");
  });
  it("has no deadline without a policy", () => {
    const s = cancellationState({ status: "pending", start_time: inHours(1), cancellation_policy_hours: 0 }, now);
    expect(s).toMatchObject({ canCancel: true, deadline: null });
  });
});

describe("errors", () => {
  it("extracts DB error codes only", () => {
    expect(rpcErrorCode({ code: "P0001", message: "SLOT_TAKEN" })).toBe("SLOT_TAKEN");
    expect(rpcErrorCode({ message: "permission denied for table x" })).toBeNull();
    expect(rpcErrorCode(null)).toBeNull();
  });
  it("maps codes to localized text with a fallback", () => {
    const dict = { message: "Generic", codes: { APPT_NOT_FOUND: "Not found" } };
    expect(errorMessageFor(dict, "APPT_NOT_FOUND")).toBe("Not found");
    expect(errorMessageFor(dict, "OTHER")).toBe("Generic");
    expect(errorMessageFor({ message: "Generic" }, "X")).toBe("Generic");
  });
});

describe("rebookingNudge", () => {
  const base = { barber_id: "b1", barber_name: "Sami", shop_id: "s1" };
  it("nudges when overdue for the usual cadence", () => {
    const appts = [
      { ...base, status: "completed", start_time: "2026-08-01T10:00:00Z" },
      { ...base, status: "completed", start_time: "2026-09-01T10:00:00Z" },
    ];
    expect(rebookingNudge(appts, now)).toEqual({ shopId: "s1", barberName: "Sami" });
  });
  it("needs two completed visits", () => {
    expect(rebookingNudge([{ ...base, status: "completed", start_time: "2026-08-01T10:00:00Z" }], now)).toBeNull();
  });
});

describe("isValidOptionalPhone", () => {
  it("accepts empty or 7–15 digits", () => {
    expect(isValidOptionalPhone("")).toBe(true);
    expect(isValidOptionalPhone("+962 79 123 4567")).toBe(true);
    expect(isValidOptionalPhone("12345")).toBe(false);
    expect(isValidOptionalPhone("abc1234567")).toBe(false);
  });
});
