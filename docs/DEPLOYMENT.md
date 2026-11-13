# Production deployment checklist

Halaqy runs on **Vercel** (Next.js app) with **Supabase** (Postgres, Auth,
Realtime). Work through this list for the first launch and re-check it before
every release that touches the database or auth.

Use separate Supabase projects for **production** and **staging/preview**.
Never point preview deployments at the production database.

---

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | staging project URL | Required. The server refuses to start if it is missing or malformed. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key | Required. Public; RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role key | staging service role key | **Server only. Must never get a `NEXT_PUBLIC_` prefix.** Powers the shared rate limiter (`check_rate_limit` RPC). Without it each serverless instance limits on its own, so the limits are easy to bypass. |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | the preview or staging URL | No trailing slash. Must equal the Supabase Auth Site URL. |
| `NEXT_PUBLIC_USE_MOCK_DATA` | **unset** | **unset** | Mock mode is refused in production builds anyway. |
| `NEXT_PUBLIC_MOCK_AUTH_ROLE` | **unset** | **unset** | |
| `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD` | **unset** | **unset** | Escape hatch for throwaway design previews only. |
| `SKIP_ENV_VALIDATION` | **unset** | **unset** | Only for CI builds without secrets. |

- [ ] All required variables are set for Production **and** Preview.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not marked "exposed to the browser",
      and `grep -r SERVICE_ROLE .next/static` on a local build finds nothing.
- [ ] `NEXT_PUBLIC_*` values changed? Redeploy: they are inlined at build time.
- [ ] The first deployment's logs show no `[env] Invalid environment` warnings.

## 2. Vercel project

- [ ] Framework preset **Next.js**; build command `npm run build`; install
      command `npm ci`; Node.js version **20.x or newer** (matches `engines`).
- [ ] Production branch `main`. The GitHub `CI / checks` job is required in
      branch protection before merging.
- [ ] Custom domain added, HTTPS enforced, and the apex redirects to the
      canonical host. `NEXT_PUBLIC_SITE_URL` uses the canonical host.
- [ ] Function region close to the Supabase region (for example `fra1` for
      `eu-central-1`), to keep RPC round-trips short.
- [ ] Security headers from `next.config.ts` are present on a deployed page
      (`curl -sI https://<domain>/en/landing`). Check that the CSP
      `connect-src` allows your Supabase URL (`https://<ref>.supabase.co`
      and `wss://<ref>.supabase.co` for Realtime).

## 3. Database

### First deployment or any release with new migrations

