// ═══════════════════════════════════════════════════════
// Shared types for the Halaqy application
// These replace the types previously in mock-data.ts
// ═══════════════════════════════════════════════════════

// ─── Canonical enums (single source of truth; mirror the DB CHECKs in
//     supabase/migrations/20250101001600_production_hardening.sql) ───

/** Appointment status. The DB only accepts these spellings ('no_show', never 'no-show'). */
export const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy a barber's time (used for availability / overlap). */
export const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed"] as const satisfies readonly AppointmentStatus[];

/** Terminal statuses — no further transitions allowed. */
export const TERMINAL_APPOINTMENT_STATUSES = ["completed", "no_show", "cancelled"] as const satisfies readonly AppointmentStatus[];

/** Allowed staff-driven status transitions (shared by the status API and calendar UI). */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ["confirmed", "completed", "cancelled", "no_show"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  no_show: [],
  cancelled: [],
};

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

/** Maps legacy spellings ("no-show") to the canonical value; unknown → null. */
export function normalizeAppointmentStatus(value: unknown): AppointmentStatus | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[-\s]/g, "_");
  if (v === "noshow") return "no_show";
  if (v === "canceled") return "cancelled";
  return isAppointmentStatus(v) ? v : null;
}

export const USER_ROLES = ["shop_admin", "barber", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const STAFF_ROLES = ["shop_admin", "barber"] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PAYMENT_METHODS = ["cash", "card", "online", "mixed"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BOOKING_SOURCES = ["online", "instagram", "google", "word_of_mouth", "walk_in", "whatsapp", "other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const LEAD_STAGES = ["new", "contacted", "booked", "completed", "regular"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const NOTIFICATION_TYPES = ["booking_created", "booking_status_changed", "booking_cancelled_by_customer"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  value?: number | null;
  stage: LeadStage;
  notes?: string | null;
  avatar?: string;
  createdAt: string;
  contact?: string | null;
}

export interface ChartDataPoint {
  label: string;
  revenue: number;
  bookings: number;
}
