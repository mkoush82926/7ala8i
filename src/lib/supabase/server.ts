import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Cookie-bound server client: runs as the signed-in user (or anon), so RLS
 * applies. This is the ONLY Supabase client API routes should use for data.
 * There is deliberately no service-role data client — privileged writes go
 * through SECURITY DEFINER RPCs that validate the caller themselves.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — cookies are read-only there; the
          // middleware refreshes the session instead.
        }
      },
    },
  });
}
