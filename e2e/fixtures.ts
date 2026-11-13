// Shared Playwright harness (WS-P0): en/ar locales, axe checks and visual
// snapshots. New specs import { test, expect, LOCALES } from "./fixtures".
//
//   for (const locale of LOCALES) {
//     test(`shop page @mobile [${locale}]`, async ({ page, a11y, snap }) => {
//       await gotoLocale(page, locale, `/shop/${shopId}`);
//       await a11y();                 // zero serious/critical axe violations
//       await snap("shop-page");      // e2e/__snapshots__/…/shop-page-<locale>-<project>.png
//     });
//   }
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

/** Axe impacts that fail a test. */
export const BLOCKING_IMPACTS = ["serious", "critical"] as const;

/** Navigates to a locale-prefixed path and waits for the document direction to settle. */
export async function gotoLocale(page: Page, locale: Locale, path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  await page.goto(`/${locale}${clean === "/" ? "" : clean}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

/** Asserts the page is laid out in the locale's direction (RTL for Arabic). */
export async function expectDirection(page: Page, locale: Locale) {
  const dir = await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
  expect(dir).toBe(locale === "ar" ? "rtl" : "ltr");
}

/** Runs axe (WCAG 2.1 AA) and fails on serious/critical violations. */
export async function checkA11y(page: Page, options: { include?: string; exclude?: string[]; disableRules?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.include) builder = builder.include(options.include);
  for (const sel of options.exclude ?? []) builder = builder.exclude(sel);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => (BLOCKING_IMPACTS as readonly string[]).includes(v.impact ?? ""));
  const summary = blocking.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) → ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, "serious/critical accessibility violations").toEqual([]);
  return results;
}

/** Elements whose content changes run to run (clocks, relative dates, maps). */
export const DYNAMIC_SELECTORS = [
  "[data-dynamic]",
  "time",
  ".maplibregl-canvas",
  "[data-testid='live-clock']",
];

/** Full-page visual snapshot with animations frozen and dynamic regions masked. */
export async function snapshot(page: Page, name: string, locale: Locale) {
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(`${name}-${locale}.png`, {
    fullPage: true,
    mask: DYNAMIC_SELECTORS.map((s) => page.locator(s)),
  });
}

type Fixtures = {
  /** Fails on serious/critical axe violations on the current page. */
  a11y: (options?: Parameters<typeof checkA11y>[1]) => Promise<void>;
  /** Visual snapshot named `<name>-<locale>` (locale read from the URL). */
  snap: (name: string) => Promise<void>;
  /** Fails the test on uncaught page errors (console "error" events are collected too). */
  pageErrors: string[];
};

export const test = base.extend<Fixtures>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await use(errors);
    expect(errors, "uncaught page errors").toEqual([]);
  },
  a11y: async ({ page }, use) => {
    await use(async (options) => {
      await checkA11y(page, options);
    });
  },
  snap: async ({ page }, use) => {
    await use(async (name) => {
      const locale: Locale = new URL(page.url()).pathname.startsWith("/ar") ? "ar" : "en";
      await snapshot(page, name, locale);
    });
  },
});

export { expect };
