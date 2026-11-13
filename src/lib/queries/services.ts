import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type DbError = { message: string; code?: string } | null;

// The v2 catalogue columns (WS-1D / P0 / P0V) are newer than
// database.types.ts, so these queries use the untyped builder and fall back
// to the legacy column set when a column does not exist yet.

/** Columns the dashboard needs for the services list (legacy set). */
export const SERVICE_COLUMNS = "id, name, name_ar, duration, price, icon, is_active, sort_order, created_at";

/** Catalogue v2: price types, details, online booking and timing. */
export const SERVICE_COLUMNS_V2 = `${SERVICE_COLUMNS}, price_type, audience, location_type, description_en, description_ar, client_note_en, client_note_ar, online_bookable, category_id, buffer_minutes, processing_offset_minutes, processing_minutes`;

/** Columns safe to expose on public booking pages. */
export const PUBLIC_SERVICE_COLUMNS = "id, name, name_ar, duration, price, icon";

export const VARIANT_COLUMNS = "id, service_id, name_en, name_ar, price, duration, sort, is_active";

export const SHOP_BOOKING_RULE_COLUMNS =
  "min_notice_minutes, booking_window_days, slot_interval_minutes, important_info_en, important_info_ar";

export type PriceType = "fixed" | "from" | "free";
export type Audience = "everyone" | "men" | "women" | "kids";
export type LocationType = "in_shop" | "home";

export const PRICE_TYPES: PriceType[] = ["fixed", "from", "free"];
export const AUDIENCES: Audience[] = ["everyone", "men", "women", "kids"];
export const LOCATION_TYPES: LocationType[] = ["in_shop", "home"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (supabase: Client, table: string) => (supabase as any).from(table);

/** Runs the v2 query; on a missing-column error runs the legacy one. */
async function withLegacyFallback<T>(
  v2: () => PromiseLike<{ data: T | null; error: DbError }>,
  legacy: () => PromiseLike<{ data: T | null; error: DbError }>,
): Promise<{ data: T | null; error: DbError; legacy: boolean }> {
  const first = await v2();
  if (!first.error) return { ...first, legacy: false };
  // 42703 undefined_column (PostgREST surfaces it as code "42703" / PGRST204).
  const code = first.error.code ?? "";
  if (code === "42703" || code === "PGRST204" || /column/i.test(first.error.message)) {
    const second = await legacy();
    return { ...second, legacy: true };
  }
  return { ...first, legacy: false };
}

// ─── Get all services for a shop (dashboard: active + archived) ───
// Owner-defined order first (sort_order), creation date as a stable tie-breaker.
export async function getServices(supabase: Client, shopId: string) {
  const run = (columns: string) =>
    from(supabase, "services")
      .select(columns)
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  return withLegacyFallback<Record<string, unknown>[]>(() => run(SERVICE_COLUMNS_V2), () => run(SERVICE_COLUMNS));
}

// ─── Get services for public booking (no auth needed) ───
// Only ACTIVE services are bookable; a service the owner switched off (or
// archived instead of deleting) must never appear on the storefront. Ordered
// the way the owner arranged the menu, then by price.
export async function getPublicServices(supabase: Client, shopId: string) {
  return from(supabase, "services")
    .select(PUBLIC_SERVICE_COLUMNS)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("price", { ascending: true });
}

/** Fields the catalogue editor writes. Legacy callers send only the first five. */
export interface ServiceWrite {
  name: string;
  name_ar?: string | null;
  duration: number;
  price: number;
  icon?: string | null;
  price_type?: PriceType;
  audience?: Audience;
  location_type?: LocationType;
  description_en?: string | null;
  description_ar?: string | null;
  client_note_en?: string | null;
  client_note_ar?: string | null;
  online_bookable?: boolean;
  category_id?: string | null;
  buffer_minutes?: number;
  processing_offset_minutes?: number;
  processing_minutes?: number;
}

const LEGACY_WRITE_KEYS = ["name", "name_ar", "duration", "price", "icon", "is_active", "sort_order"] as const;

/** Only the legacy columns (for databases without the v2 migration). */
export function legacyServiceWrite<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of LEGACY_WRITE_KEYS) if (k in row) (out as Record<string, unknown>)[k] = row[k];
  return out;
}

// ─── Create service ───
export async function createService(
  supabase: Client,
  shopId: string,
  service: ServiceWrite & { sort_order?: number | null },
) {
  const { sort_order, ...rest } = service;
  const row: Record<string, unknown> = {
    shop_id: shopId,
    ...rest,
    name_ar: service.name_ar ?? null,
    icon: service.icon ?? null,
    ...(sort_order != null ? { sort_order } : {}),
  };
  const run = (r: Record<string, unknown>, columns: string) => from(supabase, "services").insert(r).select(columns).single();
  return withLegacyFallback<Record<string, unknown>>(
    () => run(row, SERVICE_COLUMNS_V2),
    () => run({ shop_id: shopId, ...legacyServiceWrite(row) }, SERVICE_COLUMNS),
  );
}

