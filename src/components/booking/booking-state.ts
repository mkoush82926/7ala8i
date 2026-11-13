// ═══════════════════════════════════════════════════════
// Booking flow v2 — pure state helpers (no React, no Supabase).
//   • URL entry params (?service= / ?services= / ?staff= / ?barber= / ?src= / ?entry=)
//   • line pricing: variant > barber price override > catalogue; price types
//   • per-barber surcharge for the barber cards ("+2 JD")
//   • cancellation deadline for the plain-language policy
//   • sessionStorage persistence so a refresh keeps every selection
// ═══════════════════════════════════════════════════════

export type PriceType = "fixed" | "from" | "free";
export type BookingStep = "services" | "barber" | "time" | "review";
export const STEPS: BookingStep[] = ["services", "barber", "time", "review"];

export interface VariantRow {
  id: string;
  service_id: string;
  name_en: string;
  name_ar: string | null;
  price: number;
  duration: number;
  sort: number;
}

export interface ServiceRow {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  price_type: PriceType;
  category_id: string | null;
  description_en: string | null;
  description_ar: string | null;
  client_note_en: string | null;
  client_note_ar: string | null;
  location_type: "in_shop" | "home";
  online_bookable: boolean;
  sort_order: number | null;
  variants: VariantRow[];
}

export interface BarberServiceRow {
  service_id: string;
  is_active?: boolean | null;
  price_override?: number | null;
  duration_override?: number | null;
}

export interface Line {
  serviceId: string;
  variantId: string | null;
  note: string;
}

export interface Quote {
  price: number;
  duration: number;
  /** At least one line is "from" priced (the total is a minimum). */
  isFrom: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[a-z0-9_.:-]{1,40}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Loose row → ServiceRow (new columns may be missing on older databases). */
export function normalizeService(row: Record<string, unknown>, variants: VariantRow[] = []): ServiceRow {
  const pt = String(row.price_type ?? "fixed");
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    name_ar: (row.name_ar as string | null) ?? null,
    duration: Number(row.duration) || 0,
    price: Number(row.price) || 0,
    price_type: pt === "from" || pt === "free" ? pt : "fixed",
    category_id: (row.category_id as string | null) ?? null,
    description_en: (row.description_en as string | null) ?? null,
    description_ar: (row.description_ar as string | null) ?? null,
    client_note_en: (row.client_note_en as string | null) ?? null,
    client_note_ar: (row.client_note_ar as string | null) ?? null,
    location_type: row.location_type === "home" ? "home" : "in_shop",
    online_bookable: row.online_bookable !== false,
    sort_order: row.sort_order == null ? null : Number(row.sort_order),
    variants: variants
      .filter((v) => v.service_id === row.id)
      .sort((a, b) => a.sort - b.sort || a.price - b.price),
  };
}

// ─── URL entry ───

export interface EntryParams {
  serviceIds: string[];
  barberId: string | null;
  src: string | null;
  entry: string | null;
  rescheduleId: string | null;
}

type ParamsLike = { get(name: string): string | null } | null | undefined;

function token(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return TOKEN_RE.test(v) ? v : null;
}

export function parseEntryParams(sp: ParamsLike): EntryParams {
  const get = (k: string) => sp?.get(k) ?? null;
  const ids = [get("service"), ...(get("services") ?? "").split(",")]
    .map((s) => (s ?? "").trim())
    .filter(isUuid);
  const barberRaw = (get("barber") ?? get("staff") ?? "").trim();
  const reschedule = (get("reschedule") ?? "").trim();
  return {
    serviceIds: Array.from(new Set(ids)).slice(0, 10),
    barberId: barberRaw === "any" ? "any" : isUuid(barberRaw) ? barberRaw : null,
    src: token(get("src")),
    entry: token(get("entry")),
    rescheduleId: isUuid(reschedule) ? reschedule : null,
  };
}

// ─── Pricing ───

export function lineQuote(service: ServiceRow, variantId: string | null, bs?: BarberServiceRow | null): Quote {
  const variant = variantId ? service.variants.find((v) => v.id === variantId) ?? null : null;
  const override = bs && bs.price_override != null ? Number(bs.price_override) : null;
  const price =
    service.price_type === "free" ? 0 : variant ? Number(variant.price) : override ?? Number(service.price);
  const duration = variant ? variant.duration : bs?.duration_override ?? service.duration;
  return { price, duration, isFrom: service.price_type === "from" && !variant };
}

