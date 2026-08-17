// Seeds a fresh local Supabase instance with fixed, known-credential users
// for Playwright E2E tests. Idempotent: safe to run against a DB that
// already has these users (skips ones that exist and reuses their data).
//
// Unlike the root-level seed.sql (written against a pre-existing populated
// project), this creates its own auth users so it works on a brand new
// `supabase db reset`. Run via `node scripts/seed-e2e.mjs` after
// `npm run db:start`, with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set
// (defaults below match the Supabase CLI's local instance).

import { createClient } from "@supabase/supabase-js";

export const E2E_OWNER = { email: "e2e-owner@halaqy.test", password: "e2e-password-123", fullName: "E2E Owner" };
export const E2E_CUSTOMER = { email: "e2e-customer@halaqy.test", password: "e2e-password-123", fullName: "E2E Customer" };

async function findUserByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) || null;
}

async function ensureUser(supabase, { email, password, fullName }, role) {
  const existing = await findUserByEmail(supabase, email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw error;
  return data.user;
}

export async function seedE2E({
  url = process.env.SUPABASE_URL || "http://127.0.0.1:54321",
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
} = {}) {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (see `npm run db:start` output).");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const owner = await ensureUser(supabase, E2E_OWNER, "shop_admin");
  const customer = await ensureUser(supabase, E2E_CUSTOMER, "customer");

  // handle_new_user() auto-creates the shop_admin's shop + profile + 6
  // default services (see supabase/migrations/003_customer_role.sql).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", owner.id)
    .single();
  if (profileErr || !profile?.shop_id) {
    throw new Error(`Owner profile/shop was not auto-provisioned: ${profileErr?.message}`);
  }

  const { data: service, error: serviceErr } = await supabase
    .from("services")
    .select("id, name")
    .eq("shop_id", profile.shop_id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();
  if (serviceErr || !service) {
    throw new Error(`No default service found for seeded shop: ${serviceErr?.message}`);
  }

  return {
    shopId: profile.shop_id,
    serviceName: service.name,
    owner: { email: E2E_OWNER.email, password: E2E_OWNER.password },
    customer: { id: customer.id, email: E2E_CUSTOMER.email, password: E2E_CUSTOMER.password },
  };
}

// Allow `node scripts/seed-e2e.mjs` for manual/local seeding outside Playwright.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedE2E()
    .then((seeded) => console.log(JSON.stringify(seeded, null, 2)))
    .catch((err) => {
      console.error("[seed-e2e] failed:", err);
      process.exit(1);
    });
}
