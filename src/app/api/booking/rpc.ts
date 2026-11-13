import type { Database, RpcArgs, RpcReturns } from "@/lib/supabase/database.types";

type FunctionName = keyof Database["public"]["Functions"];

/**
 * Typed RPC call. The cookie-bound server client is parameterized with the
 * loose table types (no Functions), so its own `.rpc()` signature can't check
 * arguments; this wrapper checks them against database.types.ts instead.
 */
export async function callRpc<F extends FunctionName>(
  client: unknown,
  fn: F,
  args: RpcArgs<F>,
): Promise<{ data: RpcReturns<F> | null; error: unknown }> {
  const c = client as {
    rpc: (fn: string, args: unknown) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await c.rpc(fn, args);
  return { data: (data ?? null) as RpcReturns<F> | null, error: error ?? null };
}

/**
 * Untyped RPC call for functions or arguments newer than database.types.ts
 * (booking v2: p_items, reschedule_booking, …). Same result shape.
 */
export async function callRpcLoose<T = unknown>(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  const c = client as {
    rpc: (fn: string, args: unknown) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await c.rpc(fn, args);
  return { data: (data ?? null) as T | null, error: error ?? null };
}
