// Pure form model for the catalogue editor (no React): string drafts →
// validated writes, with error keys under t.services.

import type {
  Audience,
  BookingRules,
  LocationType,
  PriceType,
  ServiceWrite,
  VariantDraft,
} from "@/lib/queries/services";
import type { ServiceItem } from "@/hooks/use-services";

export const MAX_VARIANTS = 20;
export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;
export const NOTICE_PRESETS = [0, 15, 30, 60, 120, 240, 720, 1440, 2880] as const;

export interface VariantForm {
  key: string;
  id: string | null;
  name_en: string;
  name_ar: string;
  price: string;
  duration: string;
}

export interface ServiceForm {
  name: string;
  name_ar: string;
  icon: string;
  duration: string;
  price: string;
  price_type: PriceType;
  audience: Audience;
  location_type: LocationType;
  category_id: string;
  description_en: string;
  description_ar: string;
  client_note_en: string;
  client_note_ar: string;
  online_bookable: boolean;
  buffer_minutes: string;
  processing_offset_minutes: string;
  processing_minutes: string;
  variants: VariantForm[];
}

/** Error keys (t.services.<key>). */
export type ServiceErrorKey =
  | "errName" | "errNameAr" | "errDuration" | "errPrice" | "errText" | "errBuffer" | "errProcessing"
  | "errVariantName" | "errVariantPrice" | "errVariantDuration";

export type ServiceField =
  | "name" | "name_ar" | "duration" | "price" | "description_en" | "description_ar"
  | "client_note_en" | "client_note_ar" | "buffer_minutes" | "processing";

export type ServiceErrors = Partial<Record<ServiceField, ServiceErrorKey>> & {
  variants?: Record<string, Partial<Record<"name_en" | "price" | "duration", ServiceErrorKey>>>;
};

