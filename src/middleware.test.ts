import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/mock-data", () => ({ MOCK_DATA_ENABLED: false, MOCK_AUTH_ROLE: null }));
vi.mock("@/lib/env", () => ({ publicEnv: { supabaseUrl: "http://localhost:54321", supabaseAnonKey: "anon", siteUrl: null } }));

import { isPublicPath, matchesRoute, roleRedirect } from "./middleware";

describe("matchesRoute", () => {
  it("matches whole segments only", () => {
    expect(matchesRoute("/shop", "/shop")).toBe(true);
    expect(matchesRoute("/shop/123", "/shop")).toBe(true);
    expect(matchesRoute("/shops", "/shop")).toBe(false);
    expect(matchesRoute("/shop-settings", "/shop")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each([
    "/landing",
    "/auth/login",
    "/auth/callback",
    "/auth/reset-password",
    "/login",
    "/signup",
    "/join",
    "/explore",
    "/shop/abc",
    "/book/abc",
    "/customer/explore",
    "/customer/shops/abc",
    "/terms",
    "/privacy",
    "/policy",
  ])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each([
    "/",
    "/calendar",
    "/settings",
    "/team",
    "/customer",
    "/customer/bookings",
    "/authz",
    "/explore-internal",
    "/booking-admin",
    "/shop-settings",
    "/policy-editor",
    "/joinx",
  ])("%s is protected", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("roleRedirect", () => {
  it("keeps customers inside the portal", () => {
    expect(roleRedirect("/", "customer")).toBe("/customer");
    expect(roleRedirect("/calendar", "customer")).toBe("/customer");
    expect(roleRedirect("/customer", "customer")).toBeNull();
    expect(roleRedirect("/customer/bookings", "customer")).toBeNull();
    expect(roleRedirect("/customerx", "customer")).toBe("/customer");
  });

  it("keeps staff out of the customer portal", () => {
    expect(roleRedirect("/customer", "barber")).toBe("/");
    expect(roleRedirect("/customer/profile", "shop_admin")).toBe("/");
    expect(roleRedirect("/calendar", "barber")).toBeNull();
    expect(roleRedirect("/", "shop_admin")).toBeNull();
  });

  it("limits admin-only pages to shop admins", () => {
    expect(roleRedirect("/settings", "barber")).toBe("/my-day");
    expect(roleRedirect("/settings", "shop_admin")).toBeNull();
    expect(roleRedirect("/settings", null)).toBe("/my-day");
    for (const p of ["/services", "/team", "/analytics", "/leads", "/team/invites"]) {
      expect(roleRedirect(p, "barber")).toBe("/my-day");
      expect(roleRedirect(p, "shop_admin")).toBeNull();
    }
  });
});
