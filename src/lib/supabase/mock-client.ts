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
// Only ever constructed from src/lib/supabase/client.ts when
// NEXT_PUBLIC_USE_MOCK_DATA is explicitly set — see MOCK_DATA_ENABLED in
// src/lib/mock-data.ts for how that flag is scoped so it can never affect
// production.
//
// Tables this mock doesn't have real content for (clients, leads,
// appointments-writes, analytics, etc. — the authenticated dashboard side of
// the app) resolve to an empty result rather than throwing, so navigating
// into the dashboard with the flag on degrades gracefully instead of
// crashing; it just won't show anything, since dashboard mocking is out of
// scope for "preview the public booking flow".
// ─────────────────────────────────────────────────────────────────────────

import {
  MOCK_SHOPS, MOCK_SERVICES, MOCK_BARBERS, MOCK_REVIEWS, MOCK_WORKING_HOURS, MOCK_APPOINTMENTS,
} from "@/lib/mock-data";

type Row = Record<string, unknown>;

const TABLES: Record<string, Row[]> = {
  shops: MOCK_SHOPS as unknown as Row[],
  services: MOCK_SERVICES as unknown as Row[],
  profiles: MOCK_BARBERS as unknown as Row[],
  reviews: MOCK_REVIEWS as unknown as Row[],
  working_hours: MOCK_WORKING_HOURS as unknown as Row[],
  appointments: MOCK_APPOINTMENTS as unknown as Row[],
};

type Result<T> = { data: T | null; error: null };

function getAtPath(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Row)[key] : undefined), row);
}

class MockQueryBuilder implements PromiseLike<Result<Row[] | Row>> {
  private rows: Row[];
  private wantSingle = false;

  constructor(table: string) {
    // Slice so filters never mutate the shared mock arrays.
    this.rows = (TABLES[table] ?? []).slice();
  }

  select(_columns?: string) {
    // No real column projection — every mock row is already shaped exactly
    // like the real query's expected result, embeds (`clients(name)`,
    // `barber_services(service_id)`) included.
    return this;
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => getAtPath(r, column) === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    this.rows = this.rows.filter((r) => set.has(getAtPath(r, column)));
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

  // No-op writes — the guest-facing pages this mock exists for are all
  // read-only; dashboard CRUD paths that hit these will just get a harmless
  // empty success rather than a crash.
  insert(_values: unknown) { return this; }
  update(_values: unknown) { return this; }
  upsert(_values: unknown) { return this; }
  delete() { return this; }

  private resolve(): Result<Row[] | Row> {
    if (this.wantSingle) {
      return { data: this.rows[0] ?? null, error: null };
    }
    return { data: this.rows, error: null };
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

export function createMockClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table);
    },
    auth: {
      // Guest visitor — matches the real anonymous-browsing state these
      // public pages already support (booking works without an account).
      async getUser() {
        return { data: { user: null }, error: null };
      },
    },
    // No-op — nothing in the guest-facing flow this mock targets calls an
    // RPC (that's `create_public_booking` / `cancel_customer_booking`, both
    // authenticated-write paths out of scope for a read-only design preview).
    async rpc(_fn: string, _args?: unknown) {
      return { data: null, error: null };
    },
  };
}
