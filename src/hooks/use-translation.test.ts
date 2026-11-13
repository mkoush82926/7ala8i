import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const params = { locale: "ar" as string };
vi.mock("next/navigation", () => ({ useParams: () => params }));

import {
  localizeHref,
  switchLocalePath,
  interpolate,
  headingTracking,
  useTranslation,
} from "./use-translation";

describe("localizeHref", () => {
  it("prefixes internal paths", () => {
    expect(localizeHref("/explore", "ar")).toBe("/ar/explore");
    expect(localizeHref("/auth/login?next=/x", "en")).toBe("/en/auth/login?next=/x");
    expect(localizeHref("explore", "en")).toBe("/en/explore");
  });

  it("maps the root to the locale root", () => {
    expect(localizeHref("/", "ar")).toBe("/ar");
    expect(localizeHref("", "en")).toBe("/en");
    expect(localizeHref("/?tab=1", "ar")).toBe("/ar?tab=1");
  });

  it("leaves already-localized paths alone", () => {
    expect(localizeHref("/en/explore", "ar")).toBe("/en/explore");
    expect(localizeHref("/ar", "en")).toBe("/ar");
  });

  it("does not treat words starting with en/ar as locales", () => {
    expect(localizeHref("/enroll", "ar")).toBe("/ar/enroll");
    expect(localizeHref("/area", "en")).toBe("/en/area");
  });

  it("leaves external and special links alone", () => {
    expect(localizeHref("https://example.com", "ar")).toBe("https://example.com");
    expect(localizeHref("mailto:a@b.c", "ar")).toBe("mailto:a@b.c");
    expect(localizeHref("tel:+962", "ar")).toBe("tel:+962");
    expect(localizeHref("#pricing", "ar")).toBe("#pricing");
    expect(localizeHref("//cdn.example.com/x", "ar")).toBe("//cdn.example.com/x");
  });
});

describe("switchLocalePath", () => {
  it("swaps the locale prefix", () => {
    expect(switchLocalePath("/en/explore?x=1", "ar")).toBe("/ar/explore?x=1");
    expect(switchLocalePath("/ar", "en")).toBe("/en");
    expect(switchLocalePath("/explore", "ar")).toBe("/ar/explore");
  });
});

describe("interpolate / headingTracking", () => {
  it("fills placeholders and keeps unknown ones", () => {
    expect(interpolate("Hi {name}, {x}", { name: "Ahmad" })).toBe("Hi Ahmad, {x}");
  });

  it("never tracks Arabic", () => {
    expect(headingTracking(true, "-0.02em")).toBe("normal");
    expect(headingTracking(false, "-0.02em")).toBe("-0.02em");
  });
});

describe("useTranslation", () => {
  it("returns locale-bound helpers for Arabic", () => {
    params.locale = "ar";
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe("ar");
    expect(result.current.dir).toBe("rtl");
    expect(result.current.intlLocale).toBe("ar-JO-u-nu-latn");
    expect(result.current.href("/explore")).toBe("/ar/explore");
    expect(result.current.formatCurrency(5)).toContain("د.أ");
    expect(result.current.formatTime("14:05")).toContain("م");
  });

  it("returns English helpers and falls back to en for unknown locales", () => {
    params.locale = "fr";
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe("en");
    expect(result.current.isRTL).toBe(false);
    expect(result.current.href("/explore")).toBe("/en/explore");
    expect(result.current.formatCurrency(5)).toBe("5.00 JOD");
    expect(result.current.formatDate("2026-11-12", "dayMonth")).toBe("12 Nov");
  });

  it("keeps helper identity stable across renders", () => {
    params.locale = "en";
    const { result, rerender } = renderHook(() => useTranslation());
    const first = result.current.formatDate;
    rerender();
    expect(result.current.formatDate).toBe(first);
  });
});
