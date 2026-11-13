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
