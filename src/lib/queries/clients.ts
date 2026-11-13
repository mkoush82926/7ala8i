import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildIlikeOrFilter,
  containsPattern,
  normalizeSearchTerm,
  phoneDigits,
  quotePostgrestValue,
} from "@/lib/queries/search";

type Client = SupabaseClient<Database>;

export const PAGE_SIZE = 20;

/** Columns the dashboard reads for a client row (never `*`). */
export const CLIENT_COLUMNS =
  "id, shop_id, name, phone, email, notes, source, total_spend, created_at, updated_at";

export interface ClientRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: string | null;
  total_spend: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Fields staff can set on a client. `updated_at` is maintained by a DB trigger. */
export interface ClientInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  source?: string | null;
}

/** Trim strings and turn blanks into null so the DB stores NULL, not "". */
export function cleanClientInput(input: ClientInput): Required<ClientInput> {
  const blankToNull = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s ? s : null;
  };
  return {
    name: input.name.trim().replace(/\s+/g, " "),
    phone: blankToNull(input.phone),
    email: blankToNull(input.email)?.toLowerCase() ?? null,
    notes: blankToNull(input.notes),
    source: blankToNull(input.source),
  };
}

/** The `.or()` filter used by the clients list search (name, phone, email, phone digits). */
export function clientSearchFilter(search: string): string {
  const term = normalizeSearchTerm(search);
  if (!term) return "";
  let filter = buildIlikeOrFilter(["name", "phone", "email"], term);
  const digits = phoneDigits(term);
  // "079 123 4567" should find "+962791234567": also match the generated
  // digits-only column when the term looks like (part of) a phone number.
  if (digits.length >= 3 && digits !== term) {
    filter += `,phone_digits.ilike.${quotePostgrestValue(containsPattern(digits))}`;
  }
  return filter;
}

// ─── Get clients (paginated + searchable, soft-deleted rows excluded) ───
export async function getClients(
  supabase: Client,
  shopId: string,
  page = 1,
  search = "",
) {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("clients") as any)
    .select(CLIENT_COLUMNS, { count: "exact" })
    .eq("shop_id", shopId)
    .is("deleted_at", null);

  const filter = clientSearchFilter(search);
  if (filter) query = query.or(filter);

  return query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
}

// ─── Get single client ───
export async function getClientById(
  supabase: Client,
  clientId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();
}

// ─── Create client (staff) ───
export async function createClientRecord(
  supabase: Client,
  shopId: string,
  input: ClientInput,
) {
  const values = cleanClientInput(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .insert({ shop_id: shopId, ...values })
    .select(CLIENT_COLUMNS)
    .single();
}

// ─── Update client (staff) ───
export async function updateClientRecord(
  supabase: Client,
  shopId: string,
  clientId: string,
  input: ClientInput,
) {
  const values = cleanClientInput(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .update(values)
    .eq("id", clientId)
    .eq("shop_id", shopId)
    .select(CLIENT_COLUMNS)
    .single();
}

// ─── Soft delete client ───
// Hard DELETE is admin-only and would orphan history; staff archive instead.
// Appointments, reviews and leads keep their link (FKs are ON DELETE SET NULL
// for real deletes anyway).
export async function softDeleteClient(
  supabase: Client,
  shopId: string,
  clientId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("shop_id", shopId);
}

/** Undo a soft delete (used by the "Undo" toast action). */
export async function restoreClient(
  supabase: Client,
  shopId: string,
  clientId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .update({ deleted_at: null })
    .eq("id", clientId)
    .eq("shop_id", shopId);
}

// ─── Upsert client ───
export async function upsertClient(
  supabase: Client,
  shopId: string,
  client: { name: string; phone: string; email?: string | null },
) {
  // Check if an active client with this phone already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from("clients") as any)
    .select("id")
    .eq("shop_id", shopId)
    .eq("phone", client.phone)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase.from("clients") as any)
      .update({
        name: client.name,
        email: client.email ?? null,
      })
      .eq("id", existing.id)
      .select(CLIENT_COLUMNS)
      .single();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("clients") as any)
    .insert({
      shop_id: shopId,
      name: client.name,
      phone: client.phone,
      email: client.email ?? null,
    })
    .select(CLIENT_COLUMNS)
    .single();
}

export interface ClientAppointmentRow {
  id: string;
  start_time: string;
  status: string;
  price: number | null;
  currency: string | null;
  service_name: string | null;
  barber_id: string | null;
}

// ─── Get client appointment history ───
export async function getClientAppointments(
  supabase: Client,
  clientId: string,
  limit = 10,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select("id, start_time, status, price, currency, service_name, barber_id")
    .eq("client_id", clientId)
    .order("start_time", { ascending: false })
    .limit(limit);
}

/** Visit stats derived from an appointment history (completed visits only). */
export function summarizeVisits(rows: readonly Pick<ClientAppointmentRow, "start_time" | "status">[]) {
  const completed = rows.filter((r) => r.status === "completed");
  const lastVisit = completed.reduce<string | null>(
    (latest, r) => (!latest || r.start_time > latest ? r.start_time : latest),
    null,
  );
  return { visits: completed.length, lastVisit };
}

