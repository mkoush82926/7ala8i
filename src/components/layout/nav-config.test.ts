import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  findNavItem,
  homePathFor,
  isNavActive,
  stripLocale,
  toShellRole,
  visibleNavItems,
} from "./nav-config";

describe("nav-config", () => {
  it("strips the locale prefix", () => {
    expect(stripLocale("/ar")).toBe("/");
    expect(stripLocale("/en/clients/x")).toBe("/clients/x");
    expect(stripLocale("/arabic")).toBe("/arabic");
    expect(stripLocale(null)).toBe("/");
  });

  it("matches nav items by prefix, with the overview only at root", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/clients")).toBe(false);
    expect(isNavActive("/clients", "/clients/abc")).toBe(true);
    expect(isNavActive("/clients", "/clientsx")).toBe(false);
    expect(findNavItem("/my-day")?.id).toBe("my-day");
    expect(findNavItem("/team")?.id).toBe("team");
  });

  it("normalises store roles", () => {
    expect(toShellRole("super_admin")).toBe("shop_admin");
    expect(toShellRole("barber")).toBe("barber");
    expect(toShellRole("customer")).toBeNull();
    expect(toShellRole(undefined)).toBeNull();
  });

  it("hides admin pages from barbers", () => {
    const ids = visibleNavItems("barber").map((i) => i.id);
    expect(ids).toEqual(["my-day", "calendar", "clients"]);
    expect(visibleNavItems("shop_admin")).toHaveLength(9);
    expect(visibleNavItems(null).map((i) => i.id)).toEqual(ids);
  });

  it("guards paths by role", () => {
    expect(canAccessPath("barber", "/analytics")).toBe(false);
    expect(canAccessPath("barber", "/")).toBe(false);
    expect(canAccessPath("barber", "/calendar")).toBe(true);
    expect(canAccessPath("barber", "/leads")).toBe(false);
    expect(canAccessPath("shop_admin", "/settings")).toBe(true);
    expect(canAccessPath(null, "/calendar")).toBe(false);
    expect(canAccessPath(null, "/unknown-page")).toBe(true);
    expect(homePathFor("barber")).toBe("/my-day");
    expect(homePathFor("shop_admin")).toBe("/");
  });
});
