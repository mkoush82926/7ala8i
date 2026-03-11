import { z } from "zod";

// ─── Phone validation (E.164 or common formats) ───
const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

// ─── Booking ───
export const BookingSchema = z.object({
  shop_id: z.string().uuid("Invalid shop ID"),
  client_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  client_phone: z
    .string()
    .regex(phoneRegex, "Invalid phone number format"),
  service_ids: z
    .array(z.string().uuid("Invalid service ID"))
    .min(1, "Select at least one service"),
  barber_id: z.union([
    z.string().uuid("Invalid barber ID"),
    z.literal("any"),
  ]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:mm"),
  hear_about_us: z
    .string()
    .max(100)
    .optional()
    .default(""),
});

export type BookingInput = z.infer<typeof BookingSchema>;

// ─── Cancel Booking ───
export const CancelBookingSchema = z.object({
  appointment_id: z.string().uuid("Invalid appointment ID"),
  reason: z
    .string()
    .max(500, "Reason is too long")
    .optional()
    .default(""),
});

export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

// ─── Update Appointment Status (POS) ───
export const UpdateStatusSchema = z.object({
  appointment_id: z.string().uuid("Invalid appointment ID"),
  status: z.enum(["confirmed", "completed", "no-show", "cancelled"], {
    message: "Invalid status value",
  }),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

// ─── Service Management ───
export const ServiceSchema = z.object({
  name: z
    .string()
    .min(2, "Service name must be at least 2 characters")
    .max(100, "Service name is too long"),
  name_ar: z.string().max(100).optional().nullable(),
  duration: z
    .number()
    .int()
    .min(5, "Duration must be at least 5 minutes")
    .max(300, "Duration cannot exceed 300 minutes"),
  price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(9999, "Price cannot exceed 9999"),
});

export type ServiceInput = z.infer<typeof ServiceSchema>;

// ─── Lead ───
export const LeadSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100),
  contact: z.string().max(200).optional().nullable(),
  stage: z
    .enum(["new", "contacted", "booked", "completed", "regular"])
    .default("new"),
  value: z.number().min(0).max(99999).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type LeadInput = z.infer<typeof LeadSchema>;

// ─── Invite ───
export const InviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["barber", "shop_admin"]).default("barber"),
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100),
});

export type InviteInput = z.infer<typeof InviteSchema>;
