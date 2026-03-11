import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// ─── Get all services for a shop ───
export async function getServices(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });
}

// ─── Get services for public booking (no auth needed) ───
export async function getPublicServices(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .select("id, name, name_ar, duration, price")
    .eq("shop_id", shopId)
    .order("price", { ascending: true });
}

// ─── Create service ───
export async function createService(
  supabase: Client,
  shopId: string,
  service: { name: string; name_ar?: string | null; duration: number; price: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .insert({
      shop_id: shopId,
      name: service.name,
      name_ar: service.name_ar,
      duration: service.duration,
      price: service.price,
    })
    .select()
    .single();
}

// ─── Update service ───
export async function updateService(
  supabase: Client,
  serviceId: string,
  updates: Partial<{ name: string; name_ar: string | null; duration: number; price: number }>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any)
    .update(updates)
    .eq("id", serviceId)
    .select()
    .single();
}

// ─── Delete service ───
export async function deleteService(supabase: Client, serviceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("services") as any).delete().eq("id", serviceId);
}
