import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { LeadStage } from "@/lib/types";

type Client = SupabaseClient<Database>;

/** Columns the pipeline needs (no `select("*")`). */
export const LEAD_COLUMNS =
  "id, shop_id, client_id, name, phone, email, contact, stage, value, notes, position, created_at";

export interface LeadWrite {
  name: string;
  /** Stored in both `phone` and legacy `contact` so older readers keep working. */
  phone?: string | null;
  email?: string | null;
  stage?: LeadStage;
  value?: number | null;
  notes?: string | null;
  position?: number | null;
}

function toRow(lead: Partial<LeadWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (lead.name !== undefined) row.name = lead.name;
  if (lead.phone !== undefined) {
    row.phone = lead.phone || null;
    row.contact = lead.phone || null;
  }
  if (lead.email !== undefined) row.email = lead.email || null;
  if (lead.stage !== undefined) row.stage = lead.stage;
  if (lead.value !== undefined) row.value = lead.value;
  if (lead.notes !== undefined) row.notes = lead.notes || null;
  if (lead.position !== undefined) row.position = lead.position;
  return row;
}

// ─── Get all leads for a shop ───
export async function getLeads(supabase: Client, shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .select(LEAD_COLUMNS)
    .eq("shop_id", shopId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
}

// ─── Create lead ───
export async function createLead(supabase: Client, shopId: string, lead: LeadWrite) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .insert({ shop_id: shopId, ...toRow({ ...lead, stage: lead.stage ?? "new" }) })
    .select(LEAD_COLUMNS)
    .single();
}

// ─── Bulk create (CSV import) ───
export async function createLeads(supabase: Client, shopId: string, leads: LeadWrite[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any)
    .insert(leads.map((l) => ({ shop_id: shopId, ...toRow({ ...l, stage: l.stage ?? "new" }) })))
    .select(LEAD_COLUMNS);
}

// ─── Update lead stage (+ optional position within the column) ───
// updated_at is set by a DB trigger.
export async function updateLeadStage(
  supabase: Client,
  leadId: string,
  stage: LeadStage,
  position?: number,
) {
  const updates: Record<string, unknown> = { stage };
  if (position !== undefined) updates.position = position;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any).update(updates).eq("id", leadId);
}

// ─── Update lead details ───
export async function updateLead(supabase: Client, leadId: string, updates: Partial<LeadWrite>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any).update(toRow(updates)).eq("id", leadId);
}

// ─── Delete lead(s) ───
export async function deleteLead(supabase: Client, leadId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any).delete().eq("id", leadId);
}

export async function deleteLeads(supabase: Client, leadIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("leads") as any).delete().in("id", leadIds);
}
