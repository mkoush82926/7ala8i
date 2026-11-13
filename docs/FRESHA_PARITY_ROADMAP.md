# Halaqy Build Roadmap: Fresha-level capability, built for Jordan

Repo: `/Users/Mohammad/Desktop/Halaqy/7ala8i` (Next.js App Router, `[locale]` en/ar, Supabase). The latest migration is `20250101001800_private_columns_and_verified_links.sql`. The current appointment status CHECK is `pending, confirmed, completed, no_show, cancelled`, so `confirmed` already exists. Brand tokens live in `src/app/globals.css`:
- `--accent-brass` is #a67c3d in light and #c9a063 in dark.
- Text-safe brass on white is #7c5a26.
- The dark theme is "Ink & Brass, after hours".

**Time:** Jordan uses `Asia/Amman`, which is UTC+3 all year with no DST since 2022. Every time column is `timestamptz`. All slot, report and reminder logic computes in `Asia/Amman`. Ramadan night shifts that run past 00:00 must be supported and tested.

---

## 1. Executive summary

### Where Halaqy stands
Halaqy's operational core is solid. In a few areas it already does better than Fresha:
- Guest booking with no account (`create_public_booking`). Fresha requires an account.
- Full en/ar with RTL and hreflang. Fresha's Arabic is partial.
- Arabic search normalisation.
- A rebook nudge built around the barber, plus self-service cancel and reschedule.
- Verified reviews, one per appointment (`submit_review`).
- A DB-level overlap exclusion constraint.
- A server-rendered shop page with JSON-LD and a sticky mobile booking bar.

Halaqy is **not yet a marketplace**, and its POS, calendar and back office are thin:
- No photos, geo or categories.
- No outbound messaging.
- A single-day timeline only.
- Cash/card checkout with no cart, tips, tax or register.
- No owner reports, onboarding wizard, booking links or QR codes, platform admin, marketing automation or business-side alerts.

### The 5 biggest gaps
1. **Discovery has no data to work with.** Shops have no lat/lng, city or area, photos, service categories or publish gate. That blocks the map, filters, "near me", SEO landing pages and good cards. Shops show initials instead of a photo, and there is no self-serve way to create a complete shop.
2. **No outbound WhatsApp, SMS or push.** There are no confirmations, reminders, review requests, waitlist offers, magic links, barber alerts or marketing sends. Notifications are in-app only. This is the biggest lever on no-shows and retention.
3. **Calendar and front desk.**
   - No week, 3-day or month views, and no drag-and-drop.
   - No blocked time, including prayer breaks.
   - No date overrides or closures (Eid, Ramadan).
   - No walk-in queue, and staff cannot save a walk-in without a name.
   - Availability logic is spread across several functions with no single owner.
4. **Money and reporting.**
   - No cart or line items, discounts, tips or 16% GST.
   - No configurable payment methods (CliQ, Zain Cash) and no split payments.
   - No product sales, refunds or cash register.
   - No numbered receipts, commissions or pay runs.
   - No owner KPIs or reports.
5. **Barber as a first-class entity.** The `barbers` table holds only a name. It has no avatar, bio, languages, portfolio, per-barber rating, seniority pricing, or online/auto-assign flags. Jordanian clients choose by barber.

### Where Halaqy can beat Fresha locally
- **WhatsApp-first messaging in the shop's own name.** Messages carry Confirm/Reschedule/Cancel buttons and a manage link that needs no login, and they respect quiet hours and Jumu'ah. Fresha's messages are one-way and carry Fresha's brand.
- **A walk-in queue with live estimated wait** and a "your turn is near" WhatsApp ping. Fresha does not document one.
- **CliQ-native deposits**, collected manually from risky clients only, from P2. Pay-at-shop stays the default.
- **Prayer-time blocks computed daily**, Eid closures, Ramadan night shifts entered by Hijri preset, and a Saturday-start week.
- **Barber-first discovery:** search by barber name, "favourite barber", "notify me when Ahmad is free", and "Book this look" from a portfolio.
- **Instagram/QR-first acquisition:** a branded `/b/[slug]` link with no competitors shown, printable AR/EN QR posters, and source attribution in reports.
- **A back office built for a cash economy:**
  - register close sent to the owner on WhatsApp
  - a daily WhatsApp KPI summary
  - cash advances (سلفة)
  - pay runs combining salary and commission
  - receipts shaped for JoFotara
- **Clean programmatic SEO** with Arabic slugs and validated data. Fresha's pages show glitches: a 4.0 aggregate next to 5.0 cards, "from £0.01", and duplicated FAQs.

---

## 2. Design and UX upgrade principles (Ink & Brass, not Fresha)

These patterns come from the research and are expressed in Halaqy's own identity. Halaqy keeps its own palette, type and iconography. It does not reuse Fresha's purple/black look or its copy.

1. **One primary action per surface, in brass.** Brass is reserved for the primary CTA (Book now, Continue, Confirm, Check out) and for focus rings. Everything else is ink or neutral. Use `#7c5a26` for brass text on light backgrounds (it meets AA) and `--accent-brass` for fills.
2. **Booking is always one tap away:**
   - an inline "Book" on every service row
   - a sticky right card on desktop (≥1024px)
   - a sticky bottom bar on mobile showing "N services · from X JD" and Book now
   - one shared `BookingCta` component with an `entry` prop, which writes `?src=` / `?entry=` for attribution
3. **Middle-dot meta lines** are the house pattern for dense facts:
   - `4.9 (312) · Open until 11:00 pm · Khalda, Amman`
   - `30–45 min · from 5 JD`
   - `2 weeks ago · Skin fade · with Ahmad`

   Build a single `<MetaLine items={[]}/>` that handles RTL separators and digit locale.
4. **Every search field has a permissive default** (All services · Near me / Amman · Today). Search state lives in the URL (`q`, `area`, `when`, `sort`, `f[]`), so searches can be shared and crawled. The same bar is sticky and pre-filled on results and landing pages.
5. **Progressive disclosure.** The profile shows 3–6 services per category tab, and "See all" links straight into booking. Each card shows 3 services that match the query. A section renders only when it has content: no empty Portfolio, Team rating or Amenities blocks.
6. **Empty states always offer a next step:**
   - A full day shows "Next available: Thu 5:30 pm", "Any barber" and "Join waitlist".
   - No results shows "Widen to all Amman" or "Try tomorrow".
   - A blocked cancel shows "WhatsApp the shop".
   - New dashboards show guided setup.
7. **Show the policy before any charge**, in plain language, in both languages, with an exact deadline: "Free cancellation until Thu 6:00 pm".
8. **Small text pills for badges** (Top rated, Deals, New, Verified, Quiet hours). Use one `Pill` component with tokenised tones (ink, brass, success, danger). Status always pairs colour with an icon or label, never colour alone.
9. **RTL by construction:**
   - CSS logical properties only (`ms-`, `me-`, `ps-`, `inset-inline-*`).
   - Mirrored chevrons and drag directions.
   - Map controls on the inline-end side.
   - An Arabic-Indic/Latin digit preference stored per user.
   - Lint rule: no `left-`, `right-`, `ml-` or `mr-` in new code.
10. **Images:**
    - fixed aspect ratios (cover 16:9, portfolio 1:1)
    - blur placeholders
    - `next/image` with mobile and desktop sizes
    - bilingual alt text
    - a 1/N counter on the mobile carousel and a lightbox on desktop
11. **Mobile-first back office:**
    - a vertical day view with a swipeable barber selector
    - a FAB with Appointment, Walk-in now and Block time
    - long-press to drag
    - sticky bottom actions within thumb reach
    - a PWA install prompt in the dashboard, which iOS web push requires
12. **Money formatting.** Use one `formatJOD(amount, {locale, rounding})` everywhere. It shows 3-decimal fils, or rounds to 0.250/0.500 when the shop sets that, with "JD" or "د.أ" by locale.
13. **Arabic-first copy.** Arabic is written first and English is translated from it. Use barber vocabulary throughout: حلاقة، تحديد، دقن، سشوار، ماسك أسود.

---

## 3. Day-0 owner actions and open decisions

### Owner actions to start on day 0
These have external lead times and gate the Phase 1 exit.

