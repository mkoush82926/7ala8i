import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// ─── Get all leads for a shop ───
export async function getLeads(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .select("*")
    .eq("shop_id", shopId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
}

// ─── Create lead ───
export async function createLead(
  supabase: Client,
  shopId: string,
  lead: {
    name: string;
    contact?: string | null;
    stage?: string;
    value?: number | null;
    notes?: string | null;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .insert({
      shop_id: shopId,
      name: lead.name,
      contact: lead.contact,
      stage: lead.stage ?? "new",
      value: lead.value,
      notes: lead.notes,
    })
    .select()
    .single();
}

// ─── Update lead stage ───
export async function updateLeadStage(
  supabase: Client,
  leadId: string,
  stage: string,
  position?: number,
) {
  const updates: Record<string, unknown> = {
    stage,
    updated_at: new Date().toISOString(),
  };
  if (position !== undefined) updates.position = position;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .update(updates)
    .eq("id", leadId)
    .select()
    .single();
}

// ─── Update lead details ───
export async function updateLead(
  supabase: Client,
  leadId: string,
  updates: Partial<{
    name: string;
    contact: string | null;
    value: number | null;
    notes: string | null;
  }>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();
}

// ─── Delete lead ───
export async function deleteLead(supabase: Client, leadId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any).delete().eq("id", leadId);
}
