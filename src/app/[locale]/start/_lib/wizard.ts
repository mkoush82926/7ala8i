// Pure logic for the /start onboarding wizard (WS-1G): draft shape, resume,
// per-step validation, the create_shop_from_wizard payload and share links.
// No React and no Supabase here, so it is fully unit-tested.

import {
  BARBERSHOP_SERVICES,
  MAX_BARBERS,
  MAX_SERVICES,
  WEEK_ORDER_SAT_FIRST,
  defaultHours,
  normalizeDuration,
  normalizePrice,
  validateDayHours,
  type DayHours,
  type DayHoursError,
} from "@/lib/templates/barbershop";

export const WIZARD_STEPS = ["shop", "location", "services", "team", "hours", "publish"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface WizardService {
  id: string;
  /** Template key when the row came from the template. */
  key: string | null;
  nameAr: string;
  nameEn: string;
  duration: number;
  price: number;
  category: string | null;
  icon: string;
  selected: boolean;
}

export interface WizardBarber {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface WizardDraft {
  version: 1;
  shop: { nameAr: string; nameEn: string; phone: string };
  location: {
    cityId: string | null;
    areaId: string | null;
    lat: number | null;
    lng: number | null;
    landmark: string;
  };
  services: WizardService[];
  team: { ownerIsBarber: boolean; barbers: WizardBarber[] };
  hours: DayHours[];
  publish: { marketplaceVisible: boolean };
}

export interface OnboardingState {
  role: "shop_admin" | "barber" | "customer";
  shop_id: string | null;
  eligible: boolean;
  has_appointments?: boolean;
  owner?: { full_name: string | null; phone: string | null };
  shop?: {
    name: string | null;
    name_ar: string | null;
    slug: string | null;
    slug_ar: string | null;
    phone: string | null;
    whatsapp: string | null;
    city_id: string | null;
    area_id: string | null;
    lat: number | null;
    lng: number | null;
    landmark_en: string | null;
    landmark_ar: string | null;
    is_published: boolean;
    marketplace_visible: boolean;
  };
  progress?: { step: string; data: unknown; completed_at: string | null; updated_at: string } | null;
  services?: { name: string; name_ar: string | null; duration: number; price: number }[];
}

let counter = 0;
/** Short client-side id for draft rows (not persisted as a DB id). */
export function rowId(prefix = "r"): string {
  counter = (counter + 1) % 1_000_000;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${counter}`;
}

const ARABIC_RE = /[؀-ۿ]/;
export function hasArabic(value: string | null | undefined): boolean {
  return ARABIC_RE.test(value ?? "");
}

// The signup trigger seeds these placeholder names; they are not the owner's.
const SIGNUP_DEFAULT_SHOP_NAMES = new Set(["my barbershop"]);
const SIGNUP_DEFAULT_SERVICE_NAMES = new Set([
  "Premium Haircut",
  "Beard Trim & Shape",
  "Haircut + Beard",
  "Hot Towel Shave",
  "Kids Haircut",
  "Full Grooming",
]);

export function templateRows(): WizardService[] {
  return BARBERSHOP_SERVICES.map((s) => ({
    id: rowId("s"),
    key: s.key,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    duration: s.duration,
    price: s.price,
    category: s.category,
    icon: s.icon,
    selected: s.selected,
  }));
}

/** A fresh draft, prefilled from what the account and shop already hold. */
export function createDraft(state?: Partial<OnboardingState> | null): WizardDraft {
  const shop = state?.shop;
  const signupName = (shop?.name ?? "").trim();
  const usableName = signupName && !SIGNUP_DEFAULT_SHOP_NAMES.has(signupName.toLowerCase()) ? signupName : "";
  const nameAr = shop?.name_ar?.trim() || (hasArabic(usableName) ? usableName : "");
  const nameEn = hasArabic(usableName) ? "" : usableName;

  // Keep a shop's own catalogue when it is not the signup default list.
  const existing = state?.services ?? [];
  const custom = existing.length > 0 && existing.some((s) => !SIGNUP_DEFAULT_SERVICE_NAMES.has(s.name));
  const services: WizardService[] = custom
    ? existing.map((s) => ({
        id: rowId("s"),
        key: null,
        nameAr: s.name_ar ?? (hasArabic(s.name) ? s.name : ""),
        nameEn: hasArabic(s.name) ? "" : s.name,
        duration: normalizeDuration(s.duration),
        price: normalizePrice(s.price),
        category: null,
        icon: "scissors",
        selected: true,
      }))
    : templateRows();

  return {
    version: 1,
    shop: {
      nameAr,
      nameEn,
      phone: shop?.whatsapp || shop?.phone || state?.owner?.phone || "",
    },
    location: {
      cityId: shop?.city_id ?? null,
      areaId: shop?.area_id ?? null,
      lat: shop?.lat ?? null,
      lng: shop?.lng ?? null,
      landmark: shop?.landmark_ar || shop?.landmark_en || "",
    },
    services,
    team: { ownerIsBarber: true, barbers: [] },
    hours: defaultHours(),
    publish: { marketplaceVisible: shop?.marketplace_visible ?? true },
  };
}

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function idOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null;
}
function time(v: unknown, fallback: string): string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : fallback;
}
function timeOrNull(v: unknown): string | null {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null;
}

/**
 * Merges a saved draft (untrusted JSON from onboarding_progress.data) over a
 * base draft. Unknown or malformed fields keep the base value, so an old or
 * corrupted draft can never crash the wizard.
 */
export function restoreDraft(saved: unknown, base: WizardDraft): WizardDraft {
  if (!saved || typeof saved !== "object") return base;
  const s = saved as Record<string, unknown>;
  const shop = (s.shop ?? {}) as Record<string, unknown>;
  const loc = (s.location ?? {}) as Record<string, unknown>;
  const team = (s.team ?? {}) as Record<string, unknown>;
  const pub = (s.publish ?? {}) as Record<string, unknown>;

  const services = Array.isArray(s.services)
    ? (s.services as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .slice(0, MAX_SERVICES + 20)
        .map((x) => ({
          id: idOrNull(x.id) ?? rowId("s"),
          key: idOrNull(x.key),
          nameAr: str(x.nameAr, 100),
          nameEn: str(x.nameEn, 100),
          duration: normalizeDuration(num(x.duration) ?? 30),
          price: normalizePrice(num(x.price) ?? 0),
          category: idOrNull(x.category),
          icon: str(x.icon, 30) || "scissors",
          selected: x.selected !== false,
        }))
    : base.services;

  const barbers = Array.isArray(team.barbers)
    ? (team.barbers as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .slice(0, MAX_BARBERS)
        .map((x) => ({
          id: idOrNull(x.id) ?? rowId("b"),
          fullName: str(x.fullName, 100),
          avatarUrl: typeof x.avatarUrl === "string" && x.avatarUrl.length <= 120_000 ? x.avatarUrl : null,
        }))
    : base.team.barbers;

  const savedHours = Array.isArray(s.hours) ? (s.hours as unknown[]) : [];
  const hours = WEEK_ORDER_SAT_FIRST.map((d) => {
    const fallback = base.hours.find((h) => h.day === d) ?? defaultHours().find((h) => h.day === d)!;
    const h = savedHours.find(
      (x): x is Record<string, unknown> => !!x && typeof x === "object" && (x as { day?: unknown }).day === d,
    );
    if (!h) return fallback;
    return {
      day: d,
      open: typeof h.open === "boolean" ? h.open : fallback.open,
      start: time(h.start, fallback.start),
      end: time(h.end, fallback.end),
      breakStart: timeOrNull(h.breakStart),
      breakEnd: timeOrNull(h.breakEnd),
    };
  });

  return {
    version: 1,
    shop: {
      nameAr: typeof shop.nameAr === "string" ? str(shop.nameAr, 100) : base.shop.nameAr,
      nameEn: typeof shop.nameEn === "string" ? str(shop.nameEn, 100) : base.shop.nameEn,
      phone: typeof shop.phone === "string" ? str(shop.phone, 30) : base.shop.phone,
    },
    location: {
      cityId: "cityId" in loc ? idOrNull(loc.cityId) : base.location.cityId,
      areaId: "areaId" in loc ? idOrNull(loc.areaId) : base.location.areaId,
      lat: "lat" in loc ? num(loc.lat) : base.location.lat,
      lng: "lng" in loc ? num(loc.lng) : base.location.lng,
      landmark: typeof loc.landmark === "string" ? str(loc.landmark, 200) : base.location.landmark,
    },
    services: services.length ? services : base.services,
    team: {
      ownerIsBarber: typeof team.ownerIsBarber === "boolean" ? team.ownerIsBarber : base.team.ownerIsBarber,
      barbers,
    },
    hours,
    publish: {
      marketplaceVisible:
        typeof pub.marketplaceVisible === "boolean" ? pub.marketplaceVisible : base.publish.marketplaceVisible,
    },
  };
}

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === "string" && (WIZARD_STEPS as readonly string[]).includes(value);
}

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function nextStep(step: WizardStep): WizardStep | null {
  return WIZARD_STEPS[stepIndex(step) + 1] ?? null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i > 0 ? WIZARD_STEPS[i - 1] : null;
}

// ─── Phone ─────────────────────────────────────────────────────────────────

/**
 * Normalises a Jordanian mobile to E.164 (+9627XXXXXXXX). Accepts 07…, 7…,
 * 9627…, +9627…, 009627…, Arabic-Indic digits, spaces and dashes. Other valid
 * international numbers (7–15 digits with +/00) are kept as +digits. Returns
 * null when the input is not a phone number.
 */
export function normalizePhone(input: string): string | null {
  const latin = (input ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const trimmed = latin.trim();
  if (!trimmed) return null;
  if (/[^\d\s\-+().]/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  const intl = trimmed.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Jordan mobiles: 7[789] + 7 digits.
  const jo = /^(?:962|0)?(7[789]\d{7})$/.exec(digits);
  if (jo && (!intl || digits.startsWith("962"))) return `+962${jo[1]}`;
  if (intl && digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function isJordanMobile(e164: string | null): boolean {
  return !!e164 && /^\+9627[789]\d{7}$/.test(e164);
}

// ─── Validation ────────────────────────────────────────────────────────────

export type StepErrors = Record<string, string>;

/** Error keys map to t.start.errors.<key>. */
export function validateStep(step: WizardStep, draft: WizardDraft): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case "shop": {
      if (!draft.shop.nameAr.trim() && !draft.shop.nameEn.trim()) errors.name = "nameRequired";
      if (draft.shop.nameAr.trim().length === 1) errors.nameAr = "nameTooShort";
      if (draft.shop.nameEn.trim().length === 1) errors.nameEn = "nameTooShort";
      if (!draft.shop.phone.trim()) errors.phone = "phoneRequired";
      else if (!normalizePhone(draft.shop.phone)) errors.phone = "phoneInvalid";
      break;
    }
    case "location": {
      if (!draft.location.cityId) errors.cityId = "cityRequired";
      const { lat, lng } = draft.location;
      if ((lat === null) !== (lng === null)) errors.pin = "pinInvalid";
      if (lat !== null && lng !== null && !inJordan(lat, lng)) errors.pin = "pinOutside";
      break;
    }
    case "services": {
      const chosen = draft.services.filter((s) => s.selected);
      if (chosen.length === 0) errors.services = "servicesRequired";
      if (chosen.length > MAX_SERVICES) errors.services = "servicesTooMany";
      for (const s of chosen) {
        if (!s.nameAr.trim() && !s.nameEn.trim()) errors[`service.${s.id}`] = "serviceNameRequired";
        else if (!(s.duration >= 5 && s.duration <= 480)) errors[`service.${s.id}`] = "durationInvalid";
        else if (!(s.price >= 0 && s.price <= 1000)) errors[`service.${s.id}`] = "priceInvalid";
      }
      break;
    }
    case "team": {
      const named = draft.team.barbers.filter((b) => b.fullName.trim());
      if (!draft.team.ownerIsBarber && named.length === 0) errors.team = "teamRequired";
      if (draft.team.barbers.length > MAX_BARBERS) errors.team = "teamTooMany";
      for (const b of draft.team.barbers) {
        if (!b.fullName.trim()) errors[`barber.${b.id}`] = "barberNameRequired";
      }
      break;
    }
    case "hours": {
      if (!draft.hours.some((h) => h.open)) errors.hours = "hoursNoneOpen";
      for (const h of draft.hours) {
        const err: DayHoursError | null = validateDayHours(h);
        if (err) errors[`day.${h.day}`] = err;
      }
      break;
    }
    case "publish":
      break;
  }
  return errors;
}

/** First step with errors (for the publish summary), or null when all pass. */
export function firstInvalidStep(draft: WizardDraft): WizardStep | null {
  for (const step of WIZARD_STEPS) {
    if (Object.keys(validateStep(step, draft)).length) return step;
  }
  return null;
}

/**
 * The step to reopen after a refresh: the saved step, but never past the
 * first step that still has errors.
 */
export function resumeStep(saved: unknown, draft: WizardDraft): WizardStep {
  const target: WizardStep = isWizardStep(saved) ? saved : "shop";
  for (const step of WIZARD_STEPS) {
    if (step === target) return target;
    if (Object.keys(validateStep(step, draft)).length) return step;
  }
  return target;
}

export function inJordan(lat: number, lng: number): boolean {
  return lat >= 29 && lat <= 33.6 && lng >= 34.8 && lng <= 39.4;
}

// ─── Payload ───────────────────────────────────────────────────────────────

export interface PayloadContext {
  /** Human address line in the owner's language, e.g. "Khalda, Amman". */
  address?: string | null;
}

export interface WizardPayload {
  shop: {
    name_en: string | null;
    name_ar: string | null;
    phone: string | null;
    whatsapp: string | null;
    city_id: string | null;
    area_id: string | null;
    lat: number | null;
    lng: number | null;
    landmark_en: string | null;
    landmark_ar: string | null;
    address: string | null;
  };
  services: { name: string; name_ar: string | null; duration: number; price: number; category: string | null; icon: string }[];
  owner: { is_barber: boolean };
  barbers: { full_name: string; avatar_url: string | null }[];
  hours: {
    day_of_week: number;
    is_working: boolean;
    start: string;
    end: string;
    break_start: string | null;
    break_end: string | null;
  }[];
  publish: boolean;
  marketplace_visible: boolean;
}

const blank = (v: string) => (v.trim() ? v.trim().replace(/\s+/g, " ") : null);

/** Builds the create_shop_from_wizard(payload) argument from a valid draft. */
export function buildPayload(draft: WizardDraft, ctx: PayloadContext = {}): WizardPayload {
  const phone = normalizePhone(draft.shop.phone);
  const landmark = blank(draft.location.landmark);
  const arabicLandmark = landmark !== null && hasArabic(landmark);
  return {
    shop: {
      name_en: blank(draft.shop.nameEn),
      name_ar: blank(draft.shop.nameAr),
      phone,
      whatsapp: phone,
      city_id: draft.location.cityId,
      area_id: draft.location.areaId,
      lat: draft.location.lat,
      lng: draft.location.lng,
      landmark_en: arabicLandmark ? null : landmark,
      landmark_ar: arabicLandmark ? landmark : null,
      address: ctx.address ? blank(ctx.address) : null,
    },
    services: draft.services
      .filter((s) => s.selected)
      .map((s) => {
        const en = blank(s.nameEn);
        const ar = blank(s.nameAr);
        return {
          name: (en ?? ar) as string,
          name_ar: ar,
          duration: normalizeDuration(s.duration),
          price: normalizePrice(s.price),
          category: s.category,
          icon: s.icon || "scissors",
        };
      }),
    owner: { is_barber: draft.team.ownerIsBarber },
    barbers: draft.team.barbers
      .filter((b) => b.fullName.trim())
      .map((b) => ({ full_name: b.fullName.trim(), avatar_url: b.avatarUrl })),
    hours: draft.hours.map((h) => ({
      day_of_week: h.day,
      is_working: h.open,
      start: h.start,
      end: h.end,
      break_start: h.open && h.breakStart && h.breakEnd ? h.breakStart : null,
      break_end: h.open && h.breakStart && h.breakEnd ? h.breakEnd : null,
    })),
    publish: true,
    marketplace_visible: draft.publish.marketplaceVisible,
  };
}

// ─── RPC errors ────────────────────────────────────────────────────────────

export const WIZARD_ERROR_CODES = [
  "NOT_AUTHENTICATED",
  "NOT_SHOP_OWNER",
  "ONBOARDING_DONE",
  "NOT_ELIGIBLE",
  "INVALID_INPUT",
] as const;
export type WizardErrorCode = (typeof WIZARD_ERROR_CODES)[number] | "NETWORK" | "UNKNOWN";

/** Maps a Supabase/PostgREST error to a stable code (t.start.rpcErrors.<code>). */
export function wizardErrorCode(error: unknown): WizardErrorCode {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const e = error as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  for (const code of WIZARD_ERROR_CODES) {
    if (message === code || message.startsWith(`${code}:`) || message.startsWith(`${code} `)) return code;
  }
  if (/fetch|network|failed to fetch/i.test(message)) return "NETWORK";
  return "UNKNOWN";
}

// ─── Share ─────────────────────────────────────────────────────────────────

/** Short public booking link: /<locale>/b/<slug> (redirects to the shop page). */
export function bookingLinkPath(locale: string, slug: string): string {
  return `/${locale === "ar" ? "ar" : "en"}/b/${encodeURIComponent(slug)}`;
}

export function bookingLink(origin: string, locale: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}${bookingLinkPath(locale, slug)}`;
}

/** wa.me share link with prefilled text (no recipient: the owner picks one). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Safe file name for the QR download. */
export function qrFileName(slug: string): string {
  const safe = slug.normalize("NFKD").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `halaqy-${safe || "shop"}-qr.png`;
}

/**
 * The step that owns an INVALID_INPUT field (the RPC puts it in DETAIL,
 * e.g. "services.3.price" or "shop.lat_lng"), so the wizard can jump there.
 */
export function stepForErrorDetail(detail: unknown): WizardStep | null {
  if (typeof detail !== "string" || !detail) return null;
  if (detail === "shop.name" || detail === "shop.phone") return "shop";
  if (detail.startsWith("shop.")) return "location";
  if (detail.startsWith("services")) return "services";
  if (detail.startsWith("barbers")) return "team";
  if (detail.startsWith("hours")) return "hours";
  return null;
}