export function quoteLines(
  lines: ReadonlyArray<Line>,
  services: ReadonlyMap<string, ServiceRow>,
  barberServices?: ReadonlyArray<BarberServiceRow> | null,
): Quote {
  let price = 0;
  let duration = 0;
  let isFrom = false;
  for (const line of lines) {
    const s = services.get(line.serviceId);
    if (!s) continue;
    const q = lineQuote(s, line.variantId, barberServices?.find((r) => r.service_id === s.id) ?? null);
    price += q.price;
    duration += q.duration;
    isFrom ||= q.isFrom;
  }
  return { price: Math.round(price * 1000) / 1000, duration, isFrom };
}

/** Price difference for one barber vs the catalogue (positive = surcharge). */
export function barberSurcharge(
  lines: ReadonlyArray<Line>,
  services: ReadonlyMap<string, ServiceRow>,
  barberServices: ReadonlyArray<BarberServiceRow> | null | undefined,
): number {
  const base = quoteLines(lines, services).price;
  const own = quoteLines(lines, services, barberServices ?? []).price;
  return Math.round((own - base) * 1000) / 1000;
}

/** No barber_services rows = offers everything (same as the server). */
export function offersAll(barberServices: ReadonlyArray<BarberServiceRow> | null | undefined, serviceIds: string[]): boolean {
  const rows = barberServices ?? [];
  if (rows.length === 0 || serviceIds.length === 0) return true;
  return serviceIds.every((id) => rows.some((r) => r.service_id === id && r.is_active !== false));
}

/** Toggle a service: adds it (with an optional variant) or removes it. */
export function toggleLine(lines: ReadonlyArray<Line>, serviceId: string, variantId: string | null = null): Line[] {
  if (lines.some((l) => l.serviceId === serviceId)) {
    if (variantId !== null) {
      return lines.map((l) => (l.serviceId === serviceId ? { ...l, variantId } : l));
    }
    return lines.filter((l) => l.serviceId !== serviceId);
  }
  if (lines.length >= 10) return [...lines];
  return [...lines, { serviceId, variantId, note: "" }];
}

// ─── Policy ───

/** The instant until which cancelling is free, or null when there is no window. */
export function freeCancellationUntil(startIso: string | null | undefined, policyHours: number | null | undefined): Date | null {
  const hours = Number(policyHours) || 0;
  if (!startIso || hours <= 0) return null;
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  return new Date(start - hours * 3_600_000);
}

// ─── Persistence ───

export interface PersistedBooking {
  v: 2;
  shopId: string;
  savedAt: number;
  step: BookingStep;
  lines: Line[];
  barber: string | null;
  date: string | null;
  slot: { startIso: string; localDate: string; localTime: string } | null;
  name: string;
  phone: string;
  notes: string;
  otp: { phone: string; token: string | null; sentAt: number | null; verifiedAt: number | null } | null;
}

export const PERSIST_TTL_MS = 2 * 60 * 60 * 1000;
export const persistKey = (shopId: string) => `halaqy:booking:${shopId}`;

export function serializeBooking(state: Omit<PersistedBooking, "v" | "savedAt">, now = Date.now()): string {
  return JSON.stringify({ ...state, v: 2, savedAt: now });
}

/** Parses a saved state; null when missing, stale, for another shop or malformed. */
export function deserializeBooking(raw: string | null | undefined, shopId: string, now = Date.now()): PersistedBooking | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<PersistedBooking>;
    if (s.v !== 2 || s.shopId !== shopId || typeof s.savedAt !== "number" || now - s.savedAt > PERSIST_TTL_MS) return null;
    const lines = Array.isArray(s.lines)
      ? s.lines
          .filter((l): l is Line => !!l && isUuid((l as Line).serviceId))
          .map((l) => ({
            serviceId: l.serviceId,
            variantId: isUuid(l.variantId) ? l.variantId : null,
            note: typeof l.note === "string" ? l.note.slice(0, 300) : "",
          }))
          .slice(0, 10)
      : [];
    const step = STEPS.includes(s.step as BookingStep) ? (s.step as BookingStep) : "services";
    return {
      v: 2,
      shopId,
      savedAt: s.savedAt,
      step,
      lines,
      barber: s.barber === "any" || isUuid(s.barber) ? s.barber : null,
      date: typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : null,
      slot:
        s.slot && typeof s.slot.startIso === "string" && typeof s.slot.localTime === "string"
          ? { startIso: s.slot.startIso, localDate: String(s.slot.localDate ?? ""), localTime: s.slot.localTime }
          : null,
      name: typeof s.name === "string" ? s.name.slice(0, 100) : "",
      phone: typeof s.phone === "string" ? s.phone.slice(0, 20) : "",
      notes: typeof s.notes === "string" ? s.notes.slice(0, 500) : "",
      otp:
        s.otp && typeof s.otp.phone === "string"
          ? {
              phone: s.otp.phone.slice(0, 20),
              token: typeof s.otp.token === "string" ? s.otp.token : null,
              sentAt: typeof s.otp.sentAt === "number" ? s.otp.sentAt : null,
              verifiedAt: typeof s.otp.verifiedAt === "number" ? s.otp.verifiedAt : null,
            }
          : null,
    };
  } catch {
    return null;
  }
}

