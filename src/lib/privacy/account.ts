// ═══════════════════════════════════════════════════════
// WS-1J · Customer account model (browser-safe, no Supabase import).
//
// get_my_account() / update_my_account() return the jsonb parsed here.
// Everything is defensive: unknown or missing fields fall back to safe
// defaults so an older database (migration not yet applied) never crashes
// the account hub.
// ═══════════════════════════════════════════════════════
import { parseDigitPreference, type DigitPreference } from "@/lib/format";

/** Bump when the AR/EN privacy copy changes materially (stored with consents). */
export const PRIVACY_POLICY_VERSION = "2026-11-pdpl-1";

/** Typed by the customer to confirm account deletion (checked again in SQL). */
export const DELETE_CONFIRM_WORD = "DELETE";

/** Reserved TLD for accounts created by the self-hosted phone login. */
export const SYNTHETIC_EMAIL_DOMAIN = "phone.halaqy.invalid";

export const NOTIFY_CHANNELS = ["whatsapp", "sms", "email"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export const CONSENT_PURPOSES = ["terms", "privacy", "reminders", "marketing"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_SOURCES = ["signup", "phone_login", "account", "booking", "system"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export type PreferredLanguage = "en" | "ar";

export interface ConsentRecord {
  purpose: ConsentPurpose;
  channel: NotifyChannel | null;
  granted: boolean;
  source: ConsentSource;
  policyVersion: string | null;
  createdAt: string;
}

export interface LinkedShop {
  shopId: string;
  shopName: string;
  shopNameAr: string | null;
  slug: string | null;
  linkedAt: string | null;
  visits: number;
}

export interface VerifiedPhone {
  phone: string;
  method: string;
  verifiedAt: string | null;
}

export interface MyAccount {
  id: string;
  role: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  createdAt: string | null;
  preferredLanguage: PreferredLanguage | null;
  digitPreference: DigitPreference;
  notifyReminders: boolean;
  notifyChannel: NotifyChannel;
  marketingOptIn: boolean;
  verifiedPhones: VerifiedPhone[];
  linkedShops: LinkedShop[];
  consents: ConsentRecord[];
}

/** The editable subset sent to update_my_account(p_patch). */
export interface AccountPatch {
  full_name?: string;
  phone?: string | null;
  preferred_language?: PreferredLanguage | null;
  digit_preference?: DigitPreference;
  notify_reminders?: boolean;
  notify_channel?: NotifyChannel;
  marketing_opt_in?: boolean;
}

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const arr = (v: unknown): Json[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : [];

export function isNotifyChannel(v: unknown): v is NotifyChannel {
  return typeof v === "string" && (NOTIFY_CHANNELS as readonly string[]).includes(v);
}

export function parseLanguage(v: unknown): PreferredLanguage | null {
  return v === "en" || v === "ar" ? v : null;
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/** Placeholder login email for a phone-only account (E.164 digits, no "+"). */
export function syntheticEmailFor(e164Digits: string): string {
  const digits = e164Digits.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) throw new Error("INVALID_PHONE");
  return `p${digits}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function parseConsent(row: Json): ConsentRecord | null {
  const purpose = row.purpose;
  if (typeof purpose !== "string" || !(CONSENT_PURPOSES as readonly string[]).includes(purpose)) return null;
  const source = typeof row.source === "string" && (CONSENT_SOURCES as readonly string[]).includes(row.source)
    ? (row.source as ConsentSource)
    : "account";
  return {
    purpose: purpose as ConsentPurpose,
    channel: isNotifyChannel(row.channel) ? row.channel : null,
    granted: row.granted === true,
    source,
    policyVersion: str(row.policy_version),
    createdAt: str(row.created_at) ?? "",
  };
}

export function parseAccount(raw: unknown): MyAccount | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Json;
  const id = str(r.id);
  if (!id) return null;
  const email = str(r.email);
  return {
    id,
    role: str(r.role) ?? "customer",
    fullName: str(r.full_name) ?? "",
    phone: str(r.phone),
    email: email && !isSyntheticEmail(email) ? email : null,
    createdAt: str(r.created_at),
    preferredLanguage: parseLanguage(r.preferred_language),
    digitPreference: parseDigitPreference(r.digit_preference),
    notifyReminders: bool(r.notify_reminders, true),
    notifyChannel: isNotifyChannel(r.notify_channel) ? r.notify_channel : "whatsapp",
    marketingOptIn: bool(r.marketing_opt_in, false),
    verifiedPhones: arr(r.verified_phones).map((p) => ({
      phone: str(p.phone) ?? "",
      method: str(p.method) ?? "",
      verifiedAt: str(p.verified_at),
    })).filter((p) => p.phone),
    linkedShops: arr(r.linked_shops).map((s) => ({
      shopId: str(s.shop_id) ?? "",
      shopName: str(s.shop_name) ?? "",
      shopNameAr: str(s.shop_name_ar),
      slug: str(s.slug),
      linkedAt: str(s.linked_at),
      visits: Number.isFinite(Number(s.visits)) ? Number(s.visits) : 0,
    })).filter((s) => s.shopId),
    consents: arr(r.consents).map(parseConsent).filter((c): c is ConsentRecord => c !== null),
  };
}

/** Only the fields that actually changed (empty object = nothing to save). */
export function diffAccount(before: MyAccount, next: Partial<MyAccount>): AccountPatch {
  const patch: AccountPatch = {};
  if (next.fullName !== undefined) {
    const name = next.fullName.trim().replace(/\s+/g, " ");
    if (name !== before.fullName) patch.full_name = name;
  }
  if (next.phone !== undefined) {
    const phone = (next.phone ?? "").trim() || null;
    if (phone !== before.phone) patch.phone = phone;
  }
  if (next.preferredLanguage !== undefined && next.preferredLanguage !== before.preferredLanguage) {
    patch.preferred_language = next.preferredLanguage;
  }
  if (next.digitPreference !== undefined && next.digitPreference !== before.digitPreference) {
    patch.digit_preference = next.digitPreference;
  }
  if (next.notifyReminders !== undefined && next.notifyReminders !== before.notifyReminders) {
    patch.notify_reminders = next.notifyReminders;
  }
  if (next.notifyChannel !== undefined && next.notifyChannel !== before.notifyChannel) {
    patch.notify_channel = next.notifyChannel;
  }
  if (next.marketingOptIn !== undefined && next.marketingOptIn !== before.marketingOptIn) {
    patch.marketing_opt_in = next.marketingOptIn;
  }
  return patch;
}

/** Latest record per purpose (+channel), newest first input assumed unordered. */
export function latestConsents(records: readonly ConsentRecord[]): ConsentRecord[] {
  const seen = new Map<string, ConsentRecord>();
  const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const r of sorted) {
    const key = `${r.purpose}:${r.purpose === "terms" || r.purpose === "privacy" ? "" : r.channel ?? ""}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
}

/** Error code from a Supabase RPC error ({ message: '<CODE>' }). */
export function privacyErrorCode(error: { message?: string | null } | null | undefined): string | null {
  if (!error) return null;
  const message = (error.message ?? "").trim();
  return /^[A-Z][A-Z0-9_]{2,}$/.test(message) ? message : null;
}

/** True when the RPC is missing (migration 002900 not applied yet). */
export function isMissingRpc(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
