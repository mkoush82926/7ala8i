// ═══════════════════════════════════════════════════════════════════════════
// Staff notification copy (WS-1K). Composes the push / WhatsApp text from the
// i18n strings (t.staffPush.*) — no user-facing literals live here.
// Pure: safe on server and client, and unit-tested with a fixture dictionary.
// ═══════════════════════════════════════════════════════════════════════════
import { joinMeta, numberIntlLocale, toFormatLocale } from "@/lib/format";
import type { StaffOutboxEvent } from "./events";

export type PushLocale = "en" | "ar";

/** Shape of t.staffPush in src/i18n/en.ts / ar.ts. */
export interface StaffPushDict {
  titles: Record<StaffOutboxEvent, string>;
  testBody: string;
  reassignedTitle: string;
  reassignedAwayTitle: string;
  movedFromTo: string;
  unknownClient: string;
  whatsappIntro: string;
  openLink: string;
}

export interface StaffJobPayload {
  client_name?: string | null;
  service_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  old_start_time?: string | null;
  timezone?: string | null;
  shop_name?: string | null;
  shop_name_ar?: string | null;
  source?: string | null;
  reassigned?: boolean | null;
  locale?: string | null;
}

export interface StaffJobLike {
  id: string;
  event: StaffOutboxEvent;
  appointment_id?: string | null;
  payload?: StaffJobPayload | null;
}

export interface StaffPushMessage {
  title: string;
  body: string;
  /** Locale-prefixed in-app path to open on tap. */
  url: string;
  /** Collapses repeat alerts about the same appointment on the device. */
  tag: string;
  lang: PushLocale;
  dir: "ltr" | "rtl";
  event: StaffOutboxEvent;
  appointmentId: string | null;
}

/** "Hello {name}" + {name: "Ahmad"} → "Hello Ahmad" (unknown keys kept). */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

const DEFAULT_TZ = "Asia/Amman";

function safeTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** "Thu 14 Nov, 5:30 pm" in the shop's time zone and the reader's digits. */
export function formatWhen(iso: string | null | undefined, locale: PushLocale, timeZone?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(numberIntlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTz(timeZone),
  }).format(d);
}

/** yyyy-MM-dd of `iso` in `timeZone` (for the calendar deep link). */
export function localDate(iso: string | null | undefined, timeZone?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: safeTz(timeZone),
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** In-app target: the calendar focused on the appointment's day. */
export function staffDeepLink(locale: PushLocale, appointmentId: string | null | undefined, startIso?: string | null, tz?: string | null): string {
  if (!appointmentId) return `/${locale}/my-day`;
  const q = new URLSearchParams();
  const date = localDate(startIso, tz);
  if (date) q.set("date", date);
  q.set("appt", appointmentId);
  return `/${locale}/calendar?${q.toString()}`;
}

function titleFor(job: StaffJobLike, dict: StaffPushDict): string {
  const p = job.payload ?? {};
  if (p.reassigned && job.event === "booking_cancelled") return dict.reassignedAwayTitle;
  if (p.reassigned && (job.event === "booking_new" || job.event === "walk_in_assigned" || job.event === "waitlist_filled")) {
    return dict.reassignedTitle;
  }
  return dict.titles[job.event] ?? dict.titles.booking_new;
}

/** Builds the notification for one outbox job in `locale`. */
export function buildStaffPushMessage(job: StaffJobLike, locale: string | null | undefined, dict: StaffPushDict): StaffPushMessage {
  const lang: PushLocale = toFormatLocale(locale);
  const p = job.payload ?? {};
  const tz = p.timezone ?? DEFAULT_TZ;
  const appointmentId = job.appointment_id ?? null;
  const base = {
    lang,
    dir: (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr",
    event: job.event,
    appointmentId,
  };

  if (job.event === "test") {
    return { ...base, title: dict.titles.test, body: dict.testBody, url: `/${lang}/settings/notifications`, tag: `halaqy-test-${job.id}` };
  }

  const client = (p.client_name ?? "").trim() || dict.unknownClient;
  const service = (p.service_name ?? "").trim();
  const when = formatWhen(p.start_time, lang, tz);
  const timePart =
    job.event === "booking_rescheduled" && p.old_start_time
      ? fill(dict.movedFromTo, { from: formatWhen(p.old_start_time, lang, tz), to: when })
      : when;
  const body = joinMeta([client, service, timePart]);

  return {
    ...base,
    title: titleFor(job, dict),
    body,
    url: staffDeepLink(lang, appointmentId, p.start_time, tz),
    tag: appointmentId ? `halaqy-appt-${appointmentId}` : `halaqy-${job.id}`,
  };
}

/** Plain-text WhatsApp fallback: "{intro}\n{title}\n{body}\n{link}". */
export function buildStaffWhatsAppText(
  message: StaffPushMessage,
  dict: StaffPushDict,
  shopName: string | null | undefined,
  siteOrigin?: string | null,
): string {
  const intro = fill(dict.whatsappIntro, { shop: (shopName ?? "").trim() || "Halaqy" });
  const link = siteOrigin ? `${dict.openLink} ${siteOrigin.replace(/\/+$/, "")}${message.url}` : "";
  return [intro, message.title, message.body, link].filter((s) => s.trim() !== "").join("\n");
}

/** JSON the service worker reads (public/sw.js). Kept small: push payloads are capped ~4 KB. */
export function toPushPayload(message: StaffPushMessage): string {
  return JSON.stringify({
    v: 1,
    title: message.title.slice(0, 120),
    body: message.body.slice(0, 400),
    url: message.url,
    tag: message.tag,
    lang: message.lang,
    dir: message.dir,
    event: message.event,
    appointmentId: message.appointmentId,
  });
}
