## Lumina Project History & System Context

This file is a **high‑level history and architecture overview** for the **Lumina** barbershop management platform.  
It is written to give any future AI / developer enough context to safely continue work.

---

## 1. Technology Stack & Architecture

- **Framework**: Next.js 16 (App Router) with React 19.
- **Styling**: Tailwind CSS v4 + custom CSS variables in `src/app/globals.css` (glassmorphism, spacing, radii, typography).
- **State management**: Zustand stores (e.g. `workspace-store`, `theme-store`, `leads-store`).
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, RLS).
- **Database access**:
  - Client: `@supabase/ssr` via `src/lib/supabase/client.ts` (`createClient()`).
  - Server/API: `@supabase/supabase-js` untyped clients (to avoid schema drift issues).
- **Charts & UI libs**:
  - Recharts (analytics/sales charts),
  - `@dnd-kit` (leads + services drag‑and‑drop),
  - Framer Motion (animations).
- **Deployment**: Vercel (project `7ala8i`) pointing to GitHub repo `mkoush82926/7ala8i`.

Key routing layout:
- Public: `/landing`, `/book`, `/join`, auth pages, `/api/booking`, `/api/invite`, `/api/invite/accept`.
- Authenticated (manager/barber): `/(dashboard)/*` – overview, calendar, clients, services, leads, analytics, settings.
- Authenticated (customer): `/customer` (isolated customer portal).

---

## 2. External Services & Configuration

### 2.1 Supabase

Used for:
- Auth (email/password, role metadata on `auth.users`).
- Postgres DB (all business data).
- Realtime (notifications, leads, etc.).