| # | Action | Why now |
|---|---|---|
| 1 | **Start Meta Business verification and the WhatsApp Business Platform application.** Choose a direct Meta account or a BSP (360dialog, Twilio, Infobip). Submit the AR/EN utility and authentication templates that the 1C agent drafts on its first day. | Verification and template approval take days to weeks. Phase 1 can exit with the wa.me fallback. |
| 2 | Open an SMS provider account and register the alphanumeric sender ID "Halaqy" with the Jordanian carriers. | Needed for the SMS fallback and OTP. Carrier approval takes time. |
| 3 | Create a Cloudflare Turnstile (or hCaptcha) site key, a Sentry project and a MapTiler key. | All have free tiers. They are needed for bot protection (1D, 1J), error monitoring (all WS) and maps (1A, 1B). |
| 4 | Book counsel to review compliance with the PDPL (Personal Data Protection Law No. 24 of 2023), update the AR/EN Terms and Privacy, and review the plan for unclaimed listings. | P1 consent and export/deletion features and P2 unclaimed listings depend on it. |
| 5 | Start supply acquisition by onboarding about 50 Amman shops by hand, using the 1G wizard once it lands. | 2A area pages need at least 3 published shops each to be indexed. |

### Decisions needed before the named workstream starts
| Decision | Needed before | Proposed default (owner to confirm) |
|---|---|---|
| **Halaqy plans, pricing and billing for shops**: tiers, trial, limits (barbers, messages per month), and WhatsApp cost pass-through | 1C (message costs scale with usage) | 30-day free trial. Tiers by number of barbers. A monthly allowance of utility messages per tier, with overage billed at cost. Marketing messages are always passed through at cost. Shops pay by CliQ or bank transfer with a manual invoice until a PSP exists. |
| **Tax model**: prices inclusive or exclusive, line vs sale rounding, which shops are registered | 1F | Displayed prices include tax. Tax is computed per line and rounded to the fils, and the sale total is the sum of the lines. Tax lines appear only when `shops.is_tax_registered`. |
| **JoFotara**: confirm the current ISTD e-invoicing mandate for VAT-registered shops | 1F | If the mandate applies, 1F makes receipt numbering and tax fields fit JoFotara from day one, and the export moves to P2. If it does not, the export stays in P3. |
| **Prayer-time calculation method** | 1E | Confirm whether the Umm al-Qura or the Muslim World League method matches the Ministry of Awqaf's published Amman timetable. Acceptance is ±2 minutes. |
| Default cash rounding | 1F | 0.250 JD per shop setting, off by default. |
| Marketplace visibility default for new shops | 1G | `marketplace_visible=true` once published. The owner can switch to "link only". |

---

## 4. Phased roadmap

**Conventions for parallel agents**
- **Ownership:**
  - Each workstream (WS) owns disjoint files and a reserved block of migration numbers.
  - Shared primitives (P0) and the availability engine (P0V) land first. Everything else imports them read-only.
- **Effort:** S ≤1 agent-day, M 2–3, L 4–6, XL >6.
- **Migrations:** `supabase/migrations/2025010100XX00_*.sql`. Blocks are assigned per WS below.
- **RPCs:** every RPC is `SECURITY DEFINER` with an explicit `search_path`.
- **RLS:**
  - Every new table has RLS via `get_current_shop_id()` / `is_shop_admin` / `is_shop_staff`.
  - These helpers resolve shop → organization, so multi-branch later does not mean rewriting every policy.
- **Single-owner rules:**
  - **Availability** (slots, busy time, working checks, holds) is defined only by WS-P0V. Every other WS calls it and none redefines it.
  - **`create_public_booking`** is defined only by WS-1D.
  - **The appointment status CHECK** is changed only in the WS-P0 migration.
  - A WS that needs a column on a table it does not own goes through that table's owner.
- **Security for public RPCs:**
  - Every RPC callable by `anon` (`search_shops`, `create_public_booking`, the token endpoints, OTP) calls the P0 `check_rate_limit()`, keyed per IP and per phone.
  - Guest booking and OTP require a Turnstile token when one is configured.
  - Acceptance: 100 booking attempts per minute from one IP are blocked after the threshold.
- **QA gates on every WS** (in CI, beyond `npm run typecheck && test`):
  - Playwright e2e for the WS's flows in both `en` and `ar` (RTL)
  - visual-regression snapshots for the shop, booking and calendar pages it touches
  - axe accessibility checks with zero serious violations
  - Sentry wired with no new unhandled errors in e2e

### Phase 0: Shared foundations (days 1–3, two agents, blocks everything else)

#### WS-P0 · Primitives, data spine and QA harness (M)
Owns:
- `src/components/ui/{meta-line,pill,booking-cta,price}.tsx`
- `src/lib/format.ts`, `src/lib/rate-limit.ts`
- the `e2e/**` harness, Sentry config
- migration `...001900_marketplace_spine.sql`

**Scope:**
- `formatJOD`
- a digit-locale helper
- `MetaLine`, `Pill`, `BookingCta`
- an ESLint rule against physical-direction classes
- the Playwright en/ar harness with axe and visual-regression setup
- Sentry
- a `mask_phone()` helper

**DB changes:**
- **Cities and areas.** `cities(id, slug_en, slug_ar, name_en, name_ar, governorate)` and `areas(id, city_id, slug_en, slug_ar, name_en, name_ar, lat, lng)`. Seed Amman, Irbid, Zarqa, Aqaba, Salt and Madaba, plus about 40 Amman areas.
- **Organizations.** `organizations(id, name, created_at)` and `shops.organization_id NOT NULL`, backfilled with one organization per existing shop. The multi-branch UI stays in P3.
- **New `shops` columns:**
  - `city_id, area_id, lat, lng, landmark_en, landmark_ar`
  - `slug UNIQUE, slug_ar, name_ar, description_ar`
  - `is_published bool default false, published_at`
  - `marketplace_visible bool default true`, separate from `is_published`
  - `is_verified, cover_url, logo_url`
  - `tax_number, is_tax_registered bool default false`
  - `timezone default 'Asia/Amman'`
- **Publish backfill.** Set `is_published=true` for existing shops that have at least 1 active service and working hours.
- **Categories.** `service_categories(id, slug, name_en, name_ar, synonyms_ar text[], sort)` as a global taxonomy, plus `services.category_id`.
- **Platform roles.** `profiles.platform_role` (null, `support`, `admin`).
- **Status CHECK (sole owner):** add `arrived, in_chair, awaiting_deposit` to the existing `pending, confirmed, completed, no_show, cancelled`.
- **Rate limiting.** `rate_limits(key, window_start, count)` plus `check_rate_limit(p_key, p_window_s, p_max)`.
- **Indexes.** `pg_trgm` and GiST.

**Acceptance:**
- The migration applies cleanly on a copy of `prod-backup-20261113-0339`.
- Types are regenerated.
- Existing pages are visually unchanged (snapshot baseline captured here).
- `formatJOD(7.5,'ar')` returns "٧٫٥٠٠ د.أ", with digits following the user's preference.
- RLS tests pass with `organization_id` present.

#### WS-P0V · Availability engine (M–L) *(sole owner of availability)*
Owns `src/lib/availability/**`, `supabase/tests/availability/**` and migration `...001950_availability_engine.sql`.

**Scope:** one SQL function set plus a TS wrapper that every WS calls:
- `get_available_slots(shop_id, date_from, date_to, items jsonb, barber_id null, ignore_appointment_id null)`
- `next_available_slot(shop_id, items jsonb, barber_id null)`
- `is_slot_bookable(...)`, used under an advisory lock by 1D
- `pick_any_barber(...)` for auto-assign
- the redefined `get_busy_slots` and `barber_is_working`

**DB changes.** This WS creates every table and column that affects availability. Other WS build UIs on top of them.
- **Hours and closures:**
  - `shift_overrides(barber_id, date, segments jsonb)`
  - `time_off(barber_id, start, end, type, status)`
  - `closed_periods(shop_id, start_date, end_date, note_en, note_ar)`
  - `special_hours(shop_id, date, is_closed, segments jsonb, note_en/ar)`
- **Blocked time:**
  - `blocked_time_types(shop_id, name_en, name_ar, emoji, default_minutes, is_paid)`
  - `blocked_times(id, shop_id, barber_id null, start_time, end_time, type_id, title, rrule, series_id, source manual/prayer, allow_online)`
