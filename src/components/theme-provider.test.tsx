import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";

const nav = { pathname: "/en/calendar", locale: "en" };
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: nav.locale }),
  usePathname: () => nav.pathname,
}));

import fs from "node:fs";
import path from "node:path";
import { ThemeProvider, isThemedPath, themeInitScript, THEMED_SEGMENTS } from "./theme-provider";
import { useThemeStore } from "@/store/theme-store";

describe("isThemedPath", () => {
  it("matches app-shell routes with or without a locale", () => {
    expect(isThemedPath("/en")).toBe(true);
    expect(isThemedPath("/ar/calendar")).toBe(true);
    expect(isThemedPath("/en/settings/billing")).toBe(true);
    expect(isThemedPath("/clients")).toBe(true);
  });

  it("excludes public routes", () => {
    expect(isThemedPath("/en/landing")).toBe(false);
    expect(isThemedPath("/ar/book/123")).toBe(false);
    expect(isThemedPath("/en/customer")).toBe(false);
    expect(isThemedPath("/en/auth/login")).toBe(false);
    expect(isThemedPath(null)).toBe(false);
  });

  it("ships a syntactically valid init script", () => {
    expect(() => new Function(themeInitScript)).not.toThrow();
  });
});

describe("ThemeProvider", () => {
  beforeEach(() => {
    act(() => useThemeStore.setState({ theme: "light" }));
  });

  it("applies dark mode on app routes and sets dir/lang", () => {
    nav.pathname = "/ar/calendar";
    nav.locale = "ar";
    act(() => useThemeStore.setState({ theme: "dark" }));
    render(<ThemeProvider><div /></ThemeProvider>);
    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(root.getAttribute("lang")).toBe("ar");
  });

  it("keeps public routes light even when dark is chosen", () => {
    nav.pathname = "/en/landing";
    nav.locale = "en";
    act(() => useThemeStore.setState({ theme: "dark" }));
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("THEMED_SEGMENTS", () => {
  it("lists every (dashboard) route segment, so no shell page renders light", () => {
    const dir = path.join(process.cwd(), "src/app/[locale]/(dashboard)");
    const segments = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("(") && !d.name.startsWith("_") && !d.name.startsWith("["))
      .map((d) => d.name);
    expect(segments.length).toBeGreaterThan(0);
    for (const s of segments) expect(THEMED_SEGMENTS as readonly string[]).toContain(s);
    expect(isThemedPath("/en/queue")).toBe(true);
    expect(isThemedPath("/ar/queue/display")).toBe(true);
  });
});
