// ─────────────────────────────────────────────────────────────────────────
// LOCAL DESIGN-PREVIEW MOCK SUPABASE CLIENT — never used in production.
//
// A minimal, in-memory stand-in for `@supabase/ssr`'s browser client, just
// wide enough to cover the query patterns the public marketplace pages
// (explore / shop profile / booking wizard) actually use: `.from(table)`
// chained with `.select()/.eq()/.in()/.order()/.limit()/.single()/.gte()/
// .lte()`, resolving like a real Supabase query builder (awaitable, and a
// `.then()` so `await` works without calling `.select()` first).
//
// Only ever constructed from src/lib/supabase/client.ts when mock mode is
// on — MOCK_DATA_ENABLED (src/lib/mock-data.ts ← src/lib/env.ts) is always
// false in production builds unless explicitly forced.
//
// Tables this mock doesn't have real content for (clients, leads,
// appointments-writes, analytics, etc. — the authenticated dashboard side of
// the app) resolve to an empty result rather than throwing, so navigating
// into the dashboard with the flag on degrades gracefully instead of
// crashing; it just won't show anything, since dashboard mocking is out of
// scope for "preview the public booking flow".
// ─────────────────────────────────────────────────────────────────────────

import {
  MOCK_SHOPS, MOCK_SERVICES, MOCK_PROFILES, MOCK_BARBERS, MOCK_REVIEWS, MOCK_WORKING_HOURS, MOCK_APPOINTMENTS,
  MOCK_AUTH_ROLE, MOCK_ADMIN_ID, MOCK_ADMIN_PROFILE, MOCK_CLIENTS, type MockAppointment,
} from "@/lib/mock-data";
import type { BookingResult, BusySlot, CancelBookingResult } from "@/lib/supabase/database.types";
import { FALLBACK_CITY } from "@/lib/search/fallback";

type Row = Record<string, unknown>;

const TABLES: Record<string, Row[]> = {
  shops: MOCK_SHOPS as unknown as Row[],
  services: MOCK_SERVICES as unknown as Row[],
  profiles: MOCK_PROFILES as unknown as Row[],
  reviews: MOCK_REVIEWS as unknown as Row[],
  working_hours: MOCK_WORKING_HOURS as unknown as Row[],
  appointments: MOCK_APPOINTMENTS as unknown as Row[],
  clients: MOCK_CLIENTS as unknown as Row[],
  // Dashboard tables this mock has no seed content for yet — resolving to an
  // empty array (rather than throwing/being absent) is enough for the pages
  // that read them to render their real, already-styled empty states.
  leads: [],
  daily_sales: [],
};

type Result<T> = { data: T | null; error: null; count?: number };
type RpcResult = { data: unknown; error: { code: string; message: string } | null };

function getAtPath(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Row)[key] : undefined), row);
}

class MockQueryBuilder implements PromiseLike<Result<Row[] | Row>> {
  private rows: Row[];
  private wantSingle = false;
  private wantCount = false;
  private totalCount: number | null = null;

  constructor(table: string) {
    // Slice so filters never mutate the shared mock arrays.
    this.rows = (TABLES[table] ?? []).slice();
  }

  select(_columns?: string, options?: { count?: "exact" | "planned" | "estimated" }) {
    // No real column projection — every mock row is already shaped exactly
    // like the real query's expected result, embeds (`clients(name)`,
    // `barber_services(service_id)`) included.
    if (options?.count) this.wantCount = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => getAtPath(r, column) === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => getAtPath(r, column) !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => (getAtPath(r, column) ?? null) === value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.rows = this.rows.filter((r) => String(getAtPath(r, column) ?? "").toLowerCase().includes(needle));
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    this.rows = this.rows.filter((r) => set.has(getAtPath(r, column)));
    return this;
  }

