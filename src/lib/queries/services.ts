import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Columns the dashboard needs for the services list. */
export const SERVICE_COLUMNS = "id, name, name_ar, duration, price, icon, is_active, sort_order, created_at";

/** Columns safe to expose on public booking pages. */
export const PUBLIC_SERVICE_COLUMNS = "id, name, name_ar, duration, price, icon";

// ─── Get all services for a shop (dashboard: active + archived) ───
// Owner-defined order first (sort_order), creation date as a stable tie-breaker.
export async function getServices(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .select(SERVICE_COLUMNS)
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
}

// ─── Get services for public booking (no auth needed) ───
// Only ACTIVE services are bookable; a service the owner switched off (or
// archived instead of deleting) must never appear on the storefront. Ordered
// the way the owner arranged the menu, then by price.
export async function getPublicServices(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .select(PUBLIC_SERVICE_COLUMNS)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("price", { ascending: true });
}

export interface ServiceWrite {
  name: string;
  name_ar?: string | null;
  duration: number;
  price: number;
  icon?: string | null;
}

// ─── Create service ───
export async function createService(
  supabase: Client,
  shopId: string,
  service: ServiceWrite & { sort_order?: number | null },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .insert({
      shop_id: shopId,
      name: service.name,
      name_ar: service.name_ar ?? null,
      duration: service.duration,
      price: service.price,
      icon: service.icon ?? null,
      ...(service.sort_order != null ? { sort_order: service.sort_order } : {}),
    })
    .select(SERVICE_COLUMNS)
    .single();
}

// ─── Update service ───
// updated_at is maintained by a DB trigger — never sent from the client.
export async function updateService(
  supabase: Client,
  serviceId: string,
  updates: Partial<ServiceWrite & { is_active: boolean; sort_order: number }>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .update(updates)
    .eq("id", serviceId)
    .select(SERVICE_COLUMNS)
    .single();
}

// ─── Archive (soft delete) ───
// Archiving keeps the row so historical appointments (service_ids) and the
// barber_services links stay intact; it simply disappears from booking.
export async function archiveService(supabase: Client, serviceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any).update({ is_active: false }).eq("id", serviceId);
}

// ─── Is the service referenced by any appointment? ───
export async function countServiceAppointments(
  supabase: Client,
  shopId: string,
  serviceId: string,
): Promise<{ count: number | null; error: { message: string } | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase.from("appointments") as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any).delete().eq("id", serviceId);
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
    changed.map(({ id, index }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("services") as any).update({ sort_order: index }).eq("id", id),
    ),
  );
  const failed = (results as { error: { message: string } | null }[]).find((r) => r?.error);
  return { error: failed?.error ?? null };
}
