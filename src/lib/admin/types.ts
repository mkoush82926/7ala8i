/**
 * Shapes returned by the WS-1I admin RPCs (migration 20250101002800_admin.sql).
 * Timestamps are ISO strings; numeric aggregates may arrive as strings from
 * jsonb, so read them through `num()`.
 */

export type PlatformRole = "support" | "admin";

export interface ImpersonationInfo {
  id: string;
  shop_id: string;
  shop_name: string;
  mode: "read" | "write";
  reason: string | null;
  started_at: string;
  expires_at: string;
}

export interface AdminWhoAmI {
  user_id: string;
  role: PlatformRole;
  full_name: string | null;
  impersonation: ImpersonationInfo | null;
}

export interface AuditRow {
  id: string;
  action: string;
  target_type?: string;
  target_id?: string | null;
  reason: string | null;
  diff?: Record<string, unknown> | null;
  impersonation_id?: string | null;
  created_at: string;
  actor_id?: string | null;
  actor_role: string | null;
  actor_name: string | null;
}

export interface AdminOverview {
  shops_total: number;
  shops_published: number;
  shops_unverified: number;
  shops_suspended: number;
  open_reports: number;
  open_claims: number;
  banned_profiles: number;
  banned_phones: number;
  bookings_7d: number;
  recent_audit: AuditRow[];
}

export interface Paged<T> {
  total: number;
  limit: number;
  offset: number;
  rows: T[];
}

export interface AdminShopRow {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  is_published: boolean;
  marketplace_visible: boolean;
  is_verified: boolean;
  suspended_at: string | null;
  created_at: string;
  published_at: string | null;
  city_name: string | null;
  staff_count: number;
  bookings_30d: number;
  rating_avg: number | null;
  open_reports: number;
  plan_code: PlanCode | null;
}

export interface AdminShopDetail {
  shop: {
    id: string;
    name: string;
    name_ar: string | null;
    slug: string;
    slug_ar: string | null;
    phone_masked: string | null;
    whatsapp_masked: string | null;
    address: string | null;
    is_published: boolean;
    published_at: string | null;
    marketplace_visible: boolean;
    is_verified: boolean;
    suspended_at: string | null;
    created_at: string;
    timezone: string | null;
    logo_url: string | null;
    city_name: string | null;
    area_name: string | null;
  };
  staff: Array<{
    id: string;
    full_name: string;
    role: string;
    phone_masked: string | null;
    banned_at: string | null;
  }>;
  stats: {
    services_active: number;
    bookings_30d: number;
    no_shows_30d: number;
    reviews: number;
    reviews_hidden: number;
    rating_avg: number | null;
    open_reports: number;
  };
  plan: PlanOverride | null;
  audit: AuditRow[];
}

export const PLAN_CODES = ["trial", "solo", "team", "pro", "custom"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export interface PlanOverride {
  plan_code: PlanCode;
  trial_ends_at: string | null;
  max_barbers: number | null;
  monthly_message_allowance: number | null;
  note: string | null;
  updated_at?: string;
}

export const REPORT_REASONS = ["spam", "offensive", "fake", "conflict_of_interest", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "upheld", "dismissed", "all"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReviewReportRow {
  id: string;
  review_id: string;
  reason: ReportReason;
  details: string | null;
  status: Exclude<ReportStatus, "all">;
  reporter_kind: "customer" | "shop_staff" | "platform";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  reporter_name: string | null;
  open_on_review: number;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    reviewer_name: string | null;
    created_at: string;
    hidden_at: string | null;
    hidden_reason: string | null;
  };
  shop: { id: string; name: string; slug: string };
}

export const CLAIM_STATUSES = ["open", "upheld", "rejected", "withdrawn", "all"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const CLAIM_DECISIONS = ["upheld", "rejected", "withdrawn"] as const;
export type ClaimDecision = (typeof CLAIM_DECISIONS)[number];

export interface ClaimRow {
  id: string;
  status: Exclude<ClaimStatus, "all">;
  claimant_name: string;
  claimant_phone_masked: string | null;
  details: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  shop: { id: string; name: string; slug: string };
}

export interface ProfileSearchRow {
  id: string;
  full_name: string;
  role: string;
  platform_role: PlatformRole | null;
  banned_at: string | null;
  created_at: string;
  phone_masked: string | null;
  shop_name: string | null;
}

export interface BanLists {
  phones: Array<{ phone_key: string; phone_hint: string | null; reason: string; created_at: string }>;
  profiles: Array<{ id: string; full_name: string; role: string; banned_at: string; phone_masked: string | null }>;
  shops: Array<{ id: string; name: string; slug: string; suspended_at: string }>;
}

export interface ImpersonationSnapshot {
  session: { id: string; mode: "read" | "write"; reason: string | null; started_at: string; expires_at: string };
  shop: {
    id: string;
    name: string;
    name_ar: string | null;
    slug: string;
    description: string | null;
    description_ar: string | null;
    address: string | null;
    phone_masked: string | null;
    is_published: boolean;
    marketplace_visible: boolean;
    is_verified: boolean;
    suspended_at: string | null;
    min_notice_minutes: number;
    booking_window_days: number;
    timezone: string;
  };
  team: Array<{ id: string; full_name: string; role: string; online_bookable: boolean }>;
  services: Array<{
    id: string;
    name: string;
    name_ar: string | null;
    price: number;
    duration: number;
    is_active: boolean;
    online_bookable: boolean;
  }>;
  upcoming: Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    source: string | null;
    local_start: string;
    service_name: string;
    barber_name: string | null;
    client_first_name: string;
    client_phone_masked: string | null;
  }>;
  stats: { bookings_30d: number; completed_30d: number; no_shows_30d: number; revenue_30d: number };
  publish_missing: string[];
}

/** Whitelisted shop fields an admin may change in write impersonation. */
export const IMPERSONATION_SHOP_FIELDS = [
  "name",
  "name_ar",
  "description",
  "description_ar",
  "address",
  "is_published",
  "marketplace_visible",
  "min_notice_minutes",
  "booking_window_days",
] as const;
export type ImpersonationShopField = (typeof IMPERSONATION_SHOP_FIELDS)[number];
export type ShopPatch = Partial<{
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  address: string;
  is_published: boolean;
  marketplace_visible: boolean;
  min_notice_minutes: number;
  booking_window_days: number;
}>;

/** Coerces a jsonb numeric (number | numeric-string | null) to a number. */
export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Normalises a Paged<T> payload, tolerating nulls from the RPC. */
export function asPaged<T>(value: unknown): Paged<T> {
  const v = (value ?? {}) as Partial<Paged<T>>;
  return {
    total: num(v.total),
    limit: num(v.limit, 25),
    offset: num(v.offset),
    rows: Array.isArray(v.rows) ? v.rows : [],
  };
}

export function parseWhoAmI(value: unknown): AdminWhoAmI | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<AdminWhoAmI>;
  if (v.role !== "support" && v.role !== "admin") return null;
  if (typeof v.user_id !== "string") return null;
  return {
    user_id: v.user_id,
    role: v.role,
    full_name: typeof v.full_name === "string" ? v.full_name : null,
    impersonation: v.impersonation && typeof v.impersonation === "object" ? v.impersonation : null,
  };
}
