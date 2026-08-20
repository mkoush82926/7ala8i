import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { startOfDay } from "date-fns";

type Client = SupabaseClient<Database>;

const RESULT_LIMIT = 5;

// PostgREST's `.or()` filter string uses `,` to separate conditions and
// `(` `)` `*` have syntactic meaning too — strip them from user input so a
// pasted phone number or name can't break the filter (and silently fail).
// Mirrors the equivalent helper in `src/lib/queries/clients.ts`.
function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()*]/g, "");
}

export interface WorkspaceSearchResult {
  clients: { id: string; name: string; phone: string | null }[];
  leads: { id: string; name: string; contact: string | null }[];
  appointments: {
    id: string;
    client_name: string;
    start_time: string;
    barber_id: string | null;
  }[];
}

const EMPTY_RESULT: WorkspaceSearchResult = {
  clients: [],
  leads: [],
  appointments: [],
};

// ─── Combined workspace search (clients + leads + upcoming appointments) ───
export async function searchWorkspace(
  supabase: Client,
  shopId: string,
  query: string,
): Promise<WorkspaceSearchResult> {
  const term = sanitizeFilterValue(query.trim());
  if (!shopId || !term) return EMPTY_RESULT;

  const todayStart = startOfDay(new Date()).toISOString();

  const [clientsRes, leadsRes, appointmentsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("clients") as any)
      .select("id, name, phone")
      .eq("shop_id", shopId)
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(RESULT_LIMIT),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("leads") as any)
      .select("id, name, contact")
      .eq("shop_id", shopId)
      .or(`name.ilike.%${term}%,contact.ilike.%${term}%`)
      .limit(RESULT_LIMIT),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("appointments") as any)
      .select("id, client_name, start_time, barber_id")
      .eq("shop_id", shopId)
      .gte("start_time", todayStart)
      .ilike("client_name", `%${term}%`)
      .order("start_time", { ascending: true })
      .limit(RESULT_LIMIT),
  ]);

  return {
    clients: (clientsRes.data ?? []) as WorkspaceSearchResult["clients"],
    leads: (leadsRes.data ?? []) as WorkspaceSearchResult["leads"],
    appointments: (appointmentsRes.data ??
      []) as WorkspaceSearchResult["appointments"],
  };
}
