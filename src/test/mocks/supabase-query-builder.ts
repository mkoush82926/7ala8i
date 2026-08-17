import { vi } from "vitest";

export type QueryResult<T = unknown> = { data: T; error: unknown };

/**
 * A minimal stand-in for the Supabase query builder. Every chainable method
 * (select/insert/update/delete/eq/order/...) returns itself; `single()` and
 * `then()` resolve to the configured result, so both `await builder` and
 * `await builder.single()` work depending on how the code under test calls it.
 */
export function createQueryBuilder<T = unknown>(result: QueryResult<T> = { data: null as T, error: null }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: QueryResult<T>) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}