- **Holds.** `slot_holds(id, shop_id, barber_id, start_time, end_time, reason, expires_at)`. It is empty in P1; 2D waitlist and 1D checkout holds write to it.
- **Booking-rule columns:**
  - `shops.min_notice_minutes, booking_window_days, slot_interval_minutes`
  - `services.buffer_minutes, processing_offset_minutes, processing_minutes` (processing time frees the barber)
  - `barber_services.duration_override`
  - `barbers.online_bookable bool default true, auto_assignable bool default true`

**Acceptance:**
- One test suite covers blocks, overrides, closures, special hours, holds, buffers, processing time, notice, window and interval.
- It also covers a Ramadan shift running past 00:00 in `Asia/Amman`, and the existing exclusion constraint.
- p95 for `get_available_slots` for 1 shop × 6 barbers × 14 days is under 150ms.

---

### Phase 1: Launch-critical (3–4 weeks including integration, split into 1a and 1b)

#### Phase 1a (weeks 1–2): 1A, 1D, 1F, 1G in parallel

##### WS-1A · Shop profile media, barbers and publishing (L)
Owns:
- `src/app/[locale]/shop/**`
- `src/app/[locale]/barber/**` (new)
- `(dashboard)/settings/profile/**` (new tab)
- migration block `...002000`

| Item | Details |
|---|---|
| User story | As a client, I see real photos, the barbers, their work and where the shop is before I book. As an owner, my page goes public only when it looks complete, and I can choose to be "link only" rather than listed in search. |
| Scope | **Photos:** upload to Supabase Storage bucket `shop-media` (public-read, owner-write RLS) with reorder. Desktop mosaic, mobile carousel with 1/N counter, and lightbox. The cover is used as og:image and as the card image.<br>**Barbers and location:** barber profile fields. A static map (OSM/MapLibre static tile) with Google Maps and Waze links and landmark text.<br>**Page structure:** scroll-spy tabs. Setup checklist with a completeness score, a Publish toggle and a Marketplace visibility toggle.<br>**SEO:** JSON-LD gains `openingHoursSpecification`, `geo`, `priceRange`, `hasOfferCatalog`, `sameAs`, `BreadcrumbList` and a reserve action. Readable slug routes `/shop/[slug]`, with the UUID route 301-redirecting.<br>**Per-barber rating:** derived now by joining `reviews` → `appointments.barber_id`. 2B later stores it as a column. |
| Screens | The shop page (updated) and `/barber/[handle]` (new). Settings › Public profile with photos, location pin picker, landmark, amenities, publish checklist and marketplace visibility. |
| DB/API | `shop_photos(id, shop_id, path, sort_order, alt_en, alt_ar)`. New `barbers` columns: `avatar_url, title_en, title_ar, bio_en, bio_ar, languages text[], handle UNIQUE, years_experience, is_public`. The availability flags belong to P0V. `portfolio_items(id, shop_id, barber_id, service_id null, path, caption, sort_order, is_featured)`. `amenities` (lookup) plus `shop_amenities`. Explore and sitemap queries filter on `is_published AND marketplace_visible`. `barber_rating_view`. |
| Acceptance | An unpublished shop returns 404 publicly but its owner can preview it. A shop with `marketplace_visible=false` is absent from search and the sitemap but its page is reachable. Lighthouse SEO ≥95 and the Rich Results test passes. Images are lazy-loaded with blur placeholders. RTL mirrors correctly. The barber page books with `?barber=` preselected. The QA gates pass. |
| Dependencies | P0, P0V. |

##### WS-1D · Booking flow v2 (L) *(sole owner of `create_public_booking`)*
Owns:
- `src/app/[locale]/book/**`
- `src/components/booking/**` (`booking-engine.tsx` split into step files)
- `src/lib/otp/**`
- the services catalog editor `(dashboard)/services/**`
- migration block `...002300`

| Item | Details |
|---|---|
| User story | As a client, I pick services (with variants), see each barber's next free slot and price, pick a time grouped by part of the day, and confirm. Where a provider is configured, I verify my phone with a WhatsApp or SMS code. My selections persist throughout. |
| Scope | **Services step:** category tabs, price types (fixed/from/free), variant picker, sticky summary bar (total JD and minutes).<br>**Barber step:** "Any barber" first, then cards with avatar, rating, "+2 JD" surcharge and "Today 4:30 pm" from `next_available_slot`.<br>**Time step:** a day strip with full days greyed out, Morning/Afternoon/Evening groups and a "Next available" jump, all from `get_available_slots`. Owner settings UI for min notice, window, interval, buffer and processing time, stored in P0V columns.<br>**Review step:** plain-language policy with deadline, per-service client note, quick note chips, and the shop's "important info".<br>**OTP:** feature-flagged. It uses Supabase phone auth where the provider is supported natively, or the Supabase Send-SMS auth hook for Unifonic, a local gateway or WhatsApp authentication templates. It links to or creates the client. With no provider configured, guest booking continues with `check_rate_limit` per IP and phone plus Turnstile.<br>**Attribution:** pass `?barber=&src=&entry=` through into `appointments.source`, fixing the hard-coded `'online'` at `booking-engine.tsx` L603.<br>**Reschedule:** an atomic RPC that keeps the old slot until the new one commits.<br>**Catalog:** basic catalog UI plus `location_type`. |
| DB/API | `service_variants(id, service_id, name_en, name_ar, price, duration, sort)`. New `services` columns: `price_type CHECK(fixed,from,free)`, `audience`, `location_type CHECK(in_shop,home) default in_shop`, `description_en/ar`, `client_note_en/ar`, `online_bookable`. New `barber_services` column: `price_override`. `appointment_services(id, appointment_id, service_id, variant_id, barber_id, price, duration, sort)`, keeping `service_ids[]` populated for back-compat during the transition. `shops.important_info_en/ar`. `reschedule_booking(p_id, p_date, p_start)`. `create_public_booking` gains `p_items jsonb, p_source, p_otp_token null, p_captcha_token null` and calls `is_slot_bookable` under lock. `phone_verifications` (if the hook route is used). |
| Acceptance | **Concurrency:** the server re-validates every slot under lock, and two concurrent requests for the same slot produce exactly one booking.<br>**OTP:** state survives a refresh. With the OTP flag off, guest booking works and 100 attempts per minute from one IP are blocked.<br>**Speed:** booking to confirmation takes ≤4 taps on mobile when a service is preselected.<br>**Compatibility:** existing bookings still render.<br>The QA gates pass. |
| Dependencies | P0, P0V. Uses the 1A barber fields and falls back gracefully to the name alone. |

##### WS-1F · Hours UI, closures and checkout v1 (L)
Owns:
- `(dashboard)/team/**` (shift section only, extracted to `src/components/team/shifts/**`)
- `src/components/dashboard/checkout-dialog.tsx`, `src/hooks/use-pos.ts`
- `(dashboard)/settings/{payments,hours,tax}/**`
- migration block `...002500`

| Item | Details |
|---|---|
| User story | As an owner, I set Ramadan hours and Eid closures once. I check clients out with cash, CliQ or a split, add a discount, a tip and a product such as wax or beard oil, and send a numbered receipt on WhatsApp. |
| Scope | **Hours and closures:** UI over the P0V tables for per-date shift overrides with multiple segments, time off, `closed_periods` and `special_hours`. A banner on the public page. A Hijri date entry and a preset such as "Ramadan 1448 hours" that converts to Gregorian ranges. A list of affected appointments with bulk WhatsApp notify via 1C `enqueue_message()` (stubbed until 1C lands).<br>**Payment methods:** configurable (Cash, Card POS, CliQ with alias/QR, Zain Cash, Orange Money, custom).<br>**Checkout cart:**<br>• prefilled from `appointment_services`<br>• add a service<br>• add a **custom item or product line**<br>• line or cart discount with a reason<br>• tip assigned to a barber<br>• split payment with the remaining balance shown large<br>• tax per the §3 decision (inclusive, per-line rounding)<br>**Receipts:** per sale, AR/EN, with a sequential number, shareable as a WhatsApp link. Numbering and tax fields fit JoFotara if the mandate applies. |
| DB/API | `payment_methods(shop_id, code, name_en, name_ar, kind, cliq_alias, is_active, sort)`. `products(id, shop_id, name_en, name_ar, price, sku, track_stock bool default false)`, with no stock management. `sales(id, shop_id, client_id, appointment_id, status draft/part_paid/paid/voided/refunded, subtotal, discount_total, tax_total, tip_total, total, receipt_no, created_by)`. `sale_items` (`kind service/product/custom`, `tax_rate`, `tax_amount`). `sale_payments`, `sale_tips`, `receipt_sequences`. `complete_appointment_sale` is rewritten to write `sales`, and `daily_sales` is kept as a view. The payment-method CHECK constraints are dropped in favour of an FK. |
| Acceptance | Receipt numbers have no gaps per shop under concurrency. Split payments must sum exactly to the total. Tax lines on receipts reconcile with the sale totals to the fils. Old analytics numbers match before and after the migration on the backup. Hijri presets resolve to the correct Gregorian dates for 1448. The QA gates pass. |
| Dependencies | P0, P0V, 1D (`appointment_services`). |

