import { createBrowserClient } from "@supabase/ssr";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createMockClient } from "@/lib/supabase/mock-client";

// This app's two Database type files (types.ts, database.types.ts) are both
// stale/incomplete versus the live schema (missing working_hours, reviews,
// barber_services, and several columns) — parameterizing createBrowserClient
// with either one makes TS enforce a wrong schema and floods unrelated files
// with bogus `never`-type errors. So createRealClient() below stays exactly
// as it always was (no generic — loose typing, matching what every existing
// consumer file was written against), and SupabaseBrowserClient captures
// *that* real return type for the mock branch to assert against, instead of
// naming a (wrong) type up front.
function createRealClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

type SupabaseBrowserClient = ReturnType<typeof createRealClient>;

export function createClient(): SupabaseBrowserClient {
  // Local design-preview escape hatch — see src/lib/mock-data.ts for why
  // this exists and how it's scoped so it can never activate in production.
  if (MOCK_DATA_ENABLED) {
    return createMockClient() as unknown as SupabaseBrowserClient;
  }
  return createRealClient();
}