Environment variables (set in Vercel and `.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key (public).
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (server‑side only, used in some API routes and migrations; **never** exposed client‑side).

Schema is created and evolved via SQL migrations under `supabase/migrations`:
- `001_initial_schema.sql` → base tables + initial RLS.
- `002_add_missing_columns.sql` → extra fields and `daily_sales` table.
- `003_customer_role.sql` → customer role support.
- `004_fix_function_name.sql` → `get_current_shop_id()` helper.
- `005_invites.sql` → `invites` table (team invitations).
- `006_notifications.sql` → `notifications` table + realtime.
- `007_payments_and_policies.sql` → payment/deposit/cancellation fields + `payments` table.

> When deploying to a fresh Supabase project, run all migrations **in order** (`001` → `007`) via the SQL Editor.

### 2.2 Vercel

- The app is deployed to Vercel using the **Next.js** preset.
- Root directory: `./`.
- Build command: default (`next build`).
- Output directory: default Next.js output.
- Env vars are configured per `.env.example` as above.

GitHub integration:
- Repo: `https://github.com/mkoush82926/7ala8i`.
- Branch: `main`.
- Push to `main` ⇒ Vercel production deployment (7ala8i.vercel.app).

---

## 3. Auth Model, Roles & Security

Roles stored in Supabase and surfaced via:
- `profiles.role` (`shop_admin`, `barber`, `customer`) plus internal `super_admin` in the workspace store.
- `auth.users.raw_user_meta_data.role` for routing on login/signup.

Role behavior:
- **Manager (`shop_admin`)**:
  - Full access to all dashboard pages, settings, team invites, services, POS, analytics.
- **Barber (`barber`)**:
  - Limited dashboard: calendar, upcoming appointments, basic clients view (depending on future RLS), no shop‑wide settings or team invites.
- **Customer (`customer`)**:
  - Redirected to `/customer` after login.
  - Can see only their own appointments and edit their profile.

Routing & middleware:
- `src/middleware.ts`:
  - PUBLIC_ROUTES: `/landing`, `/book`, `/join`, `/auth/*`, `/api/booking`, `/api/invite`, `/api/invite/accept`.
  - Unauthenticated access to anything else:
    - If `pathname === "/"` → redirect to `/landing`.
    - Otherwise → redirect to `/auth/login?next={originalPath}`.
  - Authenticated:
    - If role is `customer` and path is not `/customer` → redirect to `/customer`.
    - If role is not `customer` and path starts with `/customer` → redirect to `/`.

Row‑Level Security (RLS) patterns:
- Most tables use one of:
  - `shop_id = public.get_user_shop_id()` (initial) or
  - `shop_id = public.get_current_shop_id()` (fixed function).
- Public (anon) permissions are limited strictly to booking flow:
  - Read active services and barbers.
  - Read appointments for availability.
  - Insert clients and appointments from the booking engine.

> Any new table must follow the same pattern: **enable RLS**, add helper policies for authenticated shop members, and carefully decide if anon needs any access for booking.

---

## 4. Functional History by Phase

### Phase 0 — Initial UI/UX Redesign

- **Goal**: Transform the existing SaaS into a modern, minimal, glassmorphism-style product with best‑practice white space, typography, and responsiveness.
- **Key work**:
  - Global design system in `globals.css` (CSS variables for colors, radii, shadows, spacing, transitions).
  - Landing page hero, sections, and pricing re‑designed with strong macro/micro white space.
  - Dashboard layout with glass cards, metric tiles, charts, and leads Kanban.
  - Base navigation (`sidebar`, `topbar`) and theming (dark mode default).

---

### Phase 1 — MVP Feature Build‑Out

- **Goal**: Implement a complete barbershop MVP: booking, calendar, CRM, analytics, settings, and customer portal.

**Backend: Supabase schema & migrations**
- `001_initial_schema.sql`:
  - Core tables: `shops`, `profiles`, `services`, `barbers`, `clients`, `appointments`, `leads`, `daily_sales`.
  - RLS via `get_user_shop_id()` and policies tied to authenticated user’s shop.
  - Trigger to create default shop, profile, barbers, and services on new auth user.
- `002_add_missing_columns.sql`:
  - Extra shop contact/social fields.
  - Service icon/active/sort order.
  - Client and appointment `source`.
  - A more robust `daily_sales` table with RLS and index.

**Frontend & APIs**
- **Booking flow**:
  - `/book` public booking engine (`BookingEngine`) with:
    - Step‑based UX: landing → services → barber → datetime → confirm.
    - Collapsed week/day/time slot picker with availability pulled from `/api/booking`.
  - `/api/booking`:
    - `GET` → returns shop info, active services, barbers, and optional appointments for a given date.
    - `POST` → validated by Zod, upserts client, inserts appointment, enforces rate limiting.
- **Dashboard (`/(dashboard)`)**:
  - Metric cards + sales chart + daily receipt using `daily_sales`.
  - Calendar timeline (per‑barber schedule).
  - Leads Kanban: stages (`new`, `contacted`, `booked`, `completed`, `loyal`).
  - Clients page with card grid and side drawer.
  - Services CRUD and reordering.
  - Settings page with multiple tabs (shop, team, booking link, billing).
- **Customer portal (`/customer`)**:
  - Authenticated customer view of their own history, upcoming/past appointments, and profile edit.
- **Notifications base**:
  - `notifications` table and `use-notifications` hook.
  - Static notification bell in `topbar` (later made dynamic).

---

### Phase 2 — Role‑Based Access, Middleware & Deployment

- **Goal**: Make navigation, auth, and deployment production‑ready.

**Middleware (`src/middleware.ts`)**
- Public route whitelist (see section 3).
- Supabase server client used to fetch user inside middleware.
- Root path `/` redirected to `/landing` for visitors (later fix).
- Role‑aware routing for customers vs non‑customers.

**Deployment & Git/GitHub**
- Repo initialized and pushed as:
  - `git init`
  - `git remote add origin https://github.com/mkoush82926/7ala8i.git`
  - `git branch -M main`
  - `git push -u origin main`
- Cursor/AI commits follow the pattern:
  - `feat: ...` for new features,
  - `fix: ...` for fixes,
  - `design: ...` for pure UI/UX polish.
- Vercel:
  - Project imported from GitHub repo.
  - Default Next.js build & output.
  - Env vars set via the Vercel UI from `.env.example`.

---

### Phase 3 — Services, Team, Notifications, Customer Enhancements

- **Goal**: Finish remaining MVP edges and polish core flows.

**Services**
- `use-services` hook for Supabase CRUD + realtime (insert/update/delete/reorder).
- `/services` dashboard page:
  - Service cards with icon, price, duration, active toggle.
  - Drag‑and‑drop reordering of services.
  - Add/edit/delete via modal.

**Team & invites**
- `invites` table with RLS:
  - Shop members can manage invites within their shop.
  - Public can read invites by code for join flow.
- Settings → Team tab:
  - Invite team members by email (generates invite link via `/api/invite`).
  - Show active team list, remove barbers (sets `profiles.shop_id` to `null`).
- `/join` page:
  - Accept invite by code, show shop info, let barber sign up or log in and join the shop via `/api/invite/accept`.

**Clients & leads**
- Clients:
  - Drawer supports edit and delete; data persisted to Supabase via `use-clients`.
- Leads:
  - Kanban “Import CSV” uses a hidden file input.
  - CSV parsed client‑side and persisted to Supabase; leads store hydrated from DB.

**Notifications**
- `notifications` migration (`006_notifications.sql`).
- `use-notifications` hook with realtime `INSERT` subscription.
- `topbar.tsx`:
  - Interactive bell with unread count badge.
  - Dropdown with list of notifications, mark single/all as read.

**Customer portal**
- Profile edit modal for name/phone.
- Barber names on appointments using joined profile data.
- Clear empty states and rebook buttons from customer view.

---

### Phase 4 — UI/UX White Space & Visual Polish (Multi‑Agent Pass)

- **Goal**: Apply white space, typography, button spacing, and color best practices to all core screens using the user’s design articles as reference.

Changes across:
- Landing + auth (`landing`, `auth/login`, `auth/signup`, `auth/reset-password`, `join`):
  - Macro spacing between sections (32–80px).
  - Consistent form label style (11px uppercase, tracking, semibold).
  - CTA button sizes (48–56px height, 24–44px padding).
- Dashboard & analytics:
  - Unified card padding and section spacing.
  - Fluid typography (`clamp(...)`) on metric values.
  - Clean chart headers and axis labels.
- Clients / services / booking / leads:
  - Consistent card inner padding and gaps.
  - Comfortable touch targets (time slots, drag handles, action buttons).
- Navigation / settings / customer / timeline:
  - `sidebar` and `topbar` button sizes, gaps, and padding tuned.
  - `settings-page` controls normalized (42px inputs, 36–40px tab items).
  - Customer dashboard quick‑actions and appointment cards visually aligned with the rest of the app.

These were **visual‑only** changes; no logic altered.

---

### Phase 5 — POS & Payments (Pay in Shop Only)

- **Goal**: Move from “theoretical” revenue to real, recorded payments without online processing.

**Schema (`007_payments_and_policies.sql`)**
- `shops`:
  - `currency`, `require_deposit`, `deposit_type`, `deposit_value`.
  - `cancellation_policy_hours`, `cancellation_fee_percent`.
- `appointments`:
  - `payment_status`, `payment_method`, `amount_total`, `amount_deposit`, `amount_paid`, `currency`, `cancelled_at`, `cancellation_reason`, `no_show`.
- `payments`:
  - Generic payment record table for future use (Stripe/cash/card/mixed), with RLS and indexes.

**Booking alignment (`/api/booking`)**
- On new booking creation:
  - `payment_status = "unpaid"`.
  - `payment_method = "cash"` (represents “pay in shop”).
  - `amount_total = totalPrice` from booking.
  - `amount_deposit = 0`, `amount_paid = 0`.

**In‑shop POS**
- `use-pos` hook:
  - `markPaid(...)`:
    - Updates appointment: `status = "completed"`, `payment_status = "paid"`, sets `payment_method` and `amount_paid`.
    - Inserts a `daily_sales` row with amount, payment method, and time.
  - `markNoShow(id)`:
    - Sets `status = "no_show"`, `no_show = true`.
  - `cancelAppointment(id)`:
    - Sets `status = "cancelled"`, `cancelled_at = now()`.
- `UpcomingAppointments` on the dashboard:
  - Shows price and time.
  - For managers/barbers:
    - **Mark Paid** button (cash).
    - **No‑show** button.
    - **Cancel** icon button.
  - Paid appointments show a “Paid” pill.
- Because POS writes into `daily_sales`, all existing:
  - `useDashboardMetrics` and
  - `DailyReceipt`
now report **true paid revenue**, broken down by `payment_method` (cash vs card).

> Stripe / online payments and “Pay Now” were intentionally **skipped** at the user’s request.

---

### Phase 6 — Security, Performance & Production Readiness (Ongoing)

- **Security / roles**:
  - Middleware behavior hardened:
    - Visitors hitting `/` see `/landing`.
    - Customers always redirected to `/customer`.
    - Non‑customers blocked from `/customer`.
  - RLS validated so authenticated users are always limited to their shop via `get_current_shop_id()`.
  - Anonymous capabilities restricted to booking and invite lookups where necessary.
- **Performance & UX**:
  - Rate limiting added to `/api/booking` using `src/lib/rate-limit.ts`.
  - Dashboard and analytics hooks query on indexed fields (`shop_id`, `created_at`, `start_time`) and aggregate in memory.
  - Empty states and skeletons added to key views (dashboard cards, daily receipt, upcoming appointments, services, clients, customer portal).

This phase is still open for further hardening (e.g., adding more indexes, paginating large lists, adding audit logging).

---

## 5. Running & Developing Locally

High‑level instructions (for any future developer/AI):

1. **Clone & install**
   - `git clone https://github.com/mkoush82926/7ala8i.git`
   - `cd 7ala8i`
   - `npm install` (or `pnpm install` / `yarn` depending on lockfile, if present).

2. **Env setup**
   - Copy `.env.example` → `.env.local`.
   - Fill in:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

3. **Database**
   - In Supabase SQL Editor, run migrations in order:
     - `001_initial_schema.sql` → `007_payments_and_policies.sql`.

4. **Dev server**
   - `npm run dev`
   - Visit:
     - `/landing` for marketing.
     - `/book` for public booking.
     - `/auth/signup` → choose Manager role for first account.
     - `/` for dashboard (after login).
     - `/customer` for customer dashboard (signup as customer role).

---

## 6. Guidelines for Future Changes (for any AI)

- **Respect existing roles and RLS**:
  - Any new table or feature must consider:
    - Which roles can read/write?
    - How does it relate to `shop_id`?
  - Always enable RLS and add policies that mirror existing patterns.
- **Do not expose secrets**:
  - Service role keys or API keys must **never** appear in client bundles.
  - Use server routes or edge functions for anything requiring elevated permissions.
- **Use existing utilities**:
  - Use `createClient()` from `src/lib/supabase/client.ts` in client components/hooks.
  - For server/API routes, use `@supabase/supabase-js` and environment vars.
  - Use `rateLimit` helper for any new public‑facing POST endpoints that can be abused.
- **Match design system**:
  - Colors from CSS variables (`--accent-mint`, `--bg-primary`, etc.).
  - Spacing using the existing scale (4/8/16/24/32/48/64) via inline `style` or Tailwind where already used.
  - Buttons: 36–56px tall, with readable font sizes and gaps (8–12px) between icon and text.
- **Error handling & UX**:
  - For any new async flow:
    - Show loading states.
    - Show clear error messages and offer retry, not silent failures.
  - Maintain “calm” layouts with sufficient white space; avoid clutter.

This document should be kept up to date whenever large architectural changes, new external services, or major product phases are added.


