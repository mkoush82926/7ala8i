import { z } from "zod";
import { PersonNameSchema, PhoneSchema, UuidSchema } from "@/lib/validations";

// ═══════════════════════════════════════════════════════
// POST /api/booking (v2). Superset of the legacy CreateBookingSchema:
//   legacy  { serviceIds[], source }                    → 8-arg RPC call
//   v2      { items[{serviceId, variantId?, note?}],
//             src?, entry?, otpToken?, captchaToken? }  → + p_items …
// Price, end time and names are NEVER accepted from the client.
// ═══════════════════════════════════════════════════════

/** Attribution tokens (?src= / ?entry=): lower-case, short, URL-safe. */
export const AttributionSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(40)
  .regex(/^[a-z0-9_.:-]*$/, "Invalid attribution value")
  .optional()
  .transform((v) => (v ? v : undefined));

export const BookingItemSchema = z.object({
  serviceId: UuidSchema,
  variantId: UuidSchema.nullable().optional().transform((v) => v ?? null),
  note: z
    .string()
    .trim()
    .max(300, "Note is too long")
    .optional()
    .transform((v) => (v ? v : null)),
});
export type BookingItemInput = z.infer<typeof BookingItemSchema>;

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Text is too long")
  .optional()
  .transform((v) => (v ? v : undefined));

export const CreateBookingV2Schema = z
  .object({
    shopId: UuidSchema,
    serviceIds: z.array(UuidSchema).max(10, "Too many services selected").optional(),
    items: z.array(BookingItemSchema).max(10, "Too many services selected").optional(),
    barberId: z
      .union([UuidSchema, z.literal("any")])
      .nullable()
      .optional()
      .transform((v) => (v && v !== "any" ? v : null)),
    clientName: PersonNameSchema,
    clientPhone: PhoneSchema,
    startTime: z.string().datetime({ offset: true, message: "Start time must be a valid ISO date string" }),
    /** Legacy field: one of BOOKING_SOURCES. Treated like src. */
    source: AttributionSchema,
    src: AttributionSchema,
    entry: AttributionSchema,
    notes: optionalNotes,
    otpToken: z.string().trim().max(128).regex(/^[a-f0-9]*$/i).optional().transform((v) => (v ? v : undefined)),
    captchaToken: z.string().trim().max(2048).optional().transform((v) => (v ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    const n = v.items?.length ?? v.serviceIds?.length ?? 0;
    if (n === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [v.items ? "items" : "serviceIds"], message: "Select at least one service" });
    }
  });

export type CreateBookingV2Input = z.infer<typeof CreateBookingV2Schema>;

/**
 * RPC arguments. A legacy payload (serviceIds, no v2 fields) produces exactly
 * the original 8 arguments so older deployments of the function still match.
 */
export function toRpcArgs(input: CreateBookingV2Input): Record<string, unknown> {
  const serviceIds = input.items
    ? Array.from(new Set(input.items.map((i) => i.serviceId)))
    : Array.from(new Set(input.serviceIds ?? []));
  const src = input.src ?? input.source ?? "online";
  const args: Record<string, unknown> = {
    p_shop_id: input.shopId,
    p_client_name: input.clientName,
    p_client_phone: input.clientPhone,
    p_service_ids: serviceIds,
    p_barber_id: input.barberId,
    p_start_time: input.startTime,
    p_source: src,
    p_notes: input.notes ?? null,
  };
  if (input.items) {
    args.p_items = input.items.map((i) => ({
      service_id: i.serviceId,
      ...(i.variantId ? { variant_id: i.variantId } : {}),
      ...(i.note ? { note: i.note } : {}),
    }));
  }
  if (input.entry) args.p_entry = input.entry;
  if (input.otpToken) args.p_otp_token = input.otpToken;
  if (input.captchaToken) args.p_captcha_token = "verified";
  return args;
}

// ─── Reschedule ───
export const RescheduleSchema = z.object({
  appointmentId: UuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  barberId: UuidSchema.nullable().optional().transform((v) => v ?? null),
});

// ─── OTP ───
export const OtpSendSchema = z.object({
  phone: PhoneSchema,
  locale: z.enum(["en", "ar"]).optional().default("ar"),
  captchaToken: z.string().trim().max(2048).optional(),
});

export const OtpVerifySchema = z.object({
  phone: PhoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