/** First step to show: skip "services" when the link already chose them. */
export function initialStep(params: EntryParams, restored: PersistedBooking | null, validServiceIds: Set<string>): BookingStep {
  if (restored && restored.lines.length) {
    // Never resume past a step whose input is missing.
    if (restored.step === "review" && !restored.slot) return restored.barber ? "time" : "barber";
    if (restored.step === "time" && !restored.barber) return "barber";
    return restored.step;
  }
  const preset = params.serviceIds.filter((id) => validServiceIds.has(id));
  if (preset.length) return params.barberId ? "time" : "barber";
  return "services";
}

/** Slot-picker days: `count` shop-local dates from `from`. */
export function dateRange(from: string, count: number): string[] {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return dt.toISOString().slice(0, 10);
  });
}

/** Quick note chips (i18n keys under bookingFlow.chips). */
export const NOTE_CHIPS = ["firstVisit", "keepLength", "skinFade", "beardShape", "sensitiveSkin", "inAHurry"] as const;
export type NoteChip = (typeof NOTE_CHIPS)[number];

/** Appends a chip's text to a note once (idempotent). */
export function appendChip(note: string, text: string): string {
  const parts = note.split(/[،,]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.includes(text)) return note;
  const sep = /[؀-ۿ]/.test(text) ? "، " : ", ";
  return (parts.length ? `${parts.join(sep)}${sep}${text}` : text).slice(0, 300);
}

// ─── Submit ───

/** Where a failed submit sends the customer. */
export type ErrorRoute = "time" | "services" | "barber" | "otp" | "captcha" | "inline";

const TIME_CODES = new Set(["SLOT_TAKEN", "NO_BARBER_AVAILABLE", "SLOT_IN_PAST", "OUTSIDE_WORKING_HOURS", "TOO_FAR_AHEAD"]);
const OTP_CODES = new Set(["OTP_REQUIRED", "OTP_INVALID", "OTP_EXPIRED", "OTP_TOO_MANY_ATTEMPTS"]);

export function errorRoute(code: string | null | undefined): ErrorRoute {
  if (!code) return "inline";
  if (TIME_CODES.has(code)) return "time";
  if (code === "SERVICE_INVALID") return "services";
  if (code === "BARBER_INVALID") return "barber";
  if (OTP_CODES.has(code)) return "otp";
  if (code === "CAPTCHA_FAILED") return "captcha";
  return "inline";
}

export interface BookingPayloadInput {
  shopId: string;
  lines: ReadonlyArray<Line>;
  barber: string | null;
  name: string;
  phone: string;
  startIso: string;
  notes: string;
  src: string | null;
  entry: string | null;
  otpToken: string | null;
  captchaToken: string | null;
}

/** POST /api/booking v2 body. Price, end time and names are decided by the server. */
export function buildBookingPayload(i: BookingPayloadInput) {
  const notes = i.notes.trim();
  return {
    shopId: i.shopId,
    items: i.lines.map((l) => ({
      serviceId: l.serviceId,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      ...(l.note.trim() ? { note: l.note.trim().slice(0, 300) } : {}),
    })),
    barberId: i.barber && i.barber !== "any" ? i.barber : null,
    clientName: i.name.trim(),
    clientPhone: i.phone,
    startTime: i.startIso,
    src: i.src ?? "online",
    ...(i.entry ? { entry: i.entry } : {}),
    ...(notes ? { notes: notes.slice(0, 500) } : {}),
    ...(i.otpToken ? { otpToken: i.otpToken } : {}),
    ...(i.captchaToken ? { captchaToken: i.captchaToken } : {}),
  };
}

/** Drops a restored slot that has already started (or is unparsable). */
export function freshSlot<T extends { startIso: string }>(slot: T | null, now = Date.now()): T | null {
  if (!slot) return null;
  const at = Date.parse(slot.startIso);
  return Number.isFinite(at) && at > now ? slot : null;
}