##### WS-1G · Business sign-up and onboarding wizard (M)
Owns `src/app/[locale]/start/**`, `src/lib/templates/barbershop.ts` and migration block `...002600`.

| Item | Details |
|---|---|
| User story | As a new barbershop owner on my phone, I create a bookable shop in under 10 minutes. |
| Scope | Phone-first owner sign-up, then these steps:<br>1. Shop name AR/EN.<br>2. Location pin, area and landmark.<br>3. Services from a barbershop template: EN/AR presets such as حلاقة، تحديد، دقن، سشوار and ماسك أسود, with editable JOD prices and durations.<br>4. Barbers (name and photo).<br>5. Hours, with Saturday start and a Friday Jumu'ah preset.<br>6. Publish.<br>The wizard ends on the share screen (booking link and QR from 1H, stubbed until it lands). Progress is resumable. The wizard hands off to the 1A checklist for photos and amenities. |
| DB/API | `create_shop_from_wizard(payload jsonb)`, transactional and creating the organization, shop, services, barbers and hours. `onboarding_progress(shop_id, step, data jsonb)`. |
| Acceptance | A new owner reaches a published, bookable shop in ≤10 minutes on a 375px phone in both `ar` and `en`. A partial wizard resumes after a refresh. No orphan rows remain on abandon. The QA gates pass. |
| Dependencies | P0, P0V. 1A and 1D field shapes (null-safe). |

#### Phase 1b (weeks 2–4): 1B, 1C, 1E, 1H, 1I, 1J, 1K in parallel

##### WS-1B · Consumer home and search (L)
Owns:
- `src/app/[locale]/page.tsx` (consumer home)
- `src/app/[locale]/explore/**`
- `src/app/[locale]/for-business/**` (the current landing moves here, and `/landing` 301-redirects)
- `src/lib/search/**`
- migration block `...002100`

| Item | Details |
|---|---|
| User story | As a client in Amman, I type "fade" or a barber's name, pick a time and area, and see bookable shops near me with prices and the next free slot. |
| Scope | **Home:**<br>• an Arabic-first hero<br>• a collapsed three-part search: service/shop/barber, area or near me, and Now/Today/Tomorrow/Pick date plus a time window<br>• a "booked today in Amman" counter<br>• category tiles<br>• a "Book again" rail when logged in<br>• a recent-reviews carousel<br>• a stats band<br>• a business CTA<br>• a PWA install prompt<br>**Results:** Shops and Barbers tabs. Sort by Recommended, Nearest, Top rated or Lowest price.<br>**Filters:** Open now, Available today, price range, Kids, Home service, Parking, Pays by CliQ/card, men's/women's. Filters show as chips with a Clear all.<br>**Map:** split list and map (MapLibre GL) on desktop, and a Map/List pill on mobile. Pins show "from X JD".<br>**Cards:** cover, rating, area, distance chip, 3 matching services, "See all N", next slot and badges.<br>**Location fallback:** geolocation, then the last-used city, then Amman, then a neighbourhood picker. |
| DB/API | `search_shops(q, area_id, lat, lng, radius_km, date, time_from, time_to, sort, filters jsonb, limit, offset)` and `search_barbers(...)`. Both are rate-limited, filter on `is_published AND marketplace_visible`, and call P0V `next_available_slot` without redefining it. Filter sources:<br>• Kids and Parking come from `shop_amenities` (1A).<br>• Pays by CliQ/card comes from `payment_methods` (1F).<br>• Home service comes from `services.location_type` (1D).<br>`public_stats(city_id)` returns aggregates only. Recommended score = text match + distance decay + rating × log(volume) + availability today + completeness + verified. Shops with no active services or no hours are excluded automatically. |
| Acceptance | p95 search <400ms on 500 seeded shops. The URL round-trips state. A search with no input returns results. Arabic queries match synonyms (دقن → beard). Keyboard and screen-reader accessible. No layout shift when switching to the map. The QA gates pass. |
| Dependencies | P0, P0V, 1A (photos, amenities), 1D (`location_type`), 1F (`payment_methods`). Until 1A lands, cards fall back to the existing initials cover. |

##### WS-1C · WhatsApp/SMS messaging engine and magic links (L) *(needs external account, see §5)*
Owns:
- `src/lib/messaging/**`
- `src/app/api/messaging/**` (webhooks)
- `src/app/[locale]/m/[token]/**` (manage page)
- `supabase/functions/dispatch-messages/**`
- migration block `...002200`

**1C does not modify `create_public_booking`.** It only adds triggers and exposes `enqueue_message()`.