let keySeq = 0;
export const newVariantKey = () => `v${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function emptyVariant(base?: { price: number; duration: number }): VariantForm {
  return {
    key: newVariantKey(),
    id: null,
    name_en: "",
    name_ar: "",
    price: base ? String(base.price) : "",
    duration: base ? String(base.duration) : "30",
  };
}

export function formFromService(s: ServiceItem | null): ServiceForm {
  return {
    name: s?.name ?? "",
    name_ar: s?.name_ar ?? "",
    icon: s?.icon || "✂️",
    duration: String(s?.duration ?? 30),
    price: s ? String(s.price) : "",
    price_type: s?.price_type ?? "fixed",
    audience: s?.audience ?? "everyone",
    location_type: s?.location_type ?? "in_shop",
    category_id: s?.category_id ?? "",
    description_en: s?.description_en ?? "",
    description_ar: s?.description_ar ?? "",
    client_note_en: s?.client_note_en ?? "",
    client_note_ar: s?.client_note_ar ?? "",
    online_bookable: s?.online_bookable ?? true,
    buffer_minutes: String(s?.buffer_minutes ?? 0),
    processing_offset_minutes: String(s?.processing_offset_minutes ?? 0),
    processing_minutes: String(s?.processing_minutes ?? 0),
    variants: (s?.variants ?? []).map((v) => ({
      key: v.id,
      id: v.id,
      name_en: v.name_en,
      name_ar: v.name_ar ?? "",
      price: String(v.price),
      duration: String(v.duration),
    })),
  };
}

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))));
const isInt = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
const isMoney = (n: number) => Number.isFinite(n) && n >= 0 && n <= 10000;
const text = (v: string) => (v.trim() ? v.trim() : null);

export interface ParsedService {
  write: ServiceWrite;
  variants: VariantDraft[];
}

/** Validates the form. Returns the write payload or the errors to show. */
export function parseServiceForm(form: ServiceForm): { ok: true; value: ParsedService } | { ok: false; errors: ServiceErrors } {
  const errors: ServiceErrors = {};
  const name = form.name.trim();
  const nameAr = form.name_ar.trim();
  const duration = num(form.duration);
  const free = form.price_type === "free";
  const price = free ? 0 : num(form.price);
  const buffer = num(form.buffer_minutes || "0");
  const offset = num(form.processing_offset_minutes || "0");
  const processing = num(form.processing_minutes || "0");

  if (name.length < 2 || name.length > 100) errors.name = "errName";
  if (nameAr.length > 100) errors.name_ar = "errNameAr";
  if (!isInt(duration, 5, 480)) errors.duration = "errDuration";
  if (!isMoney(price)) errors.price = "errPrice";
  if (form.description_en.trim().length > 1000) errors.description_en = "errText";
  if (form.description_ar.trim().length > 1000) errors.description_ar = "errText";
  if (form.client_note_en.trim().length > 500) errors.client_note_en = "errText";
  if (form.client_note_ar.trim().length > 500) errors.client_note_ar = "errText";
  if (!isInt(buffer, 0, 120)) errors.buffer_minutes = "errBuffer";
  if (
    !isInt(offset, 0, 480) || !isInt(processing, 0, 480) ||
    (processing > 0 && Number.isInteger(duration) && offset + processing >= duration)
  ) {
    errors.processing = "errProcessing";
  }

  const variants: VariantDraft[] = [];
  form.variants.slice(0, MAX_VARIANTS).forEach((v) => {
    const vErr: Partial<Record<"name_en" | "price" | "duration", ServiceErrorKey>> = {};
    const vName = v.name_en.trim() || v.name_ar.trim();
    const vPrice = free ? 0 : num(v.price);
    const vDuration = num(v.duration);
    if (!vName || vName.length > 100 || v.name_ar.trim().length > 100) vErr.name_en = "errVariantName";
    if (!isMoney(vPrice)) vErr.price = "errVariantPrice";
    if (!isInt(vDuration, 5, 480)) vErr.duration = "errVariantDuration";
    if (Object.keys(vErr).length) {
      errors.variants = { ...(errors.variants ?? {}), [v.key]: vErr };
      return;
    }
    variants.push({ id: v.id, name_en: vName, name_ar: text(v.name_ar), price: vPrice, duration: vDuration });
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      write: {
        name,
        name_ar: nameAr || null,
        icon: form.icon || null,
        duration,
        price,
        price_type: form.price_type,
        audience: form.audience,
        location_type: form.location_type,
        category_id: form.category_id || null,
        description_en: text(form.description_en),
        description_ar: text(form.description_ar),
        client_note_en: text(form.client_note_en),
        client_note_ar: text(form.client_note_ar),
        online_bookable: form.online_bookable,
        buffer_minutes: buffer,
        processing_offset_minutes: processing > 0 ? offset : 0,
        processing_minutes: processing,
      },
      variants,
    },
  };
}

/** First invalid field (for focus), in visual order. */
export function firstErrorField(errors: ServiceErrors): string | null {
  const order: ServiceField[] = [
    "name", "name_ar", "price", "duration", "description_en", "description_ar",
    "client_note_en", "client_note_ar", "buffer_minutes", "processing",
  ];
  const field = order.find((f) => errors[f]);
  if (field) return field;
  const vKey = errors.variants ? Object.keys(errors.variants)[0] : null;
  return vKey ? `variant-${vKey}` : null;
}

// ─── Booking rules ───

export interface RulesForm {
  min_notice_minutes: string;
  booking_window_days: string;
  slot_interval_minutes: string;
  important_info_en: string;
  important_info_ar: string;
}

export type RulesErrorKey = "errNotice" | "errWindow" | "errInterval" | "errText";

export function formFromRules(r: BookingRules): RulesForm {
  return {
    min_notice_minutes: String(r.min_notice_minutes),
    booking_window_days: String(r.booking_window_days),
    slot_interval_minutes: String(r.slot_interval_minutes),
    important_info_en: r.important_info_en ?? "",
    important_info_ar: r.important_info_ar ?? "",
  };
}

export function parseRulesForm(
  form: RulesForm,
): { ok: true; value: BookingRules } | { ok: false; errors: Partial<Record<keyof RulesForm, RulesErrorKey>> } {
  const errors: Partial<Record<keyof RulesForm, RulesErrorKey>> = {};
  const notice = num(form.min_notice_minutes);
  const windowDays = num(form.booking_window_days);
  const interval = num(form.slot_interval_minutes);
  if (!isInt(notice, 0, 20160)) errors.min_notice_minutes = "errNotice";
  if (!isInt(windowDays, 1, 365)) errors.booking_window_days = "errWindow";
  if (!isInt(interval, 5, 120)) errors.slot_interval_minutes = "errInterval";
  if (form.important_info_en.trim().length > 1000) errors.important_info_en = "errText";
  if (form.important_info_ar.trim().length > 1000) errors.important_info_ar = "errText";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      min_notice_minutes: notice,
      booking_window_days: windowDays,
      slot_interval_minutes: interval,
      important_info_en: text(form.important_info_en),
      important_info_ar: text(form.important_info_ar),
    },
  };
}
