// ═══════════════════════════════════════════════════════════════════════════
// WS-1C message catalogue. Arabic is written first; English follows it.
//
// These are the canonical bodies of the WhatsApp utility templates the owner
// submits to Meta (see META_TEMPLATES / metaTemplateDrafts()). Meta matches
// the approved text exactly, so this copy is versioned here with the engine
// (message_outbox.template_version) rather than in the UI dictionaries.
//
// Placeholders: {name} {shop} {services} {date} {time} {barber} {link}
// ═══════════════════════════════════════════════════════════════════════════
import type { AppointmentContext, MessageLocale, OutboxPayload, TemplateId } from "./types";

export const TEMPLATE_VERSION = 1;

type Copy = Record<MessageLocale, string>;

export const TEMPLATE_COPY: Record<Exclude<TemplateId, "schedule_change" | "appointment_cancelled" | "receipt" | "generic">, Copy> = {
  confirmation: {
    ar: "أهلاً {name}، وصلنا حجزك في {shop}: {services} يوم {date} الساعة {time}.\nللتأكيد أو تغيير الموعد أو الإلغاء: {link}",
    en: "Hi {name}, your booking at {shop} is in: {services} on {date} at {time}.\nConfirm, change or cancel here: {link}",
  },
  reminder: {
    ar: "تذكير من {shop}: موعدك {services} يوم {date} الساعة {time}.\nإذا تغيّرت خططك، عدّل الموعد من هنا: {link}",
    en: "Reminder from {shop}: your {services} is on {date} at {time}.\nPlans changed? Manage it here: {link}",
  },
  rescheduled: {
    ar: "تم تغيير موعدك في {shop}. الموعد الجديد: {services} يوم {date} الساعة {time}.\nالتفاصيل: {link}",
    en: "Your booking at {shop} has moved. New time: {services} on {date} at {time}.\nDetails: {link}",
  },
  cancelled: {
    ar: "تم إلغاء موعدك في {shop} ({services}، {date} الساعة {time}). يسعدنا حجزك مرة أخرى: {link}",
    en: "Your booking at {shop} ({services}, {date} at {time}) is cancelled. Book again anytime: {link}",
  },
  thank_you: {
    ar: "شكراً لزيارتك {shop} يا {name}! شاركنا رأيك بخدمة {services}: {link}",
    en: "Thanks for visiting {shop}, {name}! Tell us how your {services} went: {link}",
  },
  waitlist_offer: {
    ar: "خبر سار من {shop}: توفر موعد يوم {date} الساعة {time} لخدمة {services}. احجزه قبل أن يُحجز: {link}",
    en: "Good news from {shop}: a slot opened on {date} at {time} for {services}. Grab it before it goes: {link}",
  },
  opt_out_confirmation: {
    ar: "تم إيقاف الرسائل الترويجية والتذكيرات من {shop}. ستصلك فقط رسائل الحجوزات الضرورية. لإعادة التفعيل أرسل: اشتراك",
    en: "You won't get reminders or offers from {shop} anymore, only essential booking messages. To turn them back on, reply START.",
  },
};

/** Meta (WhatsApp Cloud API) template registry. Names get the env prefix. */
export interface MetaTemplateSpec {
  name: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  /** Body variables in {{1}}, {{2}}… order. */
  params: Array<"name" | "shop" | "services" | "date" | "time" | "barber">;
  /** Dynamic URL button whose suffix is the manage token (…/m/{{1}}). */
  manageButton: boolean;
  /** Quick-reply "Confirm" button (payload CONFIRM:<token>). */
  confirmButton: boolean;
}

export const META_TEMPLATES: Partial<Record<TemplateId, MetaTemplateSpec>> = {
  confirmation: { name: "booking_confirmation", category: "UTILITY", params: ["name", "shop", "services", "date", "time"], manageButton: true, confirmButton: true },
  reminder: { name: "booking_reminder", category: "UTILITY", params: ["shop", "services", "date", "time"], manageButton: true, confirmButton: true },
  rescheduled: { name: "booking_rescheduled", category: "UTILITY", params: ["shop", "services", "date", "time"], manageButton: true, confirmButton: false },
  cancelled: { name: "booking_cancelled", category: "UTILITY", params: ["shop", "services", "date", "time"], manageButton: false, confirmButton: false },
  thank_you: { name: "visit_thank_you", category: "UTILITY", params: ["shop", "name", "services"], manageButton: true, confirmButton: false },
  waitlist_offer: { name: "waitlist_slot_open", category: "UTILITY", params: ["shop", "date", "time", "services"], manageButton: false, confirmButton: false },
  opt_out_confirmation: { name: "opt_out_confirmation", category: "UTILITY", params: ["shop"], manageButton: false, confirmButton: false },
};

export interface RenderVars {
  name: string;
  shop: string;
  services: string;
  date: string;
  time: string;
  barber: string;
  link: string;
}

export function fill(template: string, vars: Partial<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""));
}

export function asLocale(v: unknown): MessageLocale {
  return v === "en" ? "en" : "ar";
}

/** Strip a trailing slash; empty string when unset. */
export function siteBase(siteUrl: string | null | undefined): string {
  return (siteUrl ?? "").trim().replace(/\/+$/, "");
}

export function manageUrl(siteUrl: string | null | undefined, locale: MessageLocale, token: string | null | undefined): string {
  if (!token) return "";
  return `${siteBase(siteUrl)}/${locale}/m/${encodeURIComponent(token)}`;
}

function shopUrl(siteUrl: string | null | undefined, locale: MessageLocale, slug: string | null | undefined): string {
  if (!slug) return siteBase(siteUrl);
  return `${siteBase(siteUrl)}/${locale}/shop/${encodeURIComponent(slug)}`;
}

