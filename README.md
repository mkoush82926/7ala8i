# Halaqy (حلقي)

Halaqy is a multi-tenant booking and shop-management platform for barbershops,
built for the Jordanian market. It is bilingual (English and Arabic, with full
right-to-left layout).

- **Customers** find shops, book one or more services with a chosen barber (or
  "any barber"), and manage, cancel and review their bookings in a customer
  portal.
- **Shop owners** (`shop_admin`) run the shop from a dashboard: overview
  metrics, calendar, a "my day" view and point of sale, clients, a leads
  pipeline, services, team invites, analytics and settings.
- **Barbers** (`barber`) join a shop through an invite link. They see the
  whole shop calendar and manage their own appointments.

Each shop's data is isolated in Postgres with row-level security (RLS). The
browser only ever holds the public anon key.

---

## Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Mock preview mode](#mock-preview-mode)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Database and migrations](#database-and-migrations)
- [Deployment](#deployment)
- [Repository notes](#repository-notes)

---

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, "Ink & Brass" design tokens in `src/app/globals.css`, glass components in `src/components/ui` |
| Fonts | BDO Grotesk (Latin), Cairo (Arabic) |
| State | Zustand (`src/store`) |
| Backend | Supabase: Auth, Postgres with RLS, RPC functions, Realtime (notifications) |
| Validation | Zod (`src/lib/validations.ts`) |
| Charts and motion | Recharts, Framer Motion (respects reduced motion) |
| Tests | Vitest + Testing Library (unit), Playwright (end-to-end) |
| Hosting | Vercel (app) + Supabase (database and auth) |

Node.js **20.9 or newer** is required (see `engines` in `package.json`).

## Architecture

```
src/
  app/
    [locale]/                 every page lives under /en/... or /ar/...
      (dashboard)/            staff app shell: overview, calendar, my-day, clients,
                              leads, services, team, analytics, settings
      auth/                   login, signup, forgot/reset password, OAuth callback
      customer/               customer portal: bookings, booking detail, profile, explore
      explore/ shop/ book/    public discovery, shop page and booking wizard
      landing/ join/          marketing landing page, staff invite acceptance
      privacy/ terms/ policy/ legal pages
    api/
      booking/                GET availability, POST create booking (create_public_booking RPC)
      booking/cancel/         customer cancellation (cancel_customer_booking RPC)
      booking/status/         staff status changes
      invite/create|accept/   staff invite links
  components/                 ui primitives (dialog, toast, skeleton, empty-state ...) and feature components
  hooks/                      data hooks (appointments, clients, POS, dashboard metrics) and use-translation
  i18n/                       en.ts (source of truth for keys and types) and ar.ts (same shape)
  lib/
    env.ts                    the only place that reads process.env; validates it
    api-helpers.ts            withAuth, apiError/apiErrorCode, mapDbError, request ids
    rate-limit.ts             shared (database) rate limiter with an in-memory fallback
    validations.ts            Zod schemas for every API input
    types.ts                  canonical statuses, roles and enums (mirrored by DB CHECKs)
    supabase/                 browser/server clients, generated-style DB types, mock client
  middleware.ts               locale prefixing and role-based route guards
supabase/
  migrations/                 ordered SQL migrations (schema, RLS, RPCs, triggers)
  seed.sql                    self-contained local demo data
  config.toml                 local Supabase CLI configuration
e2e/                          Playwright specs and global setup
scripts/seed-e2e.mjs          seeds the end-to-end test users
docs/DEPLOYMENT.md            production checklist
```

Key principles:

- **The database enforces security.** RLS policies and `SECURITY DEFINER`
  RPCs are the source of truth for who can read or write what. API routes
  validate input and call RPCs with the caller's session; there is no
  service-role data client in the app.
- **Booking is server-priced.** `create_public_booking` computes price, end
  time and barber assignment in the database, rejects overlaps (`SLOT_TAKEN`),
  past slots and slots outside working hours. Public availability comes from
  `get_busy_slots`; anonymous visitors cannot read appointments.
- **Errors are codes, not English.** RPCs raise codes such as `SLOT_TAKEN` or
  `INSIDE_CANCELLATION_WINDOW`; API responses carry `{ success, error, code }`
  and the UI renders the localized `t.error.codes[code]`.
- **i18n.** `useTranslation()` returns `t` (typed from `src/i18n/en.ts`),
  `dir`, `isRTL` and locale-aware formatters (`formatCurrency`, `formatDate`,
  `formatTime`, `href`). `src/i18n/i18n.test.ts` fails if `ar.ts` drifts
  from `en.ts`. Use logical Tailwind classes (`ms-`, `pe-`, `start-`,
  `text-start`) so layouts flip correctly in Arabic.
- **Theming.** Dark mode applies to the staff app shell only. Public pages
  always render in the light theme.

## Local setup

Prerequisites: Node 20.9+, npm, and Docker (for the local Supabase stack).
The Supabase CLI is installed as a dev dependency, so `npx supabase` works
without a global install.

```bash
npm ci
cp .env.example .env.local
npm run db:start      # starts local Supabase in Docker, applies migrations + supabase/seed.sql
npx supabase status   # copy API URL, anon key and service_role key into .env.local
npm run dev           # http://localhost:3000 (redirects to /en or /ar)
```

Local Supabase also serves Studio at http://127.0.0.1:54323 and a test mail
inbox (Mailpit) at http://127.0.0.1:54324 for auth emails.

`npm run db:reset` rebuilds the local database from scratch (all migrations,
then `supabase/seed.sql`).

### Demo accounts (local only)

`supabase/seed.sql` creates two shops with barbers, working hours, clients,
appointments, a sale, a review and leads. All accounts use the password
`halaqy-local-123`. They exist only in your local database. Never seed them
anywhere else.

| Email | Role |
| --- | --- |
| `owner@halaqy.test` | shop_admin, The Gentleman's Chair |
| `sami@halaqy.test` | barber, The Gentleman's Chair |
| `khaled@halaqy.test` | barber, The Gentleman's Chair |
| `owner2@halaqy.test` | shop_admin, The Classic Razor |
| `customer@halaqy.test` | customer with a past (reviewed) and an upcoming booking |

## Mock preview mode

To click through the UI without Docker or Supabase, turn on mock mode in
`.env.local`:

```bash
NEXT_PUBLIC_USE_MOCK_DATA=true
NEXT_PUBLIC_MOCK_AUTH_ROLE=shop_admin   # optional: shop_admin | barber | customer
```

The Supabase client is replaced by an in-memory mock
(`src/lib/supabase/mock-client.ts`) that implements the same RPC contract
(`get_busy_slots`, `create_public_booking` including `SLOT_TAKEN`, and so on).
With `NEXT_PUBLIC_MOCK_AUTH_ROLE` set, middleware fakes a signed-in session so
the dashboard or customer portal can be previewed.

Mock mode is for `npm run dev` only. `src/lib/env.ts` refuses it whenever
`NODE_ENV=production`, so `next build && next start`, Playwright and every
Vercel deployment always run against real Supabase. The escape hatch
`NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true` exists for throwaway design previews and
must never be set on a real deployment.

## Environment variables

All variables are validated in `src/lib/env.ts`. A production server fails
fast on a missing or malformed Supabase URL or anon key. `.env.example`
documents each variable.

| Variable | Required | Exposed to browser | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase project URL (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Public anon key. RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | production | **no** | Server only. Powers the shared rate limiter (`check_rate_limit`) and the e2e seed script. Without it, rate limits fall back to per-instance memory. |
| `NEXT_PUBLIC_SITE_URL` | recommended | yes | Public origin, for example `https://halaqy.app`. Must match Supabase Auth "Site URL". |
| `NEXT_PUBLIC_USE_MOCK_DATA` | no | yes | `true` turns on mock preview mode (dev only) |
| `NEXT_PUBLIC_MOCK_AUTH_ROLE` | no | yes | Fake signed-in role in mock mode: `shop_admin`, `barber` or `customer` |
| `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD` | no | yes | Leave unset. Allows mock mode in a production build. |
| `SKIP_ENV_VALIDATION` | no | no | `1` skips the production env check, for builds without secrets. Never set it on a running server. |
| `E2E_BASE_URL` | no | no | Point Playwright at an already-running app |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` / `npm run lint:fix` | ESLint (blocking in CI) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest, single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Unit tests with a v8 coverage report in `coverage/` |
| `npm run test:ci` | What CI runs: coverage plus GitHub annotations |
| `npm run test:e2e` | Playwright end-to-end tests (needs local Supabase) |
| `npm run verify` | Migration check, lint, typecheck and unit tests in one go |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Re-apply all migrations and `supabase/seed.sql` locally |
| `npm run db:seed:e2e` | Create the Playwright test users (also run by e2e global setup) |
| `npm run db:check-migrations` | Fail if two migration files share a version prefix |

A Husky pre-commit hook runs `eslint --fix` on staged `.ts`/`.tsx` files via
lint-staged.

## Testing

**Unit tests** live next to the code as `*.test.ts(x)` under `src/` and run
in jsdom (Vitest + Testing Library). They cover the API routes, validation
schemas, env resolution, rate limiting, the mock Supabase client, formatters,
i18n key parity, stores and the UI primitives.

```bash
npm test
npx vitest run src/lib            # one folder
npm run test:coverage             # open coverage/index.html
```

**End-to-end tests** (`e2e/`) drive a real production build against the local
Supabase stack: login redirects by role, a full customer booking, and the
booking showing up in the customer portal.

```bash
npm run db:start && npm run db:reset
npx playwright install chromium   # first time only
npm run test:e2e                  # builds, starts on :3000, seeds e2e users, runs specs
```

`e2e/global-setup.ts` calls `scripts/seed-e2e.mjs`, which needs
`SUPABASE_SERVICE_ROLE_KEY` (from `npx supabase status`). Reports go to
`playwright-report/`.

**CI** (`.github/workflows/ci.yml`) runs on every push and pull request to
`main`:

1. `checks` (required): unique migration versions, `npm ci`, lint, typecheck,
   unit tests with coverage, and a production build with placeholder public env.
2. `e2e` (optional, non-blocking): starts Supabase in the runner, then runs
   Playwright. The HTML report is uploaded as an artifact when it fails.

## Database and migrations

- Migrations live in `supabase/migrations` and are applied in version order.
  The version is the prefix before the first `_`, and it must be unique.
  Create new ones only with `npx supabase migration new <name>`, which
  generates a timestamped file.
- `20250101001600_production_hardening.sql` brings any database to the shape
  the app expects. It reconciles the schema, converts legacy values
  (`no-show` to `no_show`, `loyal` to `regular`), consolidates RLS to one
  policy per table and command, adds triggers, indexes and the overlap
  exclusion constraint, and defines every RPC. It is idempotent.
- Regenerate types after a schema change with
  `npx supabase gen types typescript --local`, then reconcile them with
  `src/lib/supabase/database.types.ts`.
- The root-level `seed.sql` and `generate_seed.js` are legacy scripts for one
  specific hosted project. The CLI does not load them.

### Migration version rename (one-time repair for existing databases)

The original migrations reused the versions `001` to `004`, which broke
`supabase db push` and `db reset`. All files were renamed to unique versions,
keeping their order and content:

| Old | New |
| --- | --- |
| `001_initial_schema` | `20250101000100_initial_schema` |
| `001_rls_policies` | `20250101000110_rls_policies` |
| `002_add_missing_columns` | `20250101000200_add_missing_columns` |
| `002_indexes` | `20250101000210_indexes` |
| `003_customer_role` | `20250101000300_customer_role` |
| `003_public_booking_functions` | `20250101000310_public_booking_functions` |
| `004_fix_function_name` | `20250101000400_fix_function_name` |
| `004_secure_booking_rpc` | `20250101000410_secure_booking_rpc` |
| `005_barber_services` … `015_profiles_rls_hardening` | `20250101000500_…` … `20250101001500_…` (same names) |
| (new) | `20250101001600_production_hardening` |

A database that already ran the old files (for example production) must have
its migration history repaired once **before** the next push. Repair only
edits history; it runs no SQL:

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked            # inspect what is recorded first

npx supabase migration repair --linked --status reverted \
  001 002 003 004 005 006 007 008 009 010 011 012 013 014 015

npx supabase migration repair --linked --status applied \
  20250101000100 20250101000110 20250101000200 20250101000210 20250101000300 \
  20250101000310 20250101000400 20250101000410 20250101000500 20250101000600 \
  20250101000700 20250101000800 20250101000900 20250101001000 20250101001100 \
  20250101001200 20250101001300 20250101001400 20250101001500

npx supabase db push --linked                   # applies only 20250101001600
```

Run the read-only pre-flight queries from the header of
`20250101001600_production_hardening.sql` first, and read the NOTICEs during
the push. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#3-database).

## Deployment

The app deploys to **Vercel**; the database and auth run on **Supabase**.
Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), the production checklist for
environment variables, Supabase Auth settings (email confirmation **on**,
site URL and redirect URLs, SMTP), migrations, backups, rate limits and
monitoring.

## Repository notes

These tracked files are not used by the app. They are kept for history and
are candidates for moving into `docs/` or deleting:

- `test.css`: compiled Tailwind output from an old experiment.
- `LUMINA_CONVERSATION_HISTORY.md`, `PROJECT_HISTORY.md`, `SKILL.md`,
  `UX_ENHANCEMENT_PLAN.md`: planning and history notes. `PLAN.md` and
  `TODO.md` are the active roadmap.
- `stitch-designs/`, `design-system/`: design references.
- `seed.sql`, `generate_seed.js`: the legacy seed described above.

`videoassets/` (git-ignored) holds the original video files; the app uses
the copies in `public/videos/`.
