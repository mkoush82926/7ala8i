// Contrast guard for the "Ink & Brass" token pairs used on selected /
// primary controls, in light and dark mode (WCAG AA: 4.5 text, 3 icons).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const end = css.indexOf("\n}", start);
  const vars: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2];
  return vars;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(":root");
const dark = { ...light, ...block(':root[data-theme="dark"]') };

describe("token contrast", () => {
  for (const [mode, t] of [["light", light], ["dark", dark]] as const) {
    it(`${mode}: selected / CTA pairs meet AA`, () => {
      expect(contrast(t["brand-on-primary"], t["brand-primary"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["cta-fg"], t["cta-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["bg-primary"], t["text-primary"])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("dark: text-primary + on-accent is not a usable pair (guards the fix)", () => {
    expect(contrast(dark["on-accent"], dark["text-primary"])).toBeLessThan(3);
  });
});

describe("no low-contrast selected states in source", () => {
  const files = [
    "src/app/[locale]/(dashboard)/services/service-editor.tsx",
    "src/components/calendar/slot-popover.tsx",
    "src/app/[locale]/m/[token]/manage-booking.tsx",
    "src/app/[locale]/(dashboard)/settings/messaging/messaging-settings.tsx",
  ];
  const bad = [
    /bg-\[var\(--text-primary\)\][^"]*text-\[var\(--on-accent\)\]/,
    /bg-\[var\(--accent-brass\)\][^"]*text-\[var\(--on-accent\)\]/,
    /bg-\[var\(--accent-brass\)\][^"]*text-\[var\(--text-primary\)\]/,
  ];
  for (const f of files) {
    it(f, () => {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      for (const re of bad) expect(src).not.toMatch(re);
    });
  }
});