/** "Sat 14 Nov" / "السبت 14 نوفمبر" and "5:30 pm" / "5:30 م", in the shop's zone, Latin digits. */
export function formatWhen(
  iso: string | null | undefined,
  locale: MessageLocale,
  timeZone = "Asia/Amman",
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const tag = locale === "ar" ? "ar-JO-u-nu-latn" : "en-GB";
  let zone = timeZone || "Asia/Amman";
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(d);
  } catch {
    zone = "Asia/Amman";
  }
  const date = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: zone }).format(d);
  const time = new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: zone,
  })
    .format(d)
    .replace(/\s?AM$/, " am")
    .replace(/\s?PM$/, " pm");
  return { date, time };
}

/** Values for a template from the appointment snapshot. */
export function renderVars(
  template: TemplateId,
  locale: MessageLocale,
  ctx: AppointmentContext | undefined,
  siteUrl?: string | null,
  extra?: Record<string, string | number>,
): RenderVars {
  const c = ctx ?? {};
  const when = formatWhen(c.start_time ?? null, locale, c.timezone ?? "Asia/Amman");
  const shop = (locale === "ar" ? c.shop_name_ar || c.shop_name : c.shop_name) ?? "";
  const services = (locale === "ar" ? c.services_ar || c.services : c.services) ?? "";
  let link = manageUrl(siteUrl, locale, c.token);
  if (template === "cancelled" || template === "waitlist_offer" || !link) link = shopUrl(siteUrl, locale, c.shop_slug);
  const vars: RenderVars = {
    name: (c.client_name ?? "").trim(),
    shop,
    services,
    date: when.date,
    time: when.time,
    barber: c.barber_name ?? "",
    link,
  };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (k in vars && (typeof v === "string" || typeof v === "number")) (vars as unknown as Record<string, string>)[k] = String(v);
    }
  }
  return vars;
}

/** Cleans up the gaps an empty variable leaves ("Hi , " → "Hi, "). */
function tidy(text: string): string {
  return text
    .replace(/ يا !/g, "!")
    .replace(/, !/g, "!")
    .replace(/[ \t]+([،,.!:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * The text of a message. Free-form templates (and anything queued with a
 * body) use the stored body; lifecycle templates render from the snapshot.
 */
export function renderMessage(
  msg: { template: TemplateId; locale?: string | null; body?: string | null; payload?: OutboxPayload | null },
  siteUrl?: string | null,
): string {
  const locale = asLocale(msg.locale);
  if (msg.body && msg.body.trim()) return msg.body.trim();
  const copy = (TEMPLATE_COPY as Record<string, Copy | undefined>)[msg.template];
  if (!copy) return "";
  const vars = renderVars(msg.template, locale, msg.payload?.ctx, siteUrl, msg.payload?.vars);
  return tidy(fill(copy[locale], vars as unknown as Record<string, string>));
}

/** Meta template body with {{1}}… placeholders, for submission. */
export function metaBody(template: TemplateId, locale: MessageLocale): string | null {
  const spec = META_TEMPLATES[template];
  const copy = (TEMPLATE_COPY as Record<string, Copy | undefined>)[template];
  if (!spec || !copy) return null;
  const map: Record<string, string> = {};
  spec.params.forEach((p, i) => (map[p] = `{{${i + 1}}}`));
  // The link moves to a button in the approved template.
  const text = copy[locale].replace(/[:：]?\s*\{link\}/g, "").replace(/\n\s*$/g, "");
  return fill(text, map).trim();
}

export interface MetaTemplateDraft {
  name: string;
  category: MetaTemplateSpec["category"];
  language: "ar" | "en";
  body: string;
  example: string[];
  buttons: Array<{ type: "URL"; text: string; url: string } | { type: "QUICK_REPLY"; text: string }>;
}

const EXAMPLE: Record<MessageLocale, Record<string, string>> = {
  ar: { name: "أحمد", shop: "صالون الأناقة", services: "حلاقة + دقن", date: "السبت 14 نوفمبر", time: "5:30 م", barber: "سامر" },
  en: { name: "Ahmad", shop: "Elegance Barbers", services: "Haircut + Beard", date: "Saturday 14 November", time: "5:30 pm", barber: "Samer" },
};

const BUTTON_TEXT: Record<MessageLocale, { manage: string; confirm: string }> = {
  ar: { manage: "إدارة الحجز", confirm: "تأكيد الحضور" },
  en: { manage: "Manage booking", confirm: "Confirm" },
};

/** Day-1 deliverable: the AR/EN utility templates to submit to Meta. */
export function metaTemplateDrafts(siteUrl = "https://halaqy.com", prefix = "halaqy_"): MetaTemplateDraft[] {
  const out: MetaTemplateDraft[] = [];
  for (const [id, spec] of Object.entries(META_TEMPLATES) as Array<[TemplateId, MetaTemplateSpec]>) {
    for (const language of ["ar", "en"] as const) {
      const body = metaBody(id, language);
      if (!body) continue;
      const buttons: MetaTemplateDraft["buttons"] = [];
      if (spec.manageButton) buttons.push({ type: "URL", text: BUTTON_TEXT[language].manage, url: `${siteBase(siteUrl)}/${language}/m/{{1}}` });
      if (spec.confirmButton) buttons.push({ type: "QUICK_REPLY", text: BUTTON_TEXT[language].confirm });
      out.push({
        name: `${prefix}${spec.name}`,
        category: spec.category,
        language,
        body,
        example: spec.params.map((p) => EXAMPLE[language][p]),
        buttons,
      });
    }
  }
  return out;
}