  // Best-effort PostgREST `.or("col.ilike.%val%,col2.ilike.%val%")` — keeps a
  // row if ANY comma-separated clause matches (case-insensitive substring for
  // ilike, exact for anything else). Good enough for the search boxes that
  // use this against an always-empty mock table; not a full PostgREST parser.
  or(filterString: string) {
    const clauses = filterString.split(",").map((c) => c.trim()).filter(Boolean);
    this.rows = this.rows.filter((row) =>
      clauses.some((clause) => {
        const [column, op, rawValue] = clause.split(".");
        if (!column || !op) return false;
        const cell = getAtPath(row, column);
        if (op === "ilike" || op === "like") {
          const needle = rawValue.replace(/%/g, "").toLowerCase();
          return String(cell ?? "").toLowerCase().includes(needle);
        }
        return String(cell ?? "") === rawValue;
      }),
    );
    return this;
  }

  range(from: number, to: number) {
    // Exact count reflects the full filtered set, taken before this page's
    // slice is applied — matches real PostgREST's count-vs-range semantics.
    this.totalCount = this.rows.length;
    this.rows = this.rows.slice(from, to + 1);
    return this;
  }

  gte(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(getAtPath(r, column) ?? "") >= value);
    return this;
  }

  lte(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(getAtPath(r, column) ?? "") <= value);
    return this;
  }

  lt(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(getAtPath(r, column) ?? "") < value);
    return this;
  }

  gt(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(getAtPath(r, column) ?? "") > value);
    return this;
  }

  like(column: string, pattern: string) {
    return this.ilike(column, pattern);
  }

  match(query: Record<string, unknown>) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }

  // Filters the preview data has no use for (array/range operators, negation,
  // full-text): accepted so chains don't crash, rows are left unfiltered.
  not(_column: string, _operator: string, _value: unknown) { return this; }
  contains(_column: string, _value: unknown) { return this; }
  overlaps(_column: string, _value: unknown) { return this; }
  filter(_column: string, _operator: string, _value: unknown) { return this; }
  textSearch(_column: string, _query: string) { return this; }
  returns() { return this; }
  throwOnError() { return this; }

  order(column: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows = [...this.rows].sort((a, b) => {
      const av = getAtPath(a, column);
      const bv = getAtPath(b, column);
      if (av === bv) return 0;
      return (av! < bv! ? -1 : 1) * dir;
    });
    return this;
  }

  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  abortSignal(_signal: AbortSignal) {
    return this;
  }

  // No-op writes — the guest-facing pages this mock exists for are all
  // read-only; dashboard CRUD paths that hit these will just get a harmless
  // empty success rather than a crash.
  insert(_values: unknown) { return this; }
  update(_values: unknown) { return this; }
  upsert(_values: unknown) { return this; }
  delete() { return this; }

  private resolve(): Result<Row[] | Row> {
    const count = this.wantCount ? (this.totalCount ?? this.rows.length) : undefined;
    if (this.wantSingle) {
      return { data: this.rows[0] ?? null, error: null, count };
    }
    return { data: this.rows, error: null, count };
  }

  // Makes the builder itself awaitable, matching real supabase-js query
  // builders (which are PromiseLike without an explicit terminal call).
  then<TResult1 = Result<Row[] | Row>, TResult2 = never>(
    onfulfilled?: ((value: Result<Row[] | Row>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

// No-op Realtime stand-in — the dashboard topbar subscribes to postgres_changes
// for live notifications; nothing in this mock ever pushes new rows, so the
// channel just needs to chain/subscribe without erroring, never actually fire.
class MockChannel {
  on() { return this; }
  subscribe() { return this; }
}

export function createMockClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table);
    },
    channel(_name: string) {
      return new MockChannel();
    },
    removeChannel(_channel: unknown) {},
    auth: {
      // Guest visitor by default — matches the real anonymous-browsing state
      // the public pages already support (booking works without an
      // account). Only returns a fake signed-in user when NEXT_PUBLIC_MOCK_
      // AUTH_ROLE is explicitly set (see src/lib/mock-data.ts), to also
      // preview the auth-gated dashboard — middleware.ts has the matching
      // server-side bypass so the two stay consistent.
      async getUser() {
        if (!MOCK_AUTH_ROLE) return { data: { user: null }, error: null };
        return {
          data: {
            user: {
              id: MOCK_ADMIN_ID,
              email: "preview@halaqy.test",
              user_metadata: { role: MOCK_AUTH_ROLE },
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },
    // In-memory RPC stand-ins implementing the same contract as the real
    // SECURITY DEFINER functions (see 20250101001600_production_hardening.sql),
    // so the booking wizard and portals can be exercised end-to-end in mock mode.
    async rpc(fn: string, args: Record<string, unknown> = {}): Promise<RpcResult> {
      return mockRpc(fn, args);
    },
  };
}

function rpcError(code: string): RpcResult {
  return { data: null, error: { code: "P0001", message: code } };
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ACTIVE = new Set(["pending", "confirmed"]);

/** Shop rows shaped like the search_shops RPC (preview fixtures only). */
function mockSearchShops(args: Record<string, unknown>): Row[] {
  const q = String(args.p_q ?? "").trim().toLowerCase();
  const areaId = typeof args.p_area_id === "string" ? args.p_area_id : null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = localDay(tomorrow.toISOString());
  const rows = MOCK_SHOPS.filter((shop) => shop.is_published && shop.marketplace_visible)
    .map((shop, i) => {
      const area = FALLBACK_CITY.areas.find((a) => a.slug === shop.area_slug);
      if (areaId && area?.id !== areaId) return null;
      const services = MOCK_SERVICES.filter((sv) => sv.shop_id === shop.id && sv.is_active);
      const matched = q ? services.filter((sv) => sv.name.toLowerCase().includes(q) || sv.name_ar.includes(q)) : [];
      if (q && matched.length === 0 && !shop.name.toLowerCase().includes(q)) return null;
      const reviews = MOCK_REVIEWS.filter((r) => r.shop_id === shop.id);
      const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
      const time = ["10:30", "12:00", "16:30"][i % 3];
      return {
        id: shop.id,
        slug: shop.slug,
        slug_ar: shop.slug_ar,
        name: shop.name,
        name_ar: null,
        cover_url: shop.cover_url,
        logo_url: null,
        is_verified: i === 0,
        area_name_en: area?.nameEn ?? null,
        area_name_ar: area?.nameAr ?? null,
        city_name_en: FALLBACK_CITY.nameEn,
        city_name_ar: FALLBACK_CITY.nameAr,
        lat: shop.lat,
        lng: shop.lng,
        distance_km: null,
        rating_avg: avg,
        rating_count: reviews.length,
        min_price: services.length ? Math.min(...services.map((sv) => sv.price)) : null,
        currency: shop.currency,
        services_count: services.length,
        matched_services: matched.slice(0, 3).map((sv) => ({ id: sv.id, name: sv.name, name_ar: sv.name_ar, price: sv.price, price_type: "fixed", duration: sv.duration })),
        next_slot_start: `${tomorrowIso}T${time}:00`,
        next_slot_local_date: tomorrowIso,
        next_slot_local_time: time,
        open_now: false,
        open_until: null,
        badges: [],
        score: 1 - i * 0.1,
      } as Row;
    })
    .filter((r): r is Row => r !== null);
  return rows.map((r) => ({ ...r, total_count: rows.length }));
}

function mockSearchBarbers(): Row[] {
  const rows = MOCK_BARBERS.map((b) => {
    const shop = MOCK_SHOPS.find((s) => s.id === b.shop_id);
    const area = FALLBACK_CITY.areas.find((a) => a.slug === shop?.area_slug);
    const services = MOCK_SERVICES.filter((sv) => sv.shop_id === b.shop_id);
    return {
      id: b.id,
      handle: b.id,
      full_name: b.full_name,
      avatar_url: b.avatar_url,
      title_en: "Barber",
      title_ar: "حلاق",
      years_experience: null,
      languages: [],
      shop_id: b.shop_id,
      shop_slug: null,
      shop_slug_ar: null,
      shop_name: shop?.name ?? "",
      shop_name_ar: null,
      shop_is_verified: false,
      area_name_en: area?.nameEn ?? null,
      area_name_ar: area?.nameAr ?? null,
      city_name_en: FALLBACK_CITY.nameEn,
      city_name_ar: FALLBACK_CITY.nameAr,
      lat: shop?.lat ?? null,
      lng: shop?.lng ?? null,
      min_price: services.length ? Math.min(...services.map((sv) => sv.price)) : null,
      currency: "JOD",
      matched_services: [],
      score: 1,
    } as Row;
  });
  return rows.map((r) => ({ ...r, total_count: rows.length }));
}

function mockRpc(fn: string, args: Record<string, unknown>): RpcResult {
  switch (fn) {
    case "search_shops":
      return { data: mockSearchShops(args), error: null };
    case "search_barbers":
      return { data: mockSearchBarbers(), error: null };
    case "get_busy_slots": {
      const shopId = String(args.p_shop_id ?? "");
      const day = String(args.p_day ?? "");
      const barberId = (args.p_barber_id as string | null | undefined) ?? null;
      const rows: BusySlot[] = MOCK_APPOINTMENTS
        .filter((a) => a.shop_id === shopId && ACTIVE.has(a.status) && localDay(a.start_time) === day)
        .filter((a) => !barberId || a.barber_id === barberId)
        .map((a) => ({ barber_id: a.barber_id, start_time: a.start_time, end_time: a.end_time }));
      return { data: rows, error: null };
    }
    case "create_public_booking": {
      const shopId = String(args.p_shop_id ?? "");
      const ids = Array.isArray(args.p_service_ids) ? (args.p_service_ids as string[]) : [];
      const services = MOCK_SERVICES.filter((s) => s.shop_id === shopId && ids.includes(s.id));
      if (!MOCK_SHOPS.some((s) => s.id === shopId)) return rpcError("SHOP_NOT_FOUND");
      if (ids.length === 0 || services.length !== new Set(ids).size) return rpcError("SERVICE_INVALID");
      const start = new Date(String(args.p_start_time ?? ""));
      if (Number.isNaN(start.getTime())) return rpcError("INVALID_INPUT");
      if (start.getTime() <= Date.now()) return rpcError("SLOT_IN_PAST");
      const duration = services.reduce((a, s) => a + s.duration, 0);
      const end = new Date(start.getTime() + duration * 60_000);
      const overlaps = (barber: string) =>
        MOCK_APPOINTMENTS.some((a) => a.barber_id === barber && ACTIVE.has(a.status)
          && new Date(a.start_time) < end && new Date(a.end_time) > start);
      const requested = (args.p_barber_id as string | null | undefined) ?? null;
      const candidates = MOCK_PROFILES
        .filter((p) => p.shop_id === shopId && (p.role === "barber" || p.role === "shop_admin"))
        .map((p) => p.id);
      if (requested && !candidates.includes(requested)) return rpcError("BARBER_INVALID");
      const barber = requested
        ? (overlaps(requested) ? null : requested)
        : candidates.find((id) => !overlaps(id)) ?? null;
      if (!barber) return rpcError(requested ? "SLOT_TAKEN" : "NO_BARBER_AVAILABLE");
      const price = services.reduce((a, s) => a + s.price, 0);
      const appt: MockAppointment = {
        id: `appt-${MOCK_APPOINTMENTS.length + 1}-${Date.now().toString(36)}`,
        shop_id: shopId, barber_id: barber, client_id: null,
        client_name: String(args.p_client_name ?? "").trim(),
        service_name: services.map((s) => s.name).join(" + "), service_ids: services.map((s) => s.id),
        price, currency: "JOD", start_time: start.toISOString(), end_time: end.toISOString(),
        status: "pending", source: String(args.p_source ?? "online"),
      };
      MOCK_APPOINTMENTS.push(appt);
      const result: BookingResult = {
        appointment_id: appt.id, barber_id: barber, start_time: appt.start_time, end_time: appt.end_time,
        price, currency: "JOD", service_name: appt.service_name, status: "pending",
      };
      return { data: result, error: null };
    }
    case "cancel_customer_booking": {
      if (!MOCK_AUTH_ROLE) return rpcError("NOT_AUTHENTICATED");
      const appt = MOCK_APPOINTMENTS.find((a) => a.id === args.p_appointment_id);
      if (!appt) return rpcError("APPT_NOT_FOUND");
      if (!ACTIVE.has(appt.status)) return rpcError("INVALID_STATUS");
      appt.status = "cancelled";
      const result: CancelBookingResult = { appointment_id: appt.id, status: "cancelled", cancelled_at: new Date().toISOString() };
      return { data: result, error: null };
    }
    case "link_customer_client":
      return MOCK_AUTH_ROLE ? { data: null, error: null } : rpcError("NOT_AUTHENTICATED");
    case "get_my_appointments":
      return MOCK_AUTH_ROLE ? { data: [], error: null } : rpcError("NOT_AUTHENTICATED");
    case "submit_review":
      return MOCK_AUTH_ROLE ? rpcError("REVIEW_NOT_ALLOWED") : rpcError("NOT_AUTHENTICATED");
    case "complete_appointment_sale": {
      if (!MOCK_AUTH_ROLE || MOCK_AUTH_ROLE === "customer") return rpcError("NOT_AUTHENTICATED");
      const appt = MOCK_APPOINTMENTS.find((a) => a.id === args.p_appointment_id);
      if (!appt) return rpcError("APPT_NOT_FOUND");
      appt.status = "completed";
      return { data: { appointment_id: appt.id, sale_id: `sale-${appt.id}`, status: "completed", amount: appt.price }, error: null };
    }
    case "get_my_shop_private": {
      if (!MOCK_AUTH_ROLE || MOCK_AUTH_ROLE === "customer") return { data: [], error: null };
      const shop = MOCK_SHOPS.find((s) => s.id === MOCK_ADMIN_PROFILE.shop_id) as unknown as Row | undefined;
      return {
        data: shop ? [{ shop_id: shop.id, daily_goal: (shop.daily_goal as number | undefined) ?? 120, settings: {} }] : [],
        error: null,
      };
    }
    case "get_profile_phones": {
      if (!MOCK_AUTH_ROLE) return rpcError("NOT_AUTHENTICATED");
      if (MOCK_AUTH_ROLE === "customer") return { data: [], error: null };
      const rows = (MOCK_PROFILES as unknown as Row[]).filter((p) => p.shop_id === MOCK_ADMIN_PROFILE.shop_id);
      return { data: rows.map((p) => ({ id: p.id, phone: (p.phone as string | null | undefined) ?? null })), error: null };
    }
    case "get_shop_publish_checklist": {
      // Mirrors shop_publish_checklist_internal() for the mock seed: the
      // essentials are there, the WS-1A media items are not.
      const shop = MOCK_SHOPS.find((s) => s.id === args.p_shop_id);
      if (!shop) return rpcError("SHOP_NOT_FOUND");
      const items = {
        name: !!shop.name.trim(),
        services: MOCK_SERVICES.some((sv) => (sv as { shop_id?: string }).shop_id === shop.id),
        hours: true,
        location: !!shop.address.trim(),
        contact: !!(shop.phone || shop.whatsapp),
        photos: false,
        description: !!shop.description,
        bilingual: false,
        pin: false,
        team: false,
        amenities: false,
        portfolio: false,
      };
      return {
        data: { items, is_published: shop.is_published, marketplace_visible: shop.marketplace_visible, published_at: null, slug: shop.slug },
        error: null,
      };
    }
    case "get_invite_by_token":
      return { data: [], error: null };
    case "accept_invite":
      return MOCK_AUTH_ROLE ? rpcError("INVITE_INVALID") : rpcError("NOT_AUTHENTICATED");
    default:
      return { data: null, error: null };
  }
}
