// Visual + accessibility baseline for the public pages the marketplace work
// will touch (WS-P0 acceptance: "existing pages are visually unchanged").
//
// Capture / refresh the baseline (needs the local Supabase stack + seed):
//   npx playwright test e2e/visual --update-snapshots
// Then every WS runs `npx playwright test e2e/visual` to prove no regressions.
import { test, expect, LOCALES, gotoLocale, expectDirection } from "../fixtures";
import { getSeed } from "../helpers";

const PUBLIC_PAGES: Array<{ name: string; path: (seed: ReturnType<typeof getSeed>) => string }> = [
  { name: "landing", path: () => "/" },
  { name: "explore", path: () => "/explore" },
  { name: "for-business", path: () => "/for-business" },
  { name: "shop", path: (s) => `/shop/${s.shopId}` },
  { name: "booking", path: (s) => `/book/${s.shopId}` },
  { name: "login", path: () => "/auth/login" },
];

for (const locale of LOCALES) {
  for (const pg of PUBLIC_PAGES) {
    test(`${pg.name} baseline @visual @mobile [${locale}]`, async ({ page, a11y, snap, pageErrors }) => {
      await gotoLocale(page, locale, pg.path(getSeed()));
      await expectDirection(page, locale);
      await a11y();
      await snap(pg.name);
      expect(pageErrors).toEqual([]);
    });
  }
}
