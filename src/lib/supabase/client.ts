import { createBrowserClient } from "@supabase/ssr";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { publicEnv } from "@/lib/env";
import { createMockClient } from "@/lib/supabase/mock-client";

// The browser client is intentionally NOT parameterized with the Database
// type: many existing consumers were written against loose typing. Opt into
// strict typing per call site with `SupabaseClient<Database>` from
// "@/lib/supabase/database.types" (see src/lib/queries/*).
function createRealClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}

type SupabaseBrowserClient = ReturnType<typeof createRealClient>;

export function createClient(): SupabaseBrowserClient {
  // Local design-preview escape hatch. MOCK_DATA_ENABLED comes from
  // src/lib/env.ts, which refuses mock mode in production builds.
  if (MOCK_DATA_ENABLED) {
    return createMockClient() as unknown as SupabaseBrowserClient;
  }
  return createRealClient();
}
