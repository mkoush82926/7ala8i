// Shared messaging types. Template ids mirror public.messaging_template_known().

export type MessageChannel = "whatsapp" | "sms";
export type OutboxChannel = MessageChannel | "wa_link";
export type MessageLocale = "en" | "ar";

/** Templates the engine queues itself (appointment lifecycle, opt-out). */
export const LIFECYCLE_TEMPLATES = [
  "confirmation",
  "reminder",
  "rescheduled",
  "cancelled",
  "thank_you",
  "waitlist_offer",
  "opt_out_confirmation",
] as const;

/** Templates other workstreams queue with a ready body (1E/1F contract). */
export const FREEFORM_TEMPLATES = ["schedule_change", "appointment_cancelled", "receipt", "generic"] as const;

export const TEMPLATE_IDS = [...LIFECYCLE_TEMPLATES, ...FREEFORM_TEMPLATES] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Template ids callers of enqueueMessage() may use. */
export type MessageTemplate = "schedule_change" | "appointment_cancelled" | "receipt" | "generic" | "waitlist_offer";

/** Non-transactional: STOP / إلغاء stops them (messaging_template_optional). */
export const OPTIONAL_TEMPLATES: readonly TemplateId[] = ["reminder", "thank_you", "waitlist_offer", "generic"];

/** Held back during quiet hours (messaging_template_deferrable). */
export const DEFERRABLE_TEMPLATES: readonly TemplateId[] = ["reminder", "thank_you", "waitlist_offer"];

export const OUTBOX_STATUSES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "fallback",
  "skipped",
  "cancelled",
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** Snapshot stored in message_outbox.payload.ctx (messaging_appointment_context). */
export interface AppointmentContext {
  appointment_id?: string;
  token?: string | null;
  status?: string | null;
  shop_id?: string;
  shop_name?: string | null;
  shop_name_ar?: string | null;
  shop_phone?: string | null;
  shop_slug?: string | null;
  maps_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  client_id?: string | null;
  client_name?: string | null;
  phone?: string | null;
  locale?: string | null;
  barber_name?: string | null;
  services?: string | null;
  services_ar?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  date?: string | null;
  time?: string | null;
  timezone?: string | null;
}

export interface OutboxPayload {
  ctx?: AppointmentContext;
  offset?: number;
  manual?: boolean;
  vars?: Record<string, string | number>;
}

/** One row returned by messaging_claim(). */
export interface ClaimedMessage {
  id: string;
  shop_id: string;
  appointment_id: string | null;
  to: string;
  channel: OutboxChannel;
  template: TemplateId;
  template_version: number;
  category: "utility" | "authentication" | "marketing";
  locale: MessageLocale;
  payload: OutboxPayload | null;
  body: string | null;
  offset_minutes: number;
  attempts: number;
  sms_fallback: boolean;
  session_open: boolean;
}

export interface ClaimResult {
  claimed: ClaimedMessage[];
  fallback: number;
  deferred: number;
  skipped: number;
  cancelled: number;
  recovered: number;
}

/** Structural Supabase client (rpc only) so tests can pass a fake. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}
