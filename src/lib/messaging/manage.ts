// ═══════════════════════════════════════════════════════════════════════════
// Pure helpers for the logged-out manage page (/[locale]/m/[token]).
// The page talks to the token RPCs from 20250101003100_messaging_triggers.sql:
//   get_booking_by_token(p_token)                       → jsonb | null
//   confirm_by_token(p_token)                           → {appointment_id, status}
//   cancel_by_token(p_token, p_reason)                  → {appointment_id, status, cancelled_at}
//   reschedule_by_token(p_token, p_date, p_start, p_barber_id) → {…, start_time, end_time}
// None of them ever return a phone number of the client.
// ═══════════════════════════════════════════════════════════════════════════
import type { CalendarEvent } from "./calendar";
import type { MessageLocale } from "./types";

/** Same shape as messaging_token_valid() in SQL. */
export const MANAGE_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isManageToken(v: unknown): v is string {
  return typeof v === "string" && MANAGE_TOKEN_RE.test(v);
}

export interface ManageItem {
  serviceId: string | null;
  name: string;
  nameAr: string;
  duration: number | null;
  price: number | null;
}

export interface ManageShop {
  id: string;
  name: string;
  nameAr: string;
  slug: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  landmarkEn: string | null;
  landmarkAr: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
}

export interface ManageBooking {
  appointmentId: string;
  status: string;
  startTime: string;
  endTime: string;
  timezone: string;
  price: number | null;
  currency: string;
  clientName: string;
  barber: { id: string; name: string; avatarUrl: string | null } | null;
  items: ManageItem[];
  serviceIds: string[];
  shop: ManageShop;
  policy: { hours: number; feePercent: number; deadline: string | null };
  canConfirm: boolean;
  canCancel: boolean;
  canReschedule: boolean;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** get_booking_by_token() payload → typed booking, or null when unusable. */
export function parseManageBooking(data: unknown): ManageBooking | null {
  const d = obj(data);
  const id = str(d.appointment_id);
  const start = str(d.start_time);
  const end = str(d.end_time);
  if (!id || !start || !end) return null;
  const s = obj(d.shop);
  const b = obj(d.barber);
  const p = obj(d.policy);
  const items = (Array.isArray(d.items) ? d.items : []).map((raw): ManageItem => {
    const it = obj(raw);
    const name = str(it.name) ?? "";
    return {
      serviceId: str(it.service_id),
      name,
      nameAr: str(it.name_ar) ?? name,
      duration: num(it.duration),
      price: num(it.price),
    };
  });
  const serviceIds = (Array.isArray(d.service_ids) ? d.service_ids : [])
    .map((x) => (typeof x === "string" ? x : null))
    .filter((x): x is string => !!x);
  const shopName = str(s.name) ?? "";
  return {
    appointmentId: id,
    status: str(d.status) ?? "pending",
    startTime: start,
    endTime: end,
    timezone: str(d.timezone) ?? "Asia/Amman",
    price: num(d.price),
    currency: str(d.currency) ?? "JOD",
    clientName: str(d.client_name) ?? "",
    barber: str(b.id) ? { id: String(b.id), name: str(b.name) ?? "", avatarUrl: str(b.avatar_url) } : null,
    items,
    serviceIds: serviceIds.length ? serviceIds : items.map((i) => i.serviceId).filter((x): x is string => !!x),
    shop: {
      id: str(s.id) ?? "",
      name: shopName,
      nameAr: str(s.name_ar) ?? shopName,
      slug: str(s.slug),
      phone: str(s.phone),
      whatsapp: str(s.whatsapp),
      address: str(s.address),
      landmarkEn: str(s.landmark_en),
      landmarkAr: str(s.landmark_ar),
      lat: num(s.lat),
      lng: num(s.lng),
      googleMapsUrl: str(s.google_maps_url),
    },
    policy: {
      hours: Math.max(0, num(p.hours) ?? 0),
      feePercent: Math.max(0, num(p.fee_percent) ?? 0),
      deadline: str(p.deadline),
    },
    canConfirm: d.can_confirm === true,
    canCancel: d.can_cancel === true,
    canReschedule: d.can_reschedule === true,
  };
}

/** Upper-case RPC error code (P0001 message), else null. */
export function rpcErrorCode(err: unknown): string | null {
  const m = (obj(err).message ?? "") as unknown;
  return typeof m === "string" && /^[A-Z][A-Z_]{2,40}$/.test(m) ? m : null;
}

export function shopNameFor(shop: Pick<ManageShop, "name" | "nameAr">, locale: MessageLocale): string {
  return (locale === "ar" ? shop.nameAr || shop.name : shop.name || shop.nameAr) || "";
}

export function servicesLabel(items: ManageItem[], locale: MessageLocale): string {
  return items
    .map((i) => (locale === "ar" ? i.nameAr || i.name : i.name || i.nameAr))
    .filter(Boolean)
    .join(" + ");
}

/** Where the booking stands, for the page's status banner. */
export type ManageState = "upcoming" | "pending" | "cancelled" | "completed" | "no_show" | "past" | "in_progress";

export function manageState(b: Pick<ManageBooking, "status" | "startTime" | "endTime">, now: Date = new Date()): ManageState {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "completed") return "completed";
  if (b.status === "no_show") return "no_show";
  if (b.status === "arrived" || b.status === "in_chair") return "in_progress";
  if (new Date(b.startTime).getTime() <= now.getTime()) return "past";
  return b.status === "pending" || b.status === "awaiting_deposit" ? "pending" : "upcoming";
}

/** Calendar entry for "Add to calendar". */
export function bookingCalendarEvent(
  b: ManageBooking,
  opts: { locale: MessageLocale; title: string; url?: string; description?: string },
): CalendarEvent {
  const landmark = opts.locale === "ar" ? b.shop.landmarkAr || b.shop.landmarkEn : b.shop.landmarkEn || b.shop.landmarkAr;
  const location = [shopNameFor(b.shop, opts.locale), b.shop.address, landmark].filter(Boolean).join(", ");
  return {
    uid: `${b.appointmentId}@halaqy`,
    start: b.startTime,
    end: b.endTime,
    title: opts.title,
    description: opts.description ?? servicesLabel(b.items, opts.locale),
    location: location || undefined,
    url: opts.url,
  };
}

/** "YYYY-MM-DD" in a time zone (Latin digits). */
export function localDateIn(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA-u-nu-latn", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-CA-u-nu-latn", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  }
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** The next `count` shop-local dates starting today (for the reschedule picker). */
export function rescheduleDates(now: Date, timeZone: string, count = 14): string[] {
  const today = localDateIn(now, timeZone);
  return Array.from({ length: Math.max(1, Math.min(62, count)) }, (_, i) => addDays(today, i));
}

/** Hours left before the free-cancellation deadline (0 when passed / none). */
export function hoursUntil(deadline: string | null, now: Date = new Date()): number {
  if (!deadline) return 0;
  const ms = new Date(deadline).getTime() - now.getTime();
  return ms > 0 ? Math.floor(ms / 3_600_000) : 0;
}