// ─── Update service ───
// updated_at is maintained by a DB trigger — never sent from the client.
export async function updateService(
  supabase: Client,
  serviceId: string,
  updates: Partial<ServiceWrite & { is_active: boolean; sort_order: number }>,
) {
  const run = (u: Record<string, unknown>, columns: string) =>
    from(supabase, "services").update(u).eq("id", serviceId).select(columns).single();
  return withLegacyFallback<Record<string, unknown>>(
    () => run(updates as Record<string, unknown>, SERVICE_COLUMNS_V2),
    () => run(legacyServiceWrite(updates as Record<string, unknown>), SERVICE_COLUMNS),
  );
}

// ─── Archive (soft delete) ───
// Archiving keeps the row so historical appointments (service_ids) and the
// barber_services links stay intact; it simply disappears from booking.
export async function archiveService(supabase: Client, serviceId: string) {
  return from(supabase, "services").update({ is_active: false }).eq("id", serviceId);
}

// ─── Is the service referenced by any appointment? ───
export async function countServiceAppointments(
  supabase: Client,
  shopId: string,
  serviceId: string,
): Promise<{ count: number | null; error: { message: string } | null }> {
  try {
    const res = await from(supabase, "appointments")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .contains("service_ids", [serviceId]);
    return { count: res?.count ?? null, error: res?.error ?? null };
  } catch (err) {
    // e.g. a client without array operators (mock preview) — callers treat
    // an unknown count as "referenced" and archive instead of deleting.
    return { count: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// ─── Delete service (hard) ───
// Only safe for services never used by an appointment. Prefer
// removeService(), which archives referenced services instead.
export async function deleteService(supabase: Client, serviceId: string) {
  return from(supabase, "services").delete().eq("id", serviceId);
}

/**
 * Removes a service without breaking history: if any appointment references
 * it, it is archived (is_active=false); otherwise it is deleted.
 */
export async function removeService(
  supabase: Client,
  shopId: string,
  serviceId: string,
): Promise<{ result: "archived" | "deleted" | null; error: { message: string; code?: string } | null }> {
  const { count, error: countError } = await countServiceAppointments(supabase, shopId, serviceId);
  // When the reference check itself fails, fall back to the safe option.
  if (countError || count === null || count > 0) {
    const { error } = await archiveService(supabase, serviceId);
    return { result: error ? null : "archived", error: error ?? null };
  }
  const { error } = await deleteService(supabase, serviceId);
  return { result: error ? null : "deleted", error: error ?? null };
}

// ─── Persist a new order ───
// Writes sort_order only for rows whose position changed.
export async function saveServiceOrder(
  supabase: Client,
  orderedIds: string[],
  previousIds: string[] = [],
): Promise<{ error: { message: string } | null }> {
  const changed = orderedIds
    .map((id, index) => ({ id, index }))
    .filter(({ id, index }) => previousIds[index] !== id);
  const results = await Promise.all(
    changed.map(({ id, index }) => from(supabase, "services").update({ sort_order: index }).eq("id", id)),
  );
  const failed = (results as { error: { message: string } | null }[]).find((r) => r?.error);
  return { error: failed?.error ?? null };
}

// ═══ Variants ═══

export interface VariantRow {
  id: string;
  service_id: string;
  name_en: string;
  name_ar: string | null;
  price: number;
  duration: number;
  sort: number;
  is_active: boolean;
}

/** A variant as edited in the form (no id = new). */
export interface VariantDraft {
  id?: string | null;
  name_en: string;
  name_ar: string | null;
  price: number;
  duration: number;
}

/** All variants of a shop (empty when the table does not exist yet). */
export async function getVariants(supabase: Client, shopId: string): Promise<{ data: VariantRow[]; error: DbError }> {
  const res = await from(supabase, "service_variants")
    .select(VARIANT_COLUMNS)
    .eq("shop_id", shopId)
    .order("sort", { ascending: true });
  if (res.error) return { data: [], error: res.error };
  return {
    data: ((res.data ?? []) as Record<string, unknown>[]).map((v) => ({
      id: String(v.id),
      service_id: String(v.service_id),
      name_en: String(v.name_en ?? ""),
      name_ar: (v.name_ar as string | null) ?? null,
      price: Number(v.price) || 0,
      duration: Number(v.duration) || 0,
      sort: Number(v.sort) || 0,
      is_active: v.is_active !== false,
    })),
    error: null,
  };
}

export interface VariantPlan {
  insert: (Omit<VariantDraft, "id"> & { sort: number })[];
  update: (VariantDraft & { id: string; sort: number })[];
  remove: string[];
}

/** Diff of the drafts against the stored variants of one service. */
export function planVariantChanges(existing: ReadonlyArray<VariantRow>, drafts: ReadonlyArray<VariantDraft>): VariantPlan {
  const byId = new Map(existing.map((v) => [v.id, v]));
  const keep = new Set<string>();
  const plan: VariantPlan = { insert: [], update: [], remove: [] };
  drafts.forEach((d, sort) => {
    const clean = { name_en: d.name_en.trim(), name_ar: d.name_ar?.trim() || null, price: d.price, duration: d.duration };
    const prev = d.id ? byId.get(d.id) : undefined;
    if (prev) {
      keep.add(prev.id);
      const changed =
        prev.name_en !== clean.name_en || prev.name_ar !== clean.name_ar || prev.price !== clean.price ||
        prev.duration !== clean.duration || prev.sort !== sort || !prev.is_active;
      if (changed) plan.update.push({ ...clean, id: prev.id, sort });
    } else {
      plan.insert.push({ ...clean, sort });
    }
  });
  for (const v of existing) if (!keep.has(v.id)) plan.remove.push(v.id);
  return plan;
}

/**
 * Saves a service's variants. Removed variants are deactivated (not
 * deleted) so booked lines that reference them keep their history.
 */
export async function saveVariants(
  supabase: Client,
  serviceId: string,
  existing: ReadonlyArray<VariantRow>,
  drafts: ReadonlyArray<VariantDraft>,
): Promise<{ error: DbError }> {
  const plan = planVariantChanges(existing.filter((v) => v.service_id === serviceId), drafts);
  const ops: PromiseLike<{ error: DbError }>[] = [];
  if (plan.insert.length) {
    // shop_id is set by a trigger from the parent service.
    ops.push(from(supabase, "service_variants").insert(plan.insert.map((v) => ({ ...v, service_id: serviceId, is_active: true }))));
  }
  for (const v of plan.update) {
    const { id, ...rest } = v;
    ops.push(from(supabase, "service_variants").update({ ...rest, is_active: true }).eq("id", id));
  }
  if (plan.remove.length) {
    ops.push(from(supabase, "service_variants").update({ is_active: false }).in("id", plan.remove));
  }
  const results = await Promise.all(ops);
  return { error: results.find((r) => r?.error)?.error ?? null };
}

// ═══ Categories (marketplace taxonomy, read-only) ═══

export interface CategoryRow {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

export async function getCategories(supabase: Client): Promise<{ data: CategoryRow[]; error: DbError }> {
  const res = await from(supabase, "service_categories")
    .select("id, slug, name_en, name_ar, sort")
    .eq("is_active", true)
    .order("sort", { ascending: true });
  return { data: (res.data ?? []) as CategoryRow[], error: res.error ?? null };
}

// ═══ Shop booking rules (P0V columns + WS-1D important info) ═══

export interface BookingRules {
  min_notice_minutes: number;
  booking_window_days: number;
  slot_interval_minutes: number;
  important_info_en: string | null;
  important_info_ar: string | null;
}

export const DEFAULT_BOOKING_RULES: BookingRules = {
  min_notice_minutes: 5,
  booking_window_days: 90,
  slot_interval_minutes: 15,
  important_info_en: null,
  important_info_ar: null,
};

export async function getBookingRules(supabase: Client, shopId: string): Promise<{ data: BookingRules | null; error: DbError }> {
  const res = await from(supabase, "shops").select(SHOP_BOOKING_RULE_COLUMNS).eq("id", shopId).maybeSingle();
  if (res.error) return { data: null, error: res.error };
  const row = (res.data ?? {}) as Partial<BookingRules>;
  return {
    data: {
      min_notice_minutes: Number(row.min_notice_minutes ?? DEFAULT_BOOKING_RULES.min_notice_minutes),
      booking_window_days: Number(row.booking_window_days ?? DEFAULT_BOOKING_RULES.booking_window_days),
      slot_interval_minutes: Number(row.slot_interval_minutes ?? DEFAULT_BOOKING_RULES.slot_interval_minutes),
      important_info_en: row.important_info_en ?? null,
      important_info_ar: row.important_info_ar ?? null,
    },
    error: null,
  };
}

export async function updateBookingRules(supabase: Client, shopId: string, rules: BookingRules): Promise<{ error: DbError }> {
  const res = await from(supabase, "shops").update(rules).eq("id", shopId);
  return { error: res.error ?? null };
}
