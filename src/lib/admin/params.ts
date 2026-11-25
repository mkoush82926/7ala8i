/**
 * URL search-param parsing for the back office. Filters and pagination live
 * in the URL so a support agent can share an exact view with a colleague.
 */
import { CLAIM_STATUSES, REPORT_STATUSES, type ClaimStatus, type ReportStatus } from "./types";

export const SHOP_STATUS_FILTERS = ["all", "published", "unpublished", "unverified", "verified", "suspended"] as const;
export type ShopStatusFilter = (typeof SHOP_STATUS_FILTERS)[number];

export const AUDIT_TARGET_TYPES = [
  "shop",
  "profile",
  "phone",
  "review",
  "review_report",
  "claim",
  "plan",
  "impersonation",
  "service",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed; "" when absent. */
export function first(params: RawSearchParams | undefined, key: string): string {
  const raw = params?.[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** 1-based page number, clamped to a sane range. */
export function parsePage(params: RawSearchParams | undefined): number {
  const n = Number.parseInt(first(params, "page"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export function offsetFor(page: number, size: number): number {
  return Math.max(0, (Math.max(1, page) - 1) * size);
}

export interface ShopFilters {
  q: string;
  status: ShopStatusFilter;
  city: string | null;
  page: number;
}

export function parseShopFilters(params: RawSearchParams | undefined): ShopFilters {
  const city = first(params, "city");
  return {
    q: first(params, "q").slice(0, 100),
    status: oneOf(first(params, "status"), SHOP_STATUS_FILTERS, "all"),
    city: isUuid(city) ? city : null,
    page: parsePage(params),
  };
}

export function parseReportStatus(params: RawSearchParams | undefined): ReportStatus {
  return oneOf(first(params, "status"), REPORT_STATUSES, "open");
}

export function parseClaimStatus(params: RawSearchParams | undefined): ClaimStatus {
  return oneOf(first(params, "status"), CLAIM_STATUSES, "open");
}

export interface AuditFilters {
  action: string;
  type: AuditTargetType | null;
  target: string;
  page: number;
}

export function parseAuditFilters(params: RawSearchParams | undefined): AuditFilters {
  const action = first(params, "action");
  const type = first(params, "type");
  return {
    // Prefix match server-side ("shop" or "shop.verify"): letters, _ and dots only.
    action: /^[a-z_]+(\.[a-z_]+)?$/.test(action) ? action : "",
    type: (AUDIT_TARGET_TYPES as readonly string[]).includes(type) ? (type as AuditTargetType) : null,
    target: first(params, "target").slice(0, 64),
    page: parsePage(params),
  };
}

/**
 * Builds a query string from a base path and params, dropping empty values
 * and defaults so URLs stay short. `page` 1 is dropped too.
 */
export function buildHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    if (defaults[key] !== undefined && String(defaults[key]) === String(value)) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** "26–50 of 120" bounds for a page; null when there are no rows. */
export function pageBounds(page: number, size: number, total: number): { from: number; to: number } | null {
  if (total <= 0) return null;
  const from = offsetFor(page, size) + 1;
  if (from > total) return null;
  return { from, to: Math.min(total, from + size - 1) };
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Nav highlighting: exact match, or `href` is a path-segment prefix of `pathname`. */
export function isActivePath(pathname: string | null | undefined, href: string, exact = false): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}