1. Back up first (see [section 6](#6-backups-and-recovery)), or confirm that
   point-in-time recovery is active.
2. Link the project: `npx supabase link --project-ref <project-ref>`.
3. Run the **read-only pre-flight** queries from the header of
   `supabase/migrations/20250101001600_production_hardening.sql` in the SQL
   editor and keep the output:
   ```sql
   select tablename, policyname, cmd, roles, qual, with_check
     from pg_policies where schemaname = 'public' order by 1, 2;
   select conrelid::regclass, conname, pg_get_constraintdef(oid)
     from pg_constraint where connamespace = 'public'::regnamespace;
   ```
4. **One time only, for a database that ran the old `001`–`015` files:**
   repair the migration history, which records history and runs no SQL:
   ```bash
   npx supabase migration list --linked
   npx supabase migration repair --linked --status reverted \
     001 002 003 004 005 006 007 008 009 010 011 012 013 014 015
   npx supabase migration repair --linked --status applied \
     20250101000100 20250101000110 20250101000200 20250101000210 20250101000300 \
     20250101000310 20250101000400 20250101000410 20250101000500 20250101000600 \
     20250101000700 20250101000800 20250101000900 20250101001000 20250101001100 \
     20250101001200 20250101001300 20250101001400 20250101001500
   ```
   See the [rename table in the README](../README.md#migration-version-rename-one-time-repair-for-existing-databases).
5. Apply: `npx supabase db push --linked`. Try it on the staging project
   first.
6. **Read the NOTICEs.** If the output contains
   `appointments_no_overlap not created`, the database already holds
   overlapping active appointments. The booking RPC still prevents new
   overlaps, but fix the existing rows and then run the `ALTER TABLE …
   ADD CONSTRAINT appointments_no_overlap` statement from the migration by
   hand.
7. Verify:
   - [ ] `npx supabase migration list --linked` shows local and remote in sync.
   - [ ] Supabase **Advisors** (Security and Performance) show no new errors
         such as RLS disabled or a mutable function search_path.
   - [ ] An anonymous `select * from appointments` through the REST API
         returns nothing or a permission error.
   - [ ] An anonymous booking through the site works, and a second booking
         of the same slot gets "slot taken".

### Rules from now on

- [ ] Create migrations only with `npx supabase migration new <name>`. CI
      fails on duplicate version prefixes.
- [ ] Never edit production schema in the SQL editor without a matching
      migration.
- [ ] Never run `supabase/seed.sql`, the root `seed.sql` or
      `scripts/seed-e2e.mjs` against production. They create accounts with
      known passwords.

### Realtime

- [ ] The `notifications` table is in the `supabase_realtime` publication
      (Database → Publications), so the notification bell updates live.
      Migration `20250101001700_notifications_realtime.sql` adds it; verify
      it after `supabase db push`.

## 4. Supabase Auth (Dashboard → Authentication)

- [ ] **Email confirmation ON** (Sign In / Providers → Email → "Confirm
      email"). This is required for security: `link_customer_client` links
      a customer to existing bookings only through a *confirmed* email or
      phone. With confirmation off, anyone could sign up with someone
      else's email and see their bookings.
- [ ] **Site URL** = `https://<your-domain>` (same as `NEXT_PUBLIC_SITE_URL`).
- [ ] **Redirect URLs** allow-list includes:
  - `https://<your-domain>/en/auth/callback`
  - `https://<your-domain>/ar/auth/callback`
  - `https://<your-domain>/auth/reset-password` (password reset links;
    middleware adds the locale)
  - For previews only, on the staging project:
    `https://<project>-*-<team>.vercel.app/**`
- [ ] **Custom SMTP** configured (Authentication → Emails → SMTP), for
      example Resend, Postmark or SES with a verified domain (SPF, DKIM,
      DMARC). The built-in mailer is limited to a few emails per hour and is
      not meant for production.
- [ ] Email templates (confirm signup, reset password, magic link) branded
      and reviewed in both English and Arabic. Links use `{{ .SiteURL }}`
      or `{{ .ConfirmationURL }}`.
- [ ] Password policy: minimum length 8 or more; consider "leaked password
      protection" (Pro plan).
- [ ] **Auth rate limits** (Authentication → Rate Limits) reviewed: emails
      sent, sign-ups and sign-ins per IP, token refreshes.
- [ ] CAPTCHA (hCaptcha or Turnstile) enabled for sign-up and password reset
      if bot sign-ups appear.
- [ ] JWT expiry left at the default (3600 s) unless there is a reason to
      change it.
- [ ] Only the providers you use are enabled. Signups get the `customer`
      role unless they explicitly sign up as a shop owner. `barber` comes
      only through an invite.

## 5. Rate limiting and abuse

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set on the server (section 1), so
      `src/lib/rate-limit.ts` uses the shared `rate_limits` table rather
      than per-instance memory. The limits are set by the `rateLimit(...)`
      calls in `src/app/api/**/route.ts`, for example availability reads
      60 per minute per IP, booking creation 10 per minute per IP and
      cancellation 20 per hour per IP. The booking and cancel RPCs also
      enforce their own limits (`RATE_LIMITED`).
- [ ] Vercel Firewall or WAF rules considered for `/api/booking` if abuse
      appears. Vercel sets `x-vercel-forwarded-for`, which the limiter
      trusts first.
- [ ] The `rate_limits` table prunes itself (rows older than one day).
      Check its size occasionally.

## 6. Backups and recovery

- [ ] Daily backups enabled (all paid Supabase plans). **Point-in-time
      recovery** add-on enabled for production if the business cannot lose
      a day of bookings.
- [ ] A restore has been tested at least once into a new project.
- [ ] Before risky migrations, take a logical dump:
      `npx supabase db dump --linked -f backup-$(date +%F).sql` (schema) and
      `--data-only` (data). Store it outside the repository.
- [ ] **Rollback plan:** app regressions → Vercel "Instant Rollback" to the
      previous deployment. Migrations are forward-only: fix forward with a
      new migration, or restore (PITR) for data loss. The hardening
      migration is idempotent, so it is safe to re-run after a fix.

## 7. Monitoring

- [ ] Vercel **Runtime Logs** retained and watched. API errors are logged by
      `logServerError` with a `requestId`. The same id is returned to the
      client in error responses, so a user report can be traced.
- [ ] Log drain or alerting (Vercel integrations, for example Better Stack,
      Axiom or Datadog) on 5xx rates for `/api/*`.
- [ ] Error tracking (for example Sentry) for client and server exceptions.
      `src/app/global-error.tsx` and `[locale]/error.tsx` are the boundaries.
- [ ] Supabase **Reports** and **Logs** (API, Postgres, Auth) checked weekly;
      alert on database CPU, connections and disk.
- [ ] Uptime check on `https://<your-domain>/en/landing` and on
      `GET /api/health?deep=1` (200 when the app and a cheap Supabase ping
      succeed, 503 when Supabase is unreachable).
- [ ] Optional: Vercel Speed Insights. `<SpeedInsights />` is mounted in
      `src/app/[locale]/layout.tsx`; enable it in the Vercel project's
      Speed Insights tab to start collecting data.

## 8. Release smoke test (production, after each deploy)

- [ ] `/en` and `/ar` load. Arabic renders right-to-left in Cairo, with no
      layout overflow at 375 px width.
- [ ] Sign up as a customer → confirmation email arrives → confirm → land
      in the customer portal.
- [ ] Book as that customer → the booking appears in the portal and in the
      shop owner's calendar and notifications.
- [ ] Cancel inside and outside the cancellation window: inside is blocked
      with a clear message, outside works.
- [ ] Owner: complete a sale in My Day → it shows in the overview metrics.
- [ ] Owner: create an invite → accept it in a private window as a new user
      → the user becomes a barber of the shop.
- [ ] Password reset email → link opens the reset page → new password works.
