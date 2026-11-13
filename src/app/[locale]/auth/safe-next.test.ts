import { describe, it, expect } from "vitest";
import { isInviteNext, localizePath, normalizeAuthLocale, resolveNext, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/customer", "/customer"],
    ["/join?token=abc", "/join?token=abc"],
    ["/calendar?date=2026-11-12#top", "/calendar?date=2026-11-12#top"],
    ["/ar/explore", "/ar/explore"],
    ["/@evil.com", "/@evil.com"],
  ])("accepts %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "\\/evil.com",
    "@evil.com",
    ".evil.com/x",
    "https://evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
    "evil.com",
    "",
    "   ",
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("rejects non-strings and overly long values", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined, "/fallback")).toBe("/fallback");
    expect(safeNextPath(42)).toBe("/");
    expect(safeNextPath("/" + "a".repeat(2000))).toBe("/");
  });
});

describe("localizePath / resolveNext", () => {
  it("prefixes the locale once", () => {
    expect(localizePath("/", "ar")).toBe("/ar");
    expect(localizePath("/join?token=x", "ar")).toBe("/ar/join?token=x");
    expect(localizePath("/en/customer", "ar")).toBe("/en/customer");
    expect(localizePath("/?x=1", "en")).toBe("/en?x=1");
    expect(localizePath("/english", "en")).toBe("/en/english");
  });

  it("falls back to the localized root for unsafe values", () => {
    expect(resolveNext("//evil.com", "ar")).toBe("/ar");
    expect(resolveNext("/customer", "en")).toBe("/en/customer");
  });

  it("normalizes locales", () => {
    expect(normalizeAuthLocale("ar")).toBe("ar");
    expect(normalizeAuthLocale("fr")).toBe("en");
    expect(normalizeAuthLocale(null)).toBe("en");
  });
});

describe("isInviteNext", () => {
  it("detects the invite flow", () => {
    expect(isInviteNext("/join?token=abc")).toBe(true);
    expect(isInviteNext("/ar/join?token=abc")).toBe(true);
    expect(isInviteNext("/join")).toBe(true);
    expect(isInviteNext("/joined")).toBe(false);
    expect(isInviteNext("//evil.com/join")).toBe(false);
    expect(isInviteNext(null)).toBe(false);
  });
});
