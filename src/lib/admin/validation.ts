/**
 * Client + server validation for back-office forms. The RPCs re-validate
 * everything; these give instant, specific feedback and build the payloads.
 */
import { isUuid } from "./params";
import { PLAN_CODES, type PlanCode, type ShopPatch, type ImpersonationSnapshot } from "./types";

export const REASON_MIN = 5;
export const WRITE_REASON_MIN = 10;
export const REASON_MAX = 500;

export type ReasonCheck = { ok: true; value: string } | { ok: false; error: "required" | "too_long" };

/** Trims a reason and checks it the same way admin_reason() does. */
export function checkReason(raw: string | null | undefined, { required = true, min = REASON_MIN } = {}): ReasonCheck {
  const value = (raw ?? "").trim();
  if (value.length > REASON_MAX) return { ok: false, error: "too_long" };
  if (required && value.length < min) return { ok: false, error: "required" };
  return { ok: true, value };
}

/** Digits only; null unless 7–15 digits (matches admin_phone_key()). */
export function phoneDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Ban key used server-side: last 9 digits. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = phoneDigits(raw);
  return digits ? digits.slice(-9) : null;
}

/** Suggested defaults per §3 pricing (tiers by number of barbers). */
export const PLAN_DEFAULTS: Record<PlanCode, { maxBarbers: number | null; messages: number | null; trialDays?: number }> = {
  trial: { maxBarbers: 5, messages: 200, trialDays: 30 },
  solo: { maxBarbers: 1, messages: 300 },
  team: { maxBarbers: 5, messages: 1000 },
  pro: { maxBarbers: 15, messages: 3000 },
  custom: { maxBarbers: null, messages: null },
};

export interface PlanFormValues {
  plan_code: string;
  trial_ends_at: string; // yyyy-mm-dd ("" when unset)
  max_barbers: string;
  monthly_message_allowance: string;
  note: string;
}

export interface PlanPayload {
  plan_code: PlanCode;
  trial_ends_at: string | null;
  max_barbers: number | null;
  monthly_message_allowance: number | null;
  note: string | null;
}

export type PlanFieldError = "plan_code" | "trial_ends_at" | "max_barbers" | "monthly_message_allowance" | "note";

function optionalInt(raw: string, min: number, max: number): number | null | "invalid" {
  const value = raw.trim().replace(/[,\s]/g, "");
  if (value === "") return null;
  if (!/^\d+$/.test(value)) return "invalid";
  const n = Number(value);
  return n >= min && n <= max ? n : "invalid";
}

/**
 * Validates the plan form and returns the RPC payload. A trial end date is
 * stored as the end of that day in Amman (23:59:59 +03:00).
 */
export function buildPlanPayload(
  values: PlanFormValues,
): { ok: true; payload: PlanPayload } | { ok: false; errors: PlanFieldError[] } {
  const errors: PlanFieldError[] = [];
  const code = values.plan_code as PlanCode;
  if (!(PLAN_CODES as readonly string[]).includes(code)) errors.push("plan_code");

  let trial: string | null = null;
  const trialRaw = values.trial_ends_at.trim();
  if (trialRaw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trialRaw) && !Number.isNaN(Date.parse(`${trialRaw}T00:00:00Z`))) {
      trial = `${trialRaw}T23:59:59+03:00`;
    } else {
      errors.push("trial_ends_at");
    }
  } else if (code === "trial") {
    errors.push("trial_ends_at");
  }

  const barbers = optionalInt(values.max_barbers, 1, 200);
  if (barbers === "invalid") errors.push("max_barbers");
  const messages = optionalInt(values.monthly_message_allowance, 0, 1_000_000);
  if (messages === "invalid") errors.push("monthly_message_allowance");
  const note = values.note.trim();
  if (note.length > 500) errors.push("note");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      plan_code: code,
      trial_ends_at: trial,
      max_barbers: barbers as number | null,
      monthly_message_allowance: messages as number | null,
      note: note || null,
    },
  };
}

/** yyyy-mm-dd for a date `days` from `now`, in Amman. */
export function isoDateInAmman(now: Date, days = 0): string {
  const d = new Date(now.getTime() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export interface ClaimFormValues {
  shop_id: string;
  claimant_name: string;
  claimant_phone: string;
  details: string;
}

export type ClaimFieldError = "shop_id" | "claimant_name" | "claimant_phone" | "details";

export function checkClaimForm(values: ClaimFormValues): ClaimFieldError[] {
  const errors: ClaimFieldError[] = [];
  if (!isUuid(values.shop_id)) errors.push("shop_id");
  const name = values.claimant_name.trim();
  if (!name || name.length > 120) errors.push("claimant_name");
  if (values.claimant_phone.trim() && !phoneDigits(values.claimant_phone)) errors.push("claimant_phone");
  const details = values.details.trim();
  if (!details || details.length > 2000) errors.push("details");
  return errors;
}

export type ShopFormValues = {
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  address: string;
  is_published: boolean;
  marketplace_visible: boolean;
  min_notice_minutes: string;
  booking_window_days: string;
};

export function shopFormFromSnapshot(shop: ImpersonationSnapshot["shop"]): ShopFormValues {
  return {
    name: shop.name ?? "",
    name_ar: shop.name_ar ?? "",
    description: shop.description ?? "",
    description_ar: shop.description_ar ?? "",
    address: shop.address ?? "",
    is_published: !!shop.is_published,
    marketplace_visible: !!shop.marketplace_visible,
    min_notice_minutes: String(shop.min_notice_minutes ?? ""),
    booking_window_days: String(shop.booking_window_days ?? ""),
  };
}

export type ShopFieldError = "name" | "min_notice_minutes" | "booking_window_days";

/**
 * Diff between the original and edited support-view form: only changed
 * fields go to admin_impersonation_update_shop, so the audit diff is exact.
 */
export function diffShopForm(
  original: ShopFormValues,
  edited: ShopFormValues,
): { ok: true; patch: ShopPatch } | { ok: false; errors: ShopFieldError[] } {
  const errors: ShopFieldError[] = [];
  const patch: ShopPatch = {};

  const text = ["name", "name_ar", "description", "description_ar", "address"] as const;
  for (const key of text) {
    const a = original[key].trim();
    const b = edited[key].trim();
    if (a !== b) patch[key] = b;
  }
  if (patch.name !== undefined && patch.name === "") errors.push("name");
  if (original.is_published !== edited.is_published) patch.is_published = edited.is_published;
  if (original.marketplace_visible !== edited.marketplace_visible) patch.marketplace_visible = edited.marketplace_visible;

  const ints: Array<[ "min_notice_minutes" | "booking_window_days", number, number]> = [
    ["min_notice_minutes", 0, 20160],
    ["booking_window_days", 1, 365],
  ];
  for (const [key, min, max] of ints) {
    if (original[key].trim() === edited[key].trim()) continue;
    const raw = edited[key].trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) errors.push(key);
    else patch[key] = n;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, patch };
}
