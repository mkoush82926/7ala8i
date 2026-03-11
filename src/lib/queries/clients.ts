import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const PAGE_SIZE = 20;

// ─── Get clients (paginated + searchable) ───
export async function getClients(
  supabase: Client,
  shopId: string,
  page = 1,
  search = "",
) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("clients") as any)
    .select("*", { count: "exact" })
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search.trim()) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  return query;
}

// ─── Get single client ───
export async function getClientById(
  supabase: Client,
  clientId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .select("*")
    .eq("id", clientId)
    .single();
}

// ─── Upsert client ───
export async function upsertClient(
  supabase: Client,
  shopId: string,
  client: { name: string; phone: string; email?: string | null },
) {
  // Check if client with this phone already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from("clients") as any)
    .select("id")
    .eq("shop_id", shopId)
    .eq("phone", client.phone)
    .maybeSingle();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase.from("clients") as any)
      .update({
        name: client.name,
        email: client.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .insert({
      shop_id: shopId,
      name: client.name,
      phone: client.phone,
      email: client.email,
    })
    .select()
    .single();
}

// ─── Get client appointment history ───
export async function getClientAppointments(
  supabase: Client,
  clientId: string,
  limit = 10,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select("*")
    .eq("client_id", clientId)
    .order("start_time", { ascending: false })
    .limit(limit);
}
