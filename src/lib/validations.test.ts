import { describe, it, expect } from "vitest";
import { CancelBookingSchema, UpdateStatusSchema } from "./validations";

describe("CancelBookingSchema", () => {
  it("accepts a valid appointment id with no reason", () => {
    const result = CancelBookingSchema.safeParse({
      appointment_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("");
  });

  it("rejects a non-UUID appointment id", () => {
    const result = CancelBookingSchema.safeParse({ appointment_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a reason longer than 500 characters", () => {
    const result = CancelBookingSchema.safeParse({
      appointment_id: "11111111-1111-4111-8111-111111111111",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateStatusSchema", () => {
  it("accepts each valid status value", () => {
    for (const status of ["confirmed", "completed", "no-show", "cancelled"]) {
      const result = UpdateStatusSchema.safeParse({
        appointment_id: "11111111-1111-4111-8111-111111111111",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid status value", () => {
    const result = UpdateStatusSchema.safeParse({
      appointment_id: "11111111-1111-4111-8111-111111111111",
      status: "archived",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID appointment id", () => {
    const result = UpdateStatusSchema.safeParse({
      appointment_id: "nope",
      status: "confirmed",
    });
    expect(result.success).toBe(false);
  });
});
