import { describe, it, expect } from "vitest";
import { resolveEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("resolveEnv", () => {
  it("accepts a valid production config", () => {
    const env = resolveEnv({ ...valid, NODE_ENV: "production" });
    expect(env.errors).toEqual([]);
    expect(env.isProduction).toBe(true);
    expect(env.mockMode).toBe(false);
    expect(env.supabaseUrl).toBe("https://abc.supabase.co");
  });

  it("reports missing Supabase settings", () => {
    const env = resolveEnv({ NODE_ENV: "production" });
    expect(env.errors.join(" ")).toMatch(/SUPABASE/);
  });

  it("enables mock mode in development and exposes the mock role", () => {
    const env = resolveEnv({ NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK_DATA: "true", NEXT_PUBLIC_MOCK_AUTH_ROLE: "shop_admin" });
    expect(env.mockMode).toBe(true);
    expect(env.mockAuthRole).toBe("shop_admin");
    // Supabase vars are optional in mock mode.
    expect(env.errors).toEqual([]);
  });

  it("refuses mock mode in production", () => {
    const env = resolveEnv({ ...valid, NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK_DATA: "true", NEXT_PUBLIC_MOCK_AUTH_ROLE: "shop_admin" });
    expect(env.mockMode).toBe(false);
    expect(env.mockAuthRole).toBeNull();
    expect(env.mockRefused).toBe(true);
  });

  it("allows mock mode in production only with the explicit escape hatch", () => {
    const env = resolveEnv({ ...valid, NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK_DATA: "true", NEXT_PUBLIC_ALLOW_MOCK_IN_PROD: "true" });
    expect(env.mockMode).toBe(true);
  });

  it("ignores an unknown mock role", () => {
    const env = resolveEnv({ NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK_DATA: "true", NEXT_PUBLIC_MOCK_AUTH_ROLE: "root" });
    expect(env.mockAuthRole).toBeNull();
  });

  it("validates the optional site URL", () => {
    expect(resolveEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "" }).siteUrl).toBeNull();
    expect(resolveEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "not a url" }).errors.length).toBe(1);
    expect(resolveEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://halaqy.app" }).siteUrl).toBe("https://halaqy.app");
  });
});
