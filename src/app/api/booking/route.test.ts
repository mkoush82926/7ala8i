import { describe, it, expect } from "vitest";
import { bookingSchema } from "./route";

const validPayload = {
  shopId: "11111111-1111-4111-8111-111111111111",
  serviceIds: ["22222222-2222-4222-8222-222222222222"],
  barberId: null,
  clientName: "Ahmad Test",
  clientPhone: "+962 79 123 4567",
  startTime: "2026-09-01T10:00:00.000Z",
  endTime: "2026-09-01T10:30:00.000Z",
  totalPrice: 25,
  source: "online",
};

describe("bookingSchema", () => {
  it("accepts a fully valid booking payload", () => {
    const result = bookingSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload with only required fields", () => {
    const result = bookingSchema.safeParse({
      shopId: validPayload.shopId,
      clientName: "Ahmad",
      clientPhone: "+962791234567",
      startTime: validPayload.startTime,
      endTime: validPayload.endTime,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID shopId", () => {
    const result = bookingSchema.safeParse({ ...validPayload, shopId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a client name shorter than 2 characters", () => {
    const result = bookingSchema.safeParse({ ...validPayload, clientName: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = bookingSchema.safeParse({ ...validPayload, clientPhone: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO startTime", () => {
    const result = bookingSchema.safeParse({ ...validPayload, startTime: "2026-09-01" });
    expect(result.success).toBe(false);
  });

  it("rejects when endTime is before startTime", () => {
    const result = bookingSchema.safeParse({
      ...validPayload,
      startTime: "2026-09-01T10:30:00.000Z",
      endTime: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endTime?.[0]).toMatch(/after start time/i);
    }
  });

  it("rejects when endTime equals startTime", () => {
    const result = bookingSchema.safeParse({
      ...validPayload,
      endTime: validPayload.startTime,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative totalPrice", () => {
    const result = bookingSchema.safeParse({ ...validPayload, totalPrice: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a totalPrice above the maximum", () => {
    const result = bookingSchema.safeParse({ ...validPayload, totalPrice: 100001 });
    expect(result.success).toBe(false);
  });

  it("accepts barberId of 'any' as a plain string (route treats it specially at runtime)", () => {
    const result = bookingSchema.safeParse({ ...validPayload, barberId: "any" });
    expect(result.success).toBe(true);
  });
});
