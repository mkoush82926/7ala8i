# E2E harness

- `fixtures.ts` — `test` with `a11y()` (axe, zero serious/critical), `snap(name)`
  (visual snapshot per locale and project) and `pageErrors`; `LOCALES = ["en","ar"]`,
  `gotoLocale()`, `expectDirection()`.
- Projects: `chromium` (desktop, every spec) and `mobile` (375×812, specs tagged `@mobile`).
- `visual/baseline.spec.ts` — baseline snapshots for public pages in en + ar.
  Capture with `npx playwright test e2e/visual --update-snapshots`.
- `db/*.rls.sql` — SQL privilege checks; run after the migration inside a
  rolled-back transaction (see the header of each file).

Every workstream adds its flows in both `en` and `ar` with `a11y()` and `snap()`.
