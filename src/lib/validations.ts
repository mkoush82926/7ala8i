import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  BOOKING_SOURCES,
  LEAD_STAGES,
  PAYMENT_METHODS,
} from "@/lib/types";

// Re-exported so API routes and UI can import enums and schemas from one place.
export { APPOINTMENT_STATUSES, BOOKING_SOURCES, LEAD_STAGES, PAYMENT_METHODS };

// ─── Shared primitives ───

/** Phone in E.164 or common local formats; must contain 7–15 digits. */
export const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
export const PhoneSchema = z
  .string()
  .trim()
  .regex(phoneRegex, "Invalid phone number format")
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Invalid phone number format");

/** Display name: trimmed, 2–100 chars, no control characters. */
export const PersonNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long")
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Name contains invalid characters");

export const UuidSchema = z.string().uuid("Invalid ID");

/** Optional free text: trimmed, empty string → undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Text is too long")
    .optional()
    .transform((v) => (v ? v : undefined));

// ─── Status enums ───
export const AppointmentStatusSchema = z.enum(APPOINTMENT_STATUSES, { message: "Invalid status value" });
export const LeadStageSchema = z.enum(LEAD_STAGES, { message: "Invalid stage" });
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS, { message: "Invalid payment method" });

// ─── Public booking (POST /api/booking → create_public_booking RPC) ───
// Price, end time and service names are NEVER accepted from the client; the
// RPC derives them from the database.
export const CreateBookingSchema = z.object({
  shopId: UuidSchema,
  serviceIds: z
    .array(UuidSchema)
    .min(1, "Select at least one service")
    .max(10, "Too many services selected")
    .transform((ids) => Array.from(new Set(ids))),
  /** null / undefined / "any" = let the server pick any free barber. */
  barberId: z
    .union([UuidSchema, z.literal("any")])
    .nullable()
    .optional()
    .transform((v) => (v && v !== "any" ? v : null)),
  clientName: PersonNameSchema,
  clientPhone: PhoneSchema,
  startTime: z
    .string()
    .datetime({ offset: true, message: "Start time must be a valid ISO date string" }),
  source: z
    .enum(BOOKING_SOURCES)
    .optional()
    .default("online"),
  notes: optionalText(500),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// Legacy wizard shape (date + time strings). Kept for existing callers.
export const BookingSchema = z.object({
  shop_id: UuidSchema,
  client_name: PersonNameSchema,
  client_phone: PhoneSchema,
  service_ids: z.array(UuidSchema).min(1, "Select at least one service").max(10),
  barber_id: z.union([UuidSchema, z.literal("any")]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  hear_about_us: z.string().trim().max(100).optional().default(""),
});

export type BookingInput = z.infer<typeof BookingSchema>;

// ─── Availability (GET /api/booking?shopId&date → get_busy_slots RPC) ───
export const AvailabilityQuerySchema = z.object({
  shopId: UuidSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  barberId: UuidSchema.optional(),
});

// ─── Cancel Booking (customer) ───
export const CancelBookingSchema = z.object({
  appointment_id: UuidSchema,
  reason: z
    .string()
    .trim()
    .max(500, "Reason is too long")
    .optional()
    .default(""),
});

export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

// ─── Update Appointment Status (staff) ───
// 'pending' is a creation state only; staff move appointments forward.
export const UpdateStatusSchema = z.object({
  appointment_id: UuidSchema,
  status: z.enum(["confirmed", "completed", "no_show", "cancelled"], {
    message: "Invalid status value",
  }),
  reason: z.string().trim().max(500).optional(),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

// ─── Complete + record sale (POS → complete_appointment_sale RPC) ───
export const CompleteSaleSchema = z.object({
  appointment_id: UuidSchema,
  payment_method: PaymentMethodSchema,
  amount: z.number().min(0).max(100000).optional(),
});

export type CompleteSaleInput = z.infer<typeof CompleteSaleSchema>;

// ─── Review (customer → submit_review RPC) ───
export const ReviewSchema = z.object({
  appointment_id: UuidSchema,
  rating: z.number().int().min(1, "Rating must be 1–5").max(5, "Rating must be 1–5"),
  comment: optionalText(1000),
});

export type ReviewInput = z.infer<typeof ReviewSchema>;

// ─── Service Management ───
export const ServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Service name must be at least 2 characters")
    .max(100, "Service name is too long"),
  name_ar: z.string().trim().max(100).optional().nullable(),
  duration: z
    .number()
    .int()
    .min(5, "Duration must be at least 5 minutes")
    .max(480, "Duration cannot exceed 480 minutes"),
  price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(9999, "Price cannot exceed 9999"),
});

export type ServiceInput = z.infer<typeof ServiceSchema>;

// ─── Lead ───
export const LeadSchema = z.object({
  name: PersonNameSchema,
  contact: z.string().trim().max(200).optional().nullable(),
  stage: LeadStageSchema.default("new"),
  value: z.number().min(0).max(99999).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type LeadInput = z.infer<typeof LeadSchema>;

// ─── Invite ───
export const InviteSchema = z.object({
  email: z.string().trim().email("Invalid email address").optional(),
  role: z.enum(["barber", "shop_admin"]).default("barber"),
  full_name: PersonNameSchema.optional(),
});

export type InviteInput = z.infer<typeof InviteSchema>;

export const InviteAcceptSchema = z.object({
  token: z.string().trim().min(16, "Invalid invite token").max(500, "Invalid invite token"),
});

// ─── Profile (self-service) ───
// shop_id / role are never client-editable (RLS rejects them).
export const ProfileUpdateSchema = z.object({
  full_name: PersonNameSchema.optional(),
  phone: PhoneSchema.optional().or(z.literal("").transform(() => undefined)),
  avatar_url: z.string().trim().url().max(500).optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// ─── Signup (role whitelist; 'barber' only via invite) ───
export const SignupRoleSchema = z.enum(["customer", "shop_admin"]).catch("customer");

// ─── Helpers ───

/** Flattened field errors safe to return to clients (messages only, no values). */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** First human-readable validation message (for a single toast/banner). */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input data";
}