| Item | Details |
|---|---|
| User story | As a client, I get a WhatsApp in my language from "Ahmad's Barbershop" confirming my booking and reminding me 24h and 2h before, and I can confirm, reschedule or cancel without logging in. |
| Scope | **Day 1:** draft the AR/EN utility and authentication templates for the owner to submit to Meta.<br>**Outbox:** an outbox pattern in which AFTER triggers on appointment insert or status change set `manage_token` and enqueue messages. Reminders are scheduled.<br>**Dispatcher:** a Supabase cron Edge Function runs every minute. It sends through the provider adapter (`whatsapp-cloud`, `sms-provider`, and a `noop`/`wa.me` fallback when no credentials are set). It enforces:<br>• **quiet hours** (no reminders 23:00–08:00 Asia/Amman or during the Friday Jumu'ah window; such sends are deferred)<br>• the **WhatsApp 24-hour session rule** (approved templates outside the session, free-form only inside it)<br>• an **opt-out keyword** (STOP / إلغاء sets the consent to false and sends a single confirmation)<br>• per-shop **monthly cost tracking** against the plan allowance<br>**Templates:** confirmation, reminder, rescheduled, cancelled, thank-you with review link, and waitlist offer.<br>**Manage page** `/m/[token]`: view, add to calendar via .ics and Google, directions, reschedule (calls the 1D RPC), and cancel with the policy shown.<br>**Webhooks:** the inbound button webhook maps Confirm to the existing status `confirmed`.<br>**Shop settings:** reminder offsets and channels. |
| DB/API | `message_outbox(id, shop_id, appointment_id, recipient_profile_id null, channel, template, template_version, category utility/auth/marketing, locale, payload jsonb, scheduled_for, status, attempts, provider_msg_id, cost_fils, error)`. `appointments.manage_token` (random, indexed). `shops.reminder_offsets int[] default {1440,120}`, `shops.quiet_hours jsonb`. `marketing_consents(client_id, shop_id, channel, opted_in, source, updated_at)`. `clients.preferred_language`. `message_cost_monthly` view. RPCs: `enqueue_message`, `get_booking_by_token`, `cancel_by_token`, `reschedule_by_token`. The token RPCs are rate-limited and phone numbers are masked in logs. |
| Acceptance | **Idempotent:** a retry never sends twice (unique on appointment + template + offset). **Quiet hours:** a reminder due at 23:30 goes out at 08:00. **Opt-out:** STOP or إلغاء stops further non-transactional sends within one message. **Fallback:** messages fall back to SMS on WhatsApp failure when enabled. **Manage page:** works logged out and is rate-limited. Delivery status and the month's cost are visible in the dashboard. **No keys:** the system degrades to wa.me deep links and nothing crashes. The QA gates pass. |
| Dependencies | P0. Must merge after 1D, because the triggers read `appointment_services`. Independent of the UI workstreams. |

##### WS-1E · Calendar v2, prayer blocks and front desk (L)
Owns:
- `src/components/calendar/**`
- `(dashboard)/calendar/**`
- `(dashboard)/queue/**` (new)
- `src/lib/prayer/**`
- migration block `...002400`

| Item | Details |
|---|---|
| User story | As an owner or receptionist, I see the week across all barbers, drag a booking to move it, have prayer times blocked automatically, and run walk-ins from a live queue. |
| Scope | **Views:** a range switcher (Day / 3-Day / Week as a staff × days grid / Month density), N-week jump chips, Saturday week start, an optional Hijri date display, and a mobile vertical day view with barber swipe. A team selector (Scheduled team / All / custom) and drag-to-reorder of columns. Cards show barber colour and avatar (1A) and services (1D `appointment_services`).<br>**Creating:** a slot popover (Appointment / Walk-in now / Block time) and a FAB.<br>**Drag and drop:** pointer and long-press drag across time and lanes, plus resizing from the bottom edge. A confirm dialog shows conflicts from P0V `is_slot_bookable`, and offers "Notify client on WhatsApp" when the time changed.<br>**Blocked time:** a UI over P0V `blocked_times` with types (Prayer/Jumu'ah, Lunch, Admin) and repeats.<br>**Prayer blocks:** per-shop rules set which prayers to block, for how many minutes, and how long Jumu'ah lasts. A nightly generator writes `blocked_times` (`source=prayer`) for the next 14 days from `prayer_time_cache`, computed with the method confirmed in §3.<br>**Statuses:** a status pill using the P0 statuses `arrived` / `in_chair`, with time guards (no-show only after the start time, and no-show can be undone). Colour source can be barber, category or status.<br>**Walk-in queue:** check-in, a live estimated wait computed from remaining appointments, assignment to the next free barber via `pick_any_barber`, and an optional TV view at `/queue/display`. Walk-ins can be saved without a name. |
| DB/API | `prayer_time_cache(city_id, date, fajr, dhuhr, asr, maghrib, isha, method)`. `prayer_block_rules(shop_id, prayer, minutes, enabled, jumuah_minutes)`. `generate_prayer_blocks()` runs on cron. New `appointments` columns: `arrived_at, started_at`. `appointments.client_name` becomes nullable. New `barbers` columns: `calendar_order, calendar_color`. `walk_in_queue(id, shop_id, client_name null, phone, service_ids, preferred_barber_id, status waiting/serving/done/left, checked_in_at, started_at)`. **This WS does not redefine `get_busy_slots` / `barber_is_working` and does not touch the status CHECK.** |
| Acceptance | Prayer blocks match the published Amman timetable within ±2 minutes for 30 sampled days. Dragging works with mouse, touch and keyboard (an arrow-key move mode). The DB exclusion constraint still prevents double-booking. Blocks hide online slots unless `allow_online` is set. Queue wait estimates are within ±5 minutes on a seeded scenario. The week view renders 6 barbers × 7 days in <200ms. RTL drag goes in the mirrored direction. The QA gates pass. |
| Dependencies | P0, P0V, 1A (barber colours and avatars), 1D (`appointment_services`). The Notify action calls the 1C `enqueue_message()` and uses a stub if 1C has not landed. |

##### WS-1H · Booking links, QR and social entry points (S–M)
Owns `src/app/[locale]/b/**`, `(dashboard)/settings/links/**` and migration block `...002700`.

| Item | Details |
|---|---|
| User story | As an owner, I put one link in my Instagram bio and a QR on my mirror, and clients book with me without seeing other shops. I can see which channel brought each booking. |
| Scope | **Branded booking link** `/b/[slug]`: shop-branded and free of marketplace chrome, with no competitor carousels or "other shops", going straight into the 1D booking flow.<br>**QR posters:** printable AR/EN, A4/A5, as PNG and PDF in Ink & Brass styling.<br>**Website:** a button and an embed snippet.<br>**WhatsApp Business:** a catalogue link and snippet, plus guidance for the Instagram/Facebook "Book" action.<br>**Attribution:** `?src=` values (ig, fb, wa, qr, web, google) feed `appointments.source` and the 2G reports. |
| DB/API | `link_visits(id, shop_id, src, entry, visited_at)` for the funnel. `shops.booking_link_theme`. |
| Acceptance | `/b/[slug]` shows no other shop anywhere in the flow. A QR scan books with `source=qr`. It works for `marketplace_visible=false` shops. The QA gates pass. |
| Dependencies | 1A, 1D. |

##### WS-1I · Platform admin back office (M)
Owns `src/app/admin/**` (not localised, `platform_role` required) and migration block `...002800`.

| Item | Details |
|---|---|
| User story | As Halaqy staff, I verify shops, moderate reported reviews, handle claim disputes and abuse, and help a shop by impersonating it, with every action audited. |
| Scope | **Shops:** a shop list with filters and the verification toggle (`is_verified`).<br>**Reviews:** a review report and moderation queue. 2B removes owner delete, and this is the moderator.<br>**Claims:** a claim-dispute queue (stub until unclaimed listings ship).<br>**Abuse:** suspend a shop and ban a profile or phone.<br>**Support:** read-only impersonation by default and write impersonation with a reason.<br>**Plans:** plan and allowance overrides (§3 pricing). |
| DB/API | `admin_audit_log(id, actor_id, action, target_type, target_id, reason, diff jsonb, created_at)`. `review_reports(id, review_id, reporter_id, reason, status)`. `shops.suspended_at`, `profiles.banned_at`, `banned_phones`. Every admin RPC checks `platform_role` and writes the audit log. |
| Acceptance | A non-admin gets a 404. Every admin write produces an audit row (test). Impersonation is visibly bannered and is logged on start and stop. The QA gates pass. |
| Dependencies | P0. |

##### WS-1J · Customer phone login, account hub and privacy (M)
Owns `src/app/[locale]/customer/**` (excluding favourites), `src/lib/privacy/**` and migration block `...002900`.

| Item | Details |
|---|---|
| User story | As a client, I log in with my phone number and see all my appointments across shops in one place. I control language, digits and notifications, and I can export or delete my data. |
| Scope | Phone-first auth using the same feature-flagged OTP as 1D, with Turnstile and rate limits. A single identity merged across shops, linking every `clients` row with the verified phone. "My appointments" (upcoming and past, across shops). Profile, language and digit preference. Notification settings. **PDPL** (Law No. 24 of 2023) features:<br>• consent records<br>• a data-export RPC (JSON/CSV)<br>• an account-deletion RPC, which anonymises appointment history but keeps sales for accounting<br>• a privacy page in AR/EN |
| DB/API | `profiles.digit_pref, preferred_language`. `client_profile_links(profile_id, client_id)`. `consent_records(profile_id, purpose, granted, source, created_at)`. `export_my_data()`, `delete_my_account()`. |
| Acceptance | A guest booking made earlier attaches to the account after OTP on the same number. Export contains every row tied to the user. Deletion leaves no phone or name in appointments, the message outbox or reviews. The QA gates pass. |
| Dependencies | P0, 1D (OTP lib), 1C (consent table). |

##### WS-1K · Business-side notifications (S–M)
Owns:
- `src/lib/push/**`
- the service worker push handler
- `(dashboard)/settings/notifications/**`
- migration block `...003000`

| Item | Details |
|---|---|
| User story | As a barber working from my phone, I get an alert when a booking is made, cancelled or rescheduled for me. |
| Scope | Web Push for the installed PWA, using self-generated VAPID keys. Events: new, cancelled, rescheduled, walk-in assigned and waitlist filled. WhatsApp to the barber via 1C as a fallback. A PWA install prompt in the dashboard. **iOS web push works only when the PWA is installed to the home screen**, and the prompt explains this. |
| DB/API | `notification_prefs(profile_id, event, channel)`, `push_subscriptions(profile_id, endpoint, keys jsonb, user_agent)`. AFTER triggers on appointments call `notify_staff()`. |
| Acceptance | A booking made online raises a push notification on an installed Android PWA within 10 seconds. With push unavailable, the barber receives WhatsApp if enabled. Preferences are respected per event. The QA gates pass. |
| Dependencies | P0, 1C. |

**Merge order (explicit):**
1. P0
2. P0V
3. 1A
4. 1D
5. 1F
6. 1G
7. Then 1b: 1C (after 1D), 1J, 1K, 1I, 1E (after 1A and 1D), 1H (after 1A and 1D), and 1B last (after P0V, 1A, 1D and 1F).

**Phase 1 exit criteria:**
- **Findable:** a published Amman shop is created through the wizard in ≤10 minutes and is findable by area, service or barber name. It is also reachable through its `/b/[slug]` link and QR.
- **Bookable:** in ≤4 taps, with OTP where a provider is configured. Otherwise as a guest, with rate limits and Turnstile.
- **Messaged:** sends a confirmation and reminders on WhatsApp where Meta approval exists. **Otherwise the wa.me fallback is accepted.**
- **Barber alerts:** alerts barbers by push.
- **Run day to day:** managed on a week calendar with prayer blocks, a walk-in queue and multi-method checkout including products.
- **QA:** all QA gates are green in both `en` and `ar`.

---

### Phase 2: Parity (~4–5 weeks, up to 8 parallel agents)

| WS | Item | User story / scope | DB/API | Acceptance | Effort | Deps |
|---|---|---|---|---|---|---|
| 2A | **Programmatic SEO and city directory** (owns `src/app/[locale]/barbers/**`, `src/app/sitemap.ts`) | **Launch:** index **city-level pages only**, such as `/[locale]/barbers/[city]` and `/[locale]/[service]/[city]`.<br>**Area pages:** `/[locale]/barbers/[city]/[area]` is indexed automatically once it has ≥3 published, marketplace-visible shops. Before that it is noindex but still linked.<br>**Page content:** an H1 such as "Best barbers in Khalda, Amman", a validated stats line, cards, top barbers, area reviews, a 5-question FAQ with computed answers, and area/city link grids. A "Browse by city" footer. Arabic slugs and hreflang pairs.<br>**Supply:** depends on the ops onboarding of about 50 Amman shops (§3) before area pages matter. | Materialized view `area_stats` refreshed nightly | No page renders a stat that contradicts its own cards (test). No thin pages are indexed. | L | 1A, 1B |
| 2B | **Reviews v2** (owns `src/components/reviews/**`, review dashboard page) | **Display:** a review footer such as "2 weeks ago · Skin fade · with Ahmad" that links to the barber. Separate barber and shop ratings. Quick tags. A yearly "Top rated" tier.<br>**Content:** photo uploads. Public replies from owners or barbers. Report/hide replaces owner delete, with reports going to the 1I queue.<br>**AI summary:** bilingual, marked "Summarised with AI".<br>**Prompt:** a WhatsApp review request 2h after checkout, via 1C. | `reviews.barber_id` (stored, backfilled from appointments), `service_snapshot, photos, tags, status`; `review_replies`; `shops.rating_tier, review_summary_en/ar` | Owners can no longer delete reviews. The summary refreshes weekly and never quotes names. | M | 1C, 1I |
| 2C | **Deals, packages, add-ons** (owns `(dashboard)/marketing/deals/**`, catalog add-on UI) | **Deals:** off-peak, last-minute and flash deals by service, barber and time window. Shown as a strikethrough JD price, a "Deals" pill, a "Quiet hours" slot tag (computed by calling P0V) and a "Deals near you" rail.<br>**Packages:** haircut+beard, father+son, groom, with a savings pill.<br>**Add-ons:** groups (hot towel, black mask, line-up) inline under the service.<br>**Promo codes.** | `promotions`, `service_packages`, `package_items`, `addon_groups`, `addon_options`, `service_addon_groups`; `appointment_services.promotion_id, discount_amount` | The price shown equals the price charged (the server recomputes). Deals never stack unless allowed. | L | 1D, P0V |
| 2D | **Waitlist and favourites** (owns `src/components/waitlist/**`, `customer/favourites/**`) | **Waitlist:** join from a full day, choosing a time range and any or a specific barber. On a cancellation, an offer goes out on WhatsApp with a 15-minute hold, cascading to the next entry. The owner chooses manual or automatic mode. Clients can edit their preferences.<br>**Favourites:** hearts for shops and barbers, plus "Notify me when [barber] is free". | `waitlist_entries`; cancel trigger; writes to P0V **`slot_holds`**, which the availability engine already reads; `favourites(user_id, shop_id null, barber_id null)` | A held slot is invisible to others for 15 minutes, using the P0V test suite. Expiry cascades are tested. | L | 1C, 1D, P0V |
| 2E | **Team, permissions, commissions** (owns `(dashboard)/team/**` excluding shifts, RLS helper migration) | **Staff model:** the canonical model is **`barbers` extended with a nullable `profile_id`**. Staff without a login are `barbers` rows with `profile_id IS NULL`, and staff with a login link a profile. There is no separate `staff_members` table.<br>**RLS migration plan:** (1) add `barbers.profile_id` and backfill it from existing staff profiles; (2) rewrite `is_shop_staff` and the "own calendar" checks to resolve through `barbers.profile_id`; (3) run the existing RLS test suite before and after; (4) remove the profile-only assumptions.<br>**Other scope:** archive with forced reassignment. Receptionist and manager roles with permission flags (hide client phones, own calendar only, refunds, reports, register). Seniority tiers. Commission plans (%, fixed or tiered). Per-barber targets on my-day. | `barbers.profile_id null`; `roles(permissions jsonb)`; `has_permission(text)`; `commission_plans`, `commission_entries`, `staff_targets` | A junior barber's API responses never include client phone numbers (RLS test). Hidden phones are also masked in message logs, CSV/XLSX exports and push payloads. Existing staff keep the same access after the migration. | L | 1F |
| 2F | **Client CRM 360** (owns `(dashboard)/clients/**`) | **Profile:** KPI tiles (visits, average ticket, no-shows, favourite barber, rebook due).<br>**Cut card:** a structured cut card plus a staff-alert badge shown on calendar cards, a list of notes, and an optional **dye allergy / patch-test date** field.<br>**Segments:** tags and dynamic segments (due for a cut 21+ days, lapsed 60+, VIP).<br>**Data:** +962 normalisation and dedupe, CSV import/export (reusing `lead-csv.ts`), merge, and before/after photos. | `client_notes`, `client_tags`, `segments`, `client_media`, `merge_clients()`; `clients.phone_e164 UNIQUE per shop, birthday, dye_patch_test_at, dye_allergy_note` | Importing 1,000 rows with Arabic names round-trips cleanly. A merge moves all appointments, sales and consents. | M | 1F, 1J |
| 2G | **Reports and owner dashboard** (owns `(dashboard)/reports/**`, `(dashboard)/home` KPI tiles) | **Home KPIs:** today's revenue, bookings, occupancy %, no-show rate, rebook rate within N days, new vs returning clients, average ticket and top services.<br>**Per barber:** revenue, utilisation, tips and rating.<br>**Payment mix:** cash, CliQ and card.<br>**Reports:** appointments, cancellations and no-shows; client retention cohorts; booking source (from 1H `?src=`); finance summary; message cost.<br>**Exports:** CSV/XLSX for every table.<br>**Daily summary:** sent to the owner on WhatsApp via 1C. | Materialized views `report_daily_shop` and `report_daily_barber`, refreshed by cron (nightly plus on demand for today) | Totals reconcile with `sales` to the fils. Occupancy uses P0V working minutes. Exports respect 2E phone masking. | M–L | 1F, 1C, 1H |
| 2H | **Automated marketing and blasts** (owns `(dashboard)/marketing/campaigns/**`) | **Automations:** "due for a cut" at 21 days, lapsed at 60 days, birthday, and a win-back offer (linking to 2C promotions).<br>**Blasts:** one-off sends to a 2F segment.<br>**Templates:** WhatsApp **marketing** templates only, which are a separate Meta category, cost more and require opt-in.<br>**Controls:** preview of cost and audience size before sending. Per-shop marketing toggles. | `campaigns`, `campaign_runs`, `automation_rules`; sends via `message_outbox` with `category=marketing` | Only clients with `marketing_consents.opted_in=true` are messaged. STOP or إلغاء opts out within one message. A per-shop monthly send cap applies (from the §3 plan). Quiet hours are respected. | L | 1C, 2F, 2C |

**Also in Phase 2.** Each item is owned by whichever agent picks it up.

| Item | Scope | DB/API | Effort | Deps |
|---|---|---|---|---|
| **Manual CliQ deposits for risky clients** (moved from P3) | Rules flag a client as risky (no-shows ≥ N, new client at peak, or flagged manually). Their booking enters `awaiting_deposit`. The client sees the shop's CliQ alias and QR and uploads a reference or screenshot. Staff confirm. The booking auto-cancels after N hours. No PSP is involved and no money passes through Halaqy. | `deposit_requests(id, appointment_id, amount, reference, proof_path, status, expires_at)`, `shops.deposit_rules jsonb`; cron auto-cancel; availability keeps the slot as booked while awaiting | M | 1D, 1C, 1F |
| **Loyalty stamp card** (moved from P3) | "5th cut free" with a progress bar on the account hub and the receipt. Redemption at checkout. | `loyalty_programs`, `loyalty_ledger` | M | 1F, 1J |
| **Gift cards and memberships sold in-store** for cash or CliQ | Sell, deliver on WhatsApp (including scheduled delivery for Eid), and redeem at checkout. Monthly cut plans with sessions left. Liability report. Online sales stay in P3. | `gift_cards`, `gift_card_ledger`, `membership_plans`, `memberships`, `membership_usage` | L | 1F, 1C |
| **Refunds and voids** | Full and partial refunds, voids with a reason, reversal of commissions and tips, credit notes in the receipt sequence, report adjustments | `sale_refunds`; `sales.status` transitions | M | 1F, 2E |
| **Register open/close** | Opening float, cash in/out, expected vs counted, variance, and a WhatsApp close report to the owner | `registers`, `register_sessions`, `cash_movements` | M | 1F, 1C |
| **Catalog depth** | Per-service online-booking toggle and limits per barber. Service images. Bulk edit, archive instead of delete, reorder and export. UI for processing/blocked time inside a service, such as beard or hair-dye processing, using the P0V columns. | `services.image_url, archived_at`; `barber_services.online_bookable` | M | 1D, P0V |
| **Recurring appointments** | With a per-occurrence conflict preview using `is_slot_bookable` | `appointment_series` | M | 1E, P0V |
| **Tracking pixels and analytics** | Per-shop Meta Pixel and GA4 IDs on the shop and `/b/` pages, gated on consent | `shops.meta_pixel_id, ga4_id` | S | 1A, 1H, 1J |
| **Help and support** | An in-app help centre with AR/EN articles, a "WhatsApp Halaqy support" button, and guidance in empty states | `help_articles` (or MDX) | S | — |
| **Plans, limits and shop billing** | Enforce the §3 tiers (barber count, message allowance), trial countdown, manual invoices paid by CliQ or bank transfer, and admin overrides in 1I | `plans`, `shop_subscriptions`, `usage_counters` | M | 1C, 1I |
| **Unclaimed listings and "Claim this shop"** (moved from P3, **gated on legal review**) | Lower-tier listings with call/WhatsApp contact only. A claim flow verified by phone OTP. Disputes go to the 1I queue. | `shops.is_claimed, source`; `shop_claims` | M | 1I, 1J, legal |
| **JoFotara e-invoice export** (only if §3 confirms the mandate) | Export and submit receipts | `einvoice_submissions` | M | 1F, credentials |

---

### Phase 3: Beyond parity (~4+ weeks)

| Item | Scope | Effort | Deps / external |
|---|---|---|---|
| Group bookings | For a father with his kids or a groom's party. Sequential slots with the same barber or parallel slots across barbers, with one organiser, group reschedule, and reminders to each guest. `appointment_groups`, `appointments.group_id, guest_name`. | L | 1D, 1C, P0V |
| Online gift card and membership sales, wallet tab | Buy online and see a wallet in the account hub. | L | PSP account |
| Online deposits and pay-by-link (phase b) | PSP hosted checkout and webhooks, card on file, no-show fees and digital tips. Replaces the P2 manual CliQ flow where a PSP exists. | XL | PSP account |
| Payroll | Salary + commission + tips − advances (سلفة). Mark paid via cash or CliQ. AR/EN payslips. | L | 2E |
| Multi-branch UI | An "Other branches" carousel, staff working across shops, and org-level reports. The data model is already in P0. | L | 1A, 2G |
| Arabic natural-language search | Maps queries such as "fade tomorrow after 6 in Khalda under 7 JD" to `search_shops` parameters. | M | LLM API key |
| Full products and inventory | Stock levels, suppliers, stock takes and low-stock alerts, extending the P1 `products` table. | L | 1F |
| Resources, ICS feed, Reserve with Google | As described in the gap analysis. | M–L each | Google partner |
| JoFotara export (if not mandated earlier) | As in P2. | M | Credentials |
| Team clock-in, timesheets and team comms | Low priority for barbershops. | M | 2E |

---

## 5. Out of scope until the owner provides external accounts

| Integration | Blocks | What the owner must provide |
|---|---|---|
| **WhatsApp Business Platform (Cloud API)** (day-0 action) | 1C real sends, 1K WhatsApp fallback, 2B review prompts, 2D offers, 2G daily summary, 2H marketing, OTP over WhatsApp | **Meta setup:**<br>• a verified Meta Business Manager<br>• a dedicated phone number not used on the WhatsApp app<br>• a WABA ID, phone number ID and permanent system-user token<br>• display name approval for "Halaqy"<br>• a webhook verify token<br>**Templates:** **utility**, **authentication** and **marketing** templates in AR/EN approved by Meta (the agent drafts them). Marketing templates are a separate, more expensive category and require recorded opt-in.<br>**Commercial:** a budget for per-message pricing in Jordan, and a choice between a direct Meta account and a BSP (360dialog, Twilio, Infobip). |
| **SMS gateway (fallback and OTP)** | SMS fallback, OTP when WhatsApp is unavailable | A provider that can send in Jordan (such as Unifonic, Twilio or Infobip), a registered alphanumeric sender ID "Halaqy" with Jordanian carrier approval, API keys and prepaid credit. Supabase phone auth supports only some SMS providers natively. Others go through the Send-SMS auth hook, which 1D implements. |
| **Bot protection** | Turnstile on guest booking, OTP and login | A Cloudflare Turnstile (or hCaptcha) site key and secret (free). Rate limits work without it. |
| **Error monitoring** | The Sentry QA gate | A Sentry (or equivalent) project DSN (free tier). |
| **Payment gateway** | Online deposits, card capture, no-show fees, **online** gift card and membership sales, digital tips, pay-by-link | A merchant account with a Jordan-licensed PSP (such as HyperPay, PayTabs, Network International/MEPS, or a bank gateway). Commercial registration, a bank account in JOD, sandbox and live keys, a webhook secret, and an Apple Pay merchant ID if wanted. A decision on whether Halaqy is the merchant of record or each shop onboards individually. **Until then:** in-store gift cards, memberships and loyalty (P2) and manual CliQ deposits (P2) work without a gateway, and no money passes through Halaqy. |
| **CliQ** | Automatic reconciliation only (manual confirmation works without it) | Each shop's CliQ alias. Bank API access, needed only for automatic matching. |
| **Reserve with Google** | "Book" on Google Maps | A Google Actions Center partner application, which needs volume and a feed/booking-server integration. Meanwhile each shop pastes its `/b/[slug]` link into its Google Business Profile. |
| **Maps** | Map tiles and static maps at scale | A MapTiler or Mapbox key (the free tier is fine at launch). Geocoding is optional because owners drop a pin. |
| **JoFotara (ISTD e-invoicing)** | Compliant tax invoices | Confirmation of the mandate (§3), plus each shop's tax number and JoFotara client ID and secret. Halaqy builds the export. |
| **LLM API** | AI review summaries, natural-language search | An API key and a monthly budget cap. |
| **Legal** | PDPL compliance (P1), marketing consent (P1/P2), unclaimed listings (P2) | AR/EN Terms and Privacy updates aligned with Jordan's Personal Data Protection Law (No. 24 of 2023). Counsel review of consent wording and of listing public business data. |

---

## 6. Explicitly deprioritised

- **Client forms, consultations, allergies and patch tests** are deprioritised for barbers. The one exception is the optional "dye allergy / patch test date" field on the client card (2F).
- **Team clock-in, timesheets and team comms** move to P3 (low).
- **Resources (chairs/rooms)** move to P3 (low).
- **Full inventory** moves to P3. P1 supports products only as checkout lines.

---

## 7. Feature parity matrix

"Not documented" means the research did not verify whether Fresha offers the feature. It is not a claim that Halaqy beats Fresha.

| Feature | Fresha | Halaqy now | Target |
|---|---|---|---|
| Consumer search-first home + live counter | Yes | Missing (B2B landing) | P1 (1B) |
| 3-part search (service, location, time), URL state | Yes | Partial (text only, client-side) | P1 (1B) |
| Venues/Professionals tabs, barber profiles | Yes | Missing | P1 (1A, 1B) |
| Map/list, near me | Yes | Missing (no geo) | P1 (1B) |
| Filters and sort | Yes | Missing | P1 (1B) |
| Rich result cards, next slot | Partial (no next slot) | Partial | P1 (1B) |
| Recommended ranking, auto-unlist, publish gate | Yes | Missing | P1 (1A, 1B) |
| Marketplace listing vs link-only control | Not documented | Missing | P1 (P0, 1A) |
| Business sign-up / onboarding wizard | Yes | Missing | P1 (1G) |
| Booking links, QR, social "Book" entry points | Yes | Missing | P1 (1H) |
| Category taxonomy and tiles | Yes | Missing | P0/P1 |
| Programmatic SEO pages, city directory | Yes (glitchy) | Missing | P2 (2A, city-level first) |
| Arabic/RTL | Partial | **Better** | Maintain |
| Venue photo gallery | Yes | Missing | P1 (1A) |
| Static map + directions (Waze) | Google only | Partial | P1 (1A) |
| Amenities and trust badges | Yes | Missing | P1 (1A) |
| Opening hours, special/holiday hours | Yes | Partial (no overrides) | P1 (P0V, 1F), Hijri presets |
| Prayer-time blocks computed daily | Not documented | Missing | P1 (1E) |
| Service categories, price types, variants | Yes | Partial | P1 (1D) |
| Processing time, per-barber service limits, service images | Yes | Missing | P1 data (P0V), P2 UI |
| Packages / add-ons | Yes | Missing | P2 (2C) |
| Deals / off-peak pricing | Yes | Missing | P2 (2C) |
| Portfolio "Book this look" | Yes | Missing | P1 data (1A), P2 polish |
| Verified reviews | Yes | Present | — |
| Review context, photos, replies, tier, AI summary | Yes | Partial | P2 (2B) |
| Review moderation by platform | Yes | Missing | P1 (1I) |
| Multi-service booking | Yes | Present | P1 polish |
| Any-barber + per-barber price/next slot | Yes (no next slot) | Partial | P1 (1D) |
| Slot rules (notice, window, interval, buffer) | Yes | Partial (fixed 14 days) | P1 (P0V, 1D) |
| Guest checkout | **No** (account required) | **Better** (guest) | P1 adds optional OTP |
| Customer phone login, account hub across shops | Yes (email/social) | Partial | P1 (1J) |
| Data export / deletion, consent records | Yes | Missing | P1 (1J), PDPL |
| Deposits / card on file / no-show fees | Yes | Partial (settings only) | P2 manual CliQ, P3 PSP |
| Confirmations and reminders | Yes (one-way, Fresha-branded) | Missing (in-app only) | P1 (1C) |
| Magic-link manage, .ics | Not documented | Missing | P1 (1C) |
| Business-side booking alerts (push) | Yes (app) | In-app only | P1 (1K) |
| Self-service cancel / reschedule | Yes (limits) | Present | P1 atomic + token |
| Waitlist with auto offers | Yes | Missing | P2 (2D) |
| Group bookings | Yes (≤6) | Missing | P3 |
| Favourites (shop + barber) | Shop only | Missing | P2 (2D) |
| Customer hub, rebook | Yes | **Better** (barber nudge) | P1 polish |
| Loyalty | Yes | Missing | P2 |
| Gift cards, memberships | Yes | Missing | P2 in-store, P3 online |
| Tips | Yes | Missing | P1 checkout, P3 online |
| Calendar Day/3-Day/Week/Month | Yes | Partial (day only) | P1 (1E) |
| Multi-day × multi-staff grid | Not documented | Missing | P1 (1E) |
| Drag/drop, resize | Yes | Missing | P1 (1E) |
| Blocked time with types and repeats | Yes | Missing | P1 (P0V, 1E) |
| Shifts, overrides, time off, closures | Yes | Partial | P1 (P0V, 1F) |
| Custom statuses (arrived, in chair) | Yes | Missing | P0 CHECK, P1 (1E) UI |
| Walk-in queue with estimated wait | Not documented | Missing | P1 (1E) |
| Recurring appointments | Yes (no conflict check) | Missing | P2 |
| Resources (chairs/rooms) | Yes | Missing | P3 (low) |
| POS cart, split, discounts | Yes | Partial (cash/card only) | P1 (1F) |
| Product sales at checkout | Yes | Missing | P1 (1F) line items, P3 inventory |
| Custom payment methods (CliQ, wallets) | Yes | Missing | P1 (1F) |
| Receipts with numbering, WhatsApp share | Yes (email) | Partial (daily summary) | P1 (1F) |
| Tax (16% GST) on receipts | Yes | Missing | P1 (1F) |
| Refunds/voids, register close | Yes | Missing | P2 (M each) |
| Reports and owner dashboard | Yes | Minimal | P2 (2G) |
| Automated marketing and blasts | Yes | Missing | P2 (2H) |
| Tracking pixels (Meta, GA4) | Yes | Missing | P2 |
| Help centre / in-app support | Yes | Missing | P2 |
| Roles and permissions | Yes | Partial (admin/barber) | P2 (2E) |
| No-login bookable staff | Yes | Missing | P2 (2E, `barbers.profile_id`) |
| Commissions, pay runs, advances | Yes (advances not documented) | Missing | P2 / P3 |
| Client CRM 360, tags, segments, import/merge | Yes | Partial | P2 (2F) |
| Cut card / staff alerts / dye patch-test date | Generic notes | Partial | P2 (2F) |
| Consultation forms | Yes | Missing | Deprioritised |
| Timesheets, team comms | Yes | Missing | P3 (low) |
| Platform admin / moderation / audit | Internal | Missing | P1 (1I) |
| Plans, trial, usage limits | Yes | Missing | §3 decision, P2 enforcement |
| Multi-branch | Yes | Missing | P0 data model, P3 UI |
| Unclaimed listings / claim | Yes | Missing | P2 (legal-gated) |
| Reserve with Google | Yes | Missing | P3 (external) |
| AI natural-language search | Via Claude integration | Missing | P3 |
| JoFotara e-invoicing | Not documented | Missing | P2 if mandated, else P3 |

---

**Parallelisation summary:**
- **Phase 0** takes 2 agents for about 3 days:
  - WS-P0 for primitives, data spine and QA harness
  - WS-P0V for the availability engine, the sole owner of slot logic
- **Phase 1a** runs 4 agents (1A, 1D, 1F, 1G) for about 2 weeks.
- **Phase 1b** runs 7 agents (1B, 1C, 1E, 1H, 1I, 1J, 1K) for weeks 2–4, overlapping with the end of 1a through stubs.
- **Phase 1 in total** takes 3–4 weeks, integration included.
- **Migration blocks:** `...001900`, `...001950`, then `...002000` to `...003000`.
- **Cross-workstream calls:**
  - Every WS calls P0V for availability and never redefines it.
  - 1D alone defines `create_public_booking`.
  - 1C exposes only triggers and `enqueue_message()`, which 1E, 1F, 1K and the P2 workstreams call through stubs until 1C merges.
  - 1D reads 1A's barber fields with null-safe fallbacks.
  - Only P0 changes the status CHECK.
- **Merge order:**
  1. P0
  2. P0V
  3. 1A
  4. 1D
  5. 1F
  6. 1G
  7. 1C
  8. 1J
  9. 1K
  10. 1I
  11. 1E
  12. 1H
  13. 1B
- **Phase 2** runs 8 agents (2A–2H) plus the additional P2 items after Phase 1 merges. 2A area pages wait on supply onboarding, and 2H waits on 2F and 2C.
