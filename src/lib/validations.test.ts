import { describe, it, expect } from "vitest";
import {
  CancelBookingSchema,
  UpdateStatusSchema,
  CreateBookingSchema,
  CompleteSaleSchema,
  ReviewSchema,
  LeadSchema,
  PhoneSchema,
  SignupRoleSchema,
  fieldErrors,
  firstError,
} from "./validations";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("CancelBookingSchema", () => {
  it("accepts a valid appointment id with no reason", () => {
    const result = CancelBookingSchema.safeParse({ appointment_id: UUID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("");
  });

  it("rejects a non-UUID appointment id", () => {
    expect(CancelBookingSchema.safeParse({ appointment_id: "nope" }).success).toBe(false);
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(CancelBookingSchema.safeParse({ appointment_id: UUID, reason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("UpdateStatusSchema", () => {
  it("accepts each valid status value (canonical no_show)", () => {
    for (const status of ["confirmed", "completed", "no_show", "cancelled"]) {
      expect(UpdateStatusSchema.safeParse({ appointment_id: UUID, status }).success).toBe(true);
    }
  });

  it("rejects the legacy 'no-show' spelling and unknown values", () => {
    for (const status of ["no-show", "archived", "pending"]) {
      expect(UpdateStatusSchema.safeParse({ appointment_id: UUID, status }).success).toBe(false);
    }
  });

  it("rejects a non-UUID appointment id", () => {
    expect(UpdateStatusSchema.safeParse({ appointment_id: "nope", status: "confirmed" }).success).toBe(false);
  });
});

describe("CreateBookingSchema", () => {
  const base = {
    shopId: UUID,
    serviceIds: [UUID2],
    clientName: "  Yousef  ",
    clientPhone: "+962 79 111 2233",
    startTime: "2030-01-01T10:00:00.000Z",
  };

  it("accepts a minimal booking and normalises fields", () => {
    const r = CreateBookingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.clientName).toBe("Yousef");
    expect(r.data.barberId).toBeNull();
    expect(r.data.source).toBe("online");
  });

  it("maps 'any' barber to null and keeps a real uuid", () => {
    expect(CreateBookingSchema.parse({ ...base, barberId: "any" }).barberId).toBeNull();
    expect(CreateBookingSchema.parse({ ...base, barberId: UUID2 }).barberId).toBe(UUID2);
  });

  it("rejects a non-uuid barber id", () => {
    expect(CreateBookingSchema.safeParse({ ...base, barberId: "bob" }).success).toBe(false);
  });

  it("requires at least one service and de-duplicates", () => {
    expect(CreateBookingSchema.safeParse({ ...base, serviceIds: [] }).success).toBe(false);
    expect(CreateBookingSchema.parse({ ...base, serviceIds: [UUID2, UUID2] }).serviceIds).toEqual([UUID2]);
  });

  it("does not carry client-supplied price or end time", () => {
    const parsed = CreateBookingSchema.parse({ ...base, totalPrice: 0, endTime: "2030-01-01T10:01:00.000Z" });
    expect(parsed).not.toHaveProperty("totalPrice");
    expect(parsed).not.toHaveProperty("endTime");
  });

  it("accepts an offset timestamp and rejects garbage", () => {
    expect(CreateBookingSchema.safeParse({ ...base, startTime: "2030-01-01T10:00:00+03:00" }).success).toBe(true);
    expect(CreateBookingSchema.safeParse({ ...base, startTime: "tomorrow" }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(CreateBookingSchema.safeParse({ ...base, source: "spam" }).success).toBe(false);
  });
});

describe("PhoneSchema", () => {
  it("requires 7–15 digits", () => {
    expect(PhoneSchema.safeParse("+962791112233").success).toBe(true);
    expect(PhoneSchema.safeParse("(((---)))").success).toBe(false);
    expect(PhoneSchema.safeParse("1234567890123456").success).toBe(false);
  });
});

describe("CompleteSaleSchema / ReviewSchema / LeadSchema", () => {
  it("validates payment methods", () => {
    expect(CompleteSaleSchema.safeParse({ appointment_id: UUID, payment_method: "cash" }).success).toBe(true);
    expect(CompleteSaleSchema.safeParse({ appointment_id: UUID, payment_method: "bitcoin" }).success).toBe(false);
  });

  it("validates rating range and blanks empty comments", () => {
    expect(ReviewSchema.safeParse({ appointment_id: UUID, rating: 6 }).success).toBe(false);
    expect(ReviewSchema.parse({ appointment_id: UUID, rating: 5, comment: "  " }).comment).toBeUndefined();
  });

  it("uses the canonical lead stages", () => {
    expect(LeadSchema.safeParse({ name: "Basel", stage: "regular" }).success).toBe(true);
    expect(LeadSchema.safeParse({ name: "Basel", stage: "loyal" }).success).toBe(false);
  });
});

describe("SignupRoleSchema", () => {
  it("whitelists customer and shop_admin, everything else becomes customer", () => {
    expect(SignupRoleSchema.parse("shop_admin")).toBe("shop_admin");
    expect(SignupRoleSchema.parse("barber")).toBe("customer");
    expect(SignupRoleSchema.parse(undefined)).toBe("customer");
  });
});

describe("fieldErrors / firstError", () => {
  it("flattens issues by path", () => {
    const r = CreateBookingSchema.safeParse({ shopId: "x" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const fe = fieldErrors(r.error);
    expect(Object.keys(fe)).toContain("shopId");
    expect(typeof firstError(r.error)).toBe("string");
  });
});
