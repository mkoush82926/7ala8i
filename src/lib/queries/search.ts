import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { startOfDay } from "date-fns";

type Client = SupabaseClient<Database>;

const RESULT_LIMIT = 5;
/** Longest search term we send to PostgREST; anything longer is truncated. */
export const MAX_SEARCH_LENGTH = 100;

// ─── Safe search-term helpers ────────────────────────────────────────────────
//
// User input must never be spliced raw into a PostgREST filter string:
//   • In `.or("a.ilike.x,b.ilike.y")` the characters `,` `.` `:` `(` `)` are
//     syntax. PostgREST lets a value contain them when it is wrapped in double
//     quotes, with `"` and `\` escaped by a backslash inside the quotes.
//   • In a LIKE pattern `%` and `_` are wildcards and `\` is the escape
//     character, so a literal "50%" must be sent as "50\%".
//   • PostgREST also treats `*` as an alias for `%` in like/ilike values, so
//     we drop it (there is no way to escape it).

/** Trim, collapse whitespace, drop `*` and control characters, cap the length. */
export function normalizeSearchTerm(raw: string | null | undefined): string {
  return (raw ?? "")
    // Whitespace first so a tab or newline still separates words.
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f\u007f*]/g, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/** Escape LIKE wildcards so the term matches literally inside `%…%`. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** `%term%` with LIKE wildcards escaped — for the `.ilike(column, pattern)` method. */
export function containsPattern(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}

// Values made only of letters, digits, spaces, "@", "+", "-" and the LIKE "%"
// wrappers can't be misread by PostgREST, so they are sent unquoted (this also
// keeps the local mock client's simple `.or()` parser working). Anything else
// is double-quoted with `"` and `\` escaped.
const PLAIN_FILTER_VALUE = /^[\p{L}\p{N}\p{M} @+%-]*$/u;

/** Quote a value for use inside a PostgREST `.or()` / `.filter()` string. */
export function quotePostgrestValue(value: string): string {
  if (PLAIN_FILTER_VALUE.test(value)) return value;
  return `"${value.replace(/["\\]/g, (ch) => `\\${ch}`)}"`;
}

/**
 * Builds `col1.ilike."%term%",col2.ilike."%term%"` for `.or()`, with the term
 * LIKE-escaped and PostgREST-quoted, so commas, dots, parentheses, quotes,
 * `%` and `_` in the input are all matched literally.
 * Returns "" when the term is empty (callers skip the filter).
 */
export function buildIlikeOrFilter(columns: readonly string[], rawTerm: string): string {
  const term = normalizeSearchTerm(rawTerm);
  if (!term || columns.length === 0) return "";
  const value = quotePostgrestValue(containsPattern(term));
  return columns.map((column) => `${column}.ilike.${value}`).join(",");
}

/** Digits only — used to match a phone typed with spaces, dashes or a "+". */
export function phoneDigits(term: string): string {
  return term.replace(/\D/g, "");
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
  options: { includeLeads?: boolean } = {},
): Promise<WorkspaceSearchResult> {
  // Leads are admin-only (RLS + nav); barbers skip the always-empty query.
  const includeLeads = options.includeLeads ?? true;
  const term = normalizeSearchTerm(query);
  if (!shopId || !term) return EMPTY_RESULT;

  const todayStart = startOfDay(new Date()).toISOString();
  const digits = phoneDigits(term);
  // A phone typed as "079 123 4567" should match the stored "+962791234567":
  // compare against the generated digits-only column as well.
  let clientFilter = buildIlikeOrFilter(["name", "phone"], term);
  if (digits.length >= 3 && digits !== term) {
    clientFilter += `,phone_digits.ilike.${quotePostgrestValue(containsPattern(digits))}`;
  }

  const [clientsRes, leadsRes, appointmentsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("clients") as any)
      .select("id, name, phone")
      .eq("shop_id", shopId)
      .is("deleted_at", null)
      .or(clientFilter)
      .limit(RESULT_LIMIT),
    includeLeads
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("leads") as any)
          .select("id, name, contact")
          .eq("shop_id", shopId)
          .or(buildIlikeOrFilter(["name", "contact"], term))
          .limit(RESULT_LIMIT)
      : Promise.resolve({ data: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("appointments") as any)
      .select("id, client_name, start_time, barber_id")
      .eq("shop_id", shopId)
      .gte("start_time", todayStart)
      .ilike("client_name", containsPattern(term))
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
