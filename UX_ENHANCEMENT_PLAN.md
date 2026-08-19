# Halaqy (7ala8i) — UX Enhancement Plan

*Scope note: this plan is exclusively about how the product feels to use — trust, clarity, responsiveness, language, and flow. Functional completeness (wiring dead CRUD, fixing broken queries as a correctness matter) lives in [PLAN.md](PLAN.md); where a bug also happens to be a UX failure — a dead button, a fake number, a broken confirmation — it's covered here because the *experience* of hitting it is the point, not the code defect itself.*

Produced from a full-codebase audit (9 parallel reviews covering booking, customer portal, dashboard shell/calendar, clients/leads/analytics, services/settings/team, auth/landing, and the shared design system/RTL/i18n layer), synthesized and then cross-checked for gaps. **111 findings total: 21 critical, 36 high, 41 medium, 13 low.**

---

## Current State — What's Actually Undermining the Experience

Reading across all 111 findings, the problems cluster into six root causes. None of these are "needs more polish" problems — they are structural, and they compound each other.

**1. Fabricated data presented as real, everywhere.** This is the single most damaging pattern for a pay-in-shop product where trust *is* the entire transaction — there's no payment receipt to fall back on as proof something worked. The booking landing screen shows a hardcoded `4.8 (127 reviews)` for every shop regardless of real data (`booking-engine.tsx`), the Explore grid cycles fake `RATINGS`/`REVIEW_COUNTS` arrays and a fabricated "Open Now" badge (`explore/page.tsx`), Analytics silently substitutes a fake `68.2%`/`64.1%` retention rate whenever the real number is zero (`analytics-page.ts`), the Daily Goal is hardcoded to `120` for every shop (`metric-cards.tsx`), a brand-new owner's Team settings shows two invented staff members "Omar Al-Fayez" and "Sara Jenkins" (`settings-page.tsx`), Billing shows a fake "Pro Atelier — 25 JOD/month" subscription on a fake Mastercard (`settings-page.tsx`), and the shop's shareable booking link/QR code points to a domain (`halaqy.booking/...`) that doesn't exist and a QR code that's a literal `▦` glyph, not a generated image. A Jordanian owner or customer who notices *one* of these — and several are impossible not to notice (a brand-new shop with a 4.8 rating, a solo owner staring at two strangers listed as their staff) — has no reason to trust any other number on the screen.

**2. Buttons and links that look real and do nothing.** The topbar search bar, the mobile view-switcher icon, both CSV export buttons, "Import CSV" on Leads, the call/WhatsApp buttons on client cards, the Currency/Timezone selectors, the "Data Privacy" link, nine footer links on the landing page, Terms/Privacy links across booking/auth, and the Settings > Team invite button all render as fully-styled, hover-responsive controls that produce zero feedback when tapped. This is worse than a missing feature — a missing feature is invisible, a dead button is a broken promise the user discovers by acting on it.

**3. Confident false confirmations.** The app tells users things succeeded when they didn't: cancelling a booking calls an RPC (`cancel_public_booking`) that was dropped in migration `004_secure_booking_rpc.sql`, yet the customer still sees an "Appointment cancelled" toast; editing a phone number in the customer portal shows "Profile saved!" while the new number is never persisted anywhere (`customer/page.tsx`); optimistic UI updates in the leads store and services hooks apply local-state changes before the server call resolves and never roll back on failure. Combined with almost every `useSupabaseQuery` consumer ignoring the hook's `error` field, a failed request and a genuinely empty result render *identically* — the user cannot tell "nothing happened" from "something broke."

**4. Arabic/RTL treated as a pass applied after the fact, not a design constraint.** This is a majority-Arabic-market product, yet: the shop profile page (the flagship trust page before booking) has zero localization and formats dates as US English; the appointment detail page has no `useTranslation()` at all while still inheriting a mirrored RTL layout; four customer-portal modals (cancel, logout, review, edit profile) are hardcoded English inside an otherwise-Arabic page; and most critically, `useThemeStore`'s `direction`/`locale` state is completely disconnected from the URL-derived locale that actually drives `t.*` strings — nothing in real app code ever calls `setLocale()`, so `theme-provider.tsx` and the dashboard layout repeatedly force `document.documentElement`'s `dir` back to `"ltr"` after every render, even on `/ar/...` routes. The net effect: an Arabic-choosing owner gets Arabic *words* sitting inside a layout that's mechanically still left-to-right — sidebar on the wrong side, dropdowns opening the wrong way, icons unmirrored. This isn't a translation gap, it's a broken direction system.

**5. The same action behaves differently depending on which screen you use.** Marking an appointment paid from the Calendar only updates `status` — no `payment_status`, no `daily_sales` row — while the identical action from the Dashboard table correctly writes both, so revenue collected via the Calendar silently never appears in Today's Sales. There are two independent login pages, two sign-out implementations (one with a toast and correct locale, one without either), two notification bell systems visible simultaneously in the topbar and sidebar, and two "manage my team" surfaces (a working `/team` page and a broken Settings tab) with no indication which is canonical. Every one of these divergences is an invitation for silent data loss.

**6. The exact mobile-first, one-handed, bright-sunlight persona this app targets is where the layout breaks hardest.** The Confirm Booking step — the single highest-stakes screen in the funnel — uses a hardcoded 360px column that never collapses below 640px (`booking-engine.tsx`); the Explore grid and Clients grid both have real CSS media-query rules already written (`.explore-grid`, `.card-grid-4`-style patterns) that are simply never applied to the actual elements; the landing page has no mobile nav collapse at all. These aren't undiscovered problems — the responsive CSS exists in the codebase and just isn't wired up, which suggests the mobile pass was written once and then quietly detached from the markup during later edits.

**A seventh, subtler pattern** worth calling out on its own: some actions are wired to *real, working* code paths that are simply pointed at the wrong target. Tapping "Reschedule" creates a brand-new appointment while leaving the original one active — a live double-booking risk, not a dead end. The landing page's "Book Demo" button queries the real `shops` table (`.limit(1).single()`) and can drop a prospective customer straight into an arbitrary live shop's real booking flow. Neither is a dead button or a fabricated number — they're easy to miss in a first pass precisely because they *do* something, just the wrong thing.

---

## Design Principles for This Product

1. **Arabic is not a locale variant of the "real" English app — it's the primary product.** Direction, terminology, and layout must derive from one source of truth (the URL locale segment), never a separately-toggled store. Every new screen ships Arabic-complete or it doesn't ship. Tone matters as much as translation accuracy — a Jordanian barbershop owner should recognize "المحل" (the shop), not "الأتيليه" (a French couture loanword currently hardcoded into the topbar).

2. **Every number, badge, and status the user sees must be real or absent — never invented.** In a cash/card-in-person model with no payment receipt, in-app data *is* the only proof anything happened. A shop with zero reviews shows zero reviews, not a placeholder 4.8. A metric that can't be computed yet shows "—", never a plausible-looking fallback constant.

3. **The app has to beat "just send a WhatsApp message," not merely function.** That's the actual competitor a Jordanian user is mentally comparing every screen against. Every extra tap, every locale bounce, every dead-end after filling out a form is a moment where WhatsApp wins by comparison. Booking should be provably faster and more reliable than a DM — with no exceptions on the happy path.

4. **Confirmation is a feature, not an afterthought.** Because there's no payment gateway to implicitly confirm a transaction, the in-app "success" moment (toast, screen, badge) carries all the weight a receipt would elsewhere. That moment must never fire unless the write actually succeeded server-side, and it should be visually and tonally consistent everywhere (no native `alert()`/`confirm()` breaking an otherwise custom-styled flow).

5. **Design for a thumb, a bright sidewalk, and a spotty connection — not a designer's laptop.** Touch targets at or above ~44px, status legible at a glance without reading every label, resilient to slow/failed requests with visible retry affordances, and conservative with mobile data (no unbounded queries, no needlessly repeated stock imagery).

6. **One canonical implementation per user-facing action.** Two login pages, two sign-out flows, two "mark as paid" code paths, two team-management surfaces — every fork is a place where behavior silently diverges and half the forks quietly rot. Before adding a new surface for an existing action, delete or redirect the old one.

---

## Prioritized Roadmap

### Tier 0 — Fix Trust & Dead Ends (days, do first)

**Cross-cutting (do this first — it undoes dozens of individual symptoms at once)**
- Set a `NEXT_LOCALE` cookie whenever the user is on an `/ar/` or `/en/` route, and audit/fix every unprefixed internal `href`/`router.push`/`redirect` across booking, customer portal, dashboard, and auth. *Rationale: this one gap is why nearly every "bounces to English" finding exists — it's one fix, not thirty.*
- Delete `direction`/`locale`/`setLocale` from `theme-store.ts`; make the URL locale the single source of truth for `dir`/`lang` in `theme-provider.tsx` and the dashboard layout. *Rationale: currently forces the whole dashboard back to LTR on every render regardless of chosen language — the most severe RTL bug in the app.*

**Booking & discovery (guest funnel)**
- Decide and implement one real policy for guest checkout in `src/app/api/booking/route.ts` — either true guest booking or an honest pre-effort login gate with selections preserved. *Rationale: guests currently complete the entire 4-step form and get a silent 401 at the final tap.*
- Apply the already-written `.booking-two-col` responsive class to the Confirm step grid in `booking-engine.tsx`. *Rationale: the highest-stakes screen in the funnel is unusable on a real Android viewport today.*
- Remove the hardcoded `4.8 (127 reviews)` on the booking landing card; show real data or nothing. *Rationale: directly contradicts the real rating a guest may have just seen on the shop profile.*
- Remove the fabricated `RATINGS`/`REVIEW_COUNTS` arrays and fake "Open Now" badge in `explore/page.tsx`; show real data or nothing. *Rationale: same trust problem as the booking-landing rating fix, and visible even earlier — before a guest has picked a shop at all.*
- Relabel "Reschedule" honestly as "Book a new time" and prompt the customer to confirm the original gets cancelled, as an interim fix until the atomic reschedule flow (Tier 2) replaces it. *Rationale: today it silently creates a duplicate booking while leaving the old one active — a live double-booking/no-show risk for both customer and shop, not merely a missing feature.*

**Customer portal**
- Repoint cancel calls to `cancel_customer_booking` (the RPC that actually exists) in `customer/page.tsx`, `customer/[appointment_id]/page.tsx`, and `api/booking/cancel/route.ts`; delete the client-side fallback `.update()` that can never succeed under RLS. *Rationale: customers currently get a confident "cancelled" toast for a cancellation that never happened server-side.*
- Stop showing "Profile saved!" for the phone field in `handleSaveProfile` until it's actually persisted. *Rationale: phone is the shop's primary contact channel — silently reverting it breaks real-world communication.*

**Dashboard & Calendar (owner/barber daily ops)**
- Add real handling to `getDashboardMetrics` for `shops.daily_goal` instead of the hardcoded `120` in `metric-cards.tsx`. *Rationale: every shop currently sees a goal that isn't theirs, including false "goal met" confetti.*
- Unify "mark as paid" between the Calendar tooltip and the Dashboard table so both write `payment_status`/`payment_method`/`daily_sales` consistently. *Rationale: revenue closed out via the Calendar currently vanishes from Today's Sales entirely.*
- Wire or remove the topbar search bar and the mobile view-switcher icon (`topbar.tsx`) — currently fully-styled and inert. *Rationale: a dead search box reads as a broken app the first time anyone uses it.*
- Wire or remove the two CSV/PDF export buttons on Daily Summary (`daily-receipt.tsx`). *Rationale: same dead-button problem at end-of-day, the moment an owner most wants a record.*

**Clients / Leads / Analytics**
- Wire the call icon, WhatsApp button, and New Booking button on client cards/drawer to real `tel:`/`wa.me` links (`clients/page.tsx`). *Rationale: this is the literal core value proposition of a barbershop CRM in a WhatsApp-native market, currently five decorative buttons.*
- Remove the `Math.min(100, currRet || 68.2)` fallback pattern in `analytics-page.ts`; show "—" when there's no real data instead of a fabricated 68.2%/64.1%. *Rationale: hidden inside otherwise-live analytics, this is the most deceptive fake-data instance in the app.*
- Stop discarding the Leads email field after a successful-looking save toast — persist it or remove the field. *Rationale: same false-confirmation pattern as the customer-portal phone bug above; the toast confirms a write that silently drops data.*

**Settings / Team**
- Remove the hardcoded fallback team members `[Omar Al-Fayez, Sara Jenkins]` in `settings-page.tsx`; show a real empty state. *Rationale: a first-time owner's very first look at Team shows two strangers as their staff.*
- Replace the Billing tab's fabricated subscription/card/invoices with an honest "Coming Soon" placeholder, or remove the tab — it directly contradicts the stated pay-in-shop-only model. *Rationale: an owner could reasonably panic about an unauthorized recurring charge that doesn't exist.*
- Generate the shop's booking link from the real route (`/{locale}/shop/{shop_id}`) and render an actual generated QR code; wire the download button. *Rationale: this is the artifact owners are meant to print/WhatsApp to customers — right now it points nowhere and encodes nothing.*
- Fix or remove the Settings > Team invite form (uncontrolled input, no `onClick` at all) — currently gives zero feedback of any kind. *Rationale: worse than the Team page's fake-toast version — no signal the app even registered the tap.*
- Replace the Team page's `handleInvite` fake-success toast with an honest "Coming soon" until a real invites pipeline (DB table + email/SMS delivery) exists. *Rationale: currently indistinguishable from a working invite — an owner will tell a barber "I sent it" and nothing was ever sent.*
- Stop seeding Settings > General with placeholder contact info (`hello@halaqy.com`, a fake WhatsApp number) that silently overwrites the shop's real details the next time the owner saves anything else on that form. *Rationale: same confident-false-save pattern as the other Tier 0 fakes — this one can actively destroy a real phone number.*
- Remove the decorative Currency/Timezone selectors and the "Data Privacy" dead link until they're real. *Rationale: sitting beside genuinely-working Save controls, these read as broken, not unbuilt.*

**Auth / Landing**
- Delete the duplicate legacy `src/app/[locale]/login/page.tsx`; replace with the same thin redirect stub already used for `/signup`. *Rationale: a stale, English-only, fake-forgot-password page that shouldn't be reachable at all.*
- Fix or remove the nine dead footer links and the fabricated "1,284 Bookings / 4.9 Rating" hero stat on the landing page. *Rationale: this is a pre-launch product; a skeptical owner discovering fake social proof taints the whole pitch.*
- Point the landing page's "Book Demo" CTA at a seeded fixture/demo shop instead of `.limit(1).single()` off the live `shops` table. *Rationale: today it can drop a prospective customer straight into a real tenant's live booking flow — the same wrong-target problem as the reschedule bug above.*

### Tier 1 — High-Impact UX Upgrades (1–3 weeks)

**Booking flow correctness & confidence**
- Distinguish "no working_hours configured" from "explicitly closed today" in `availableTimes` (`booking-engine.tsx`) so a shop's actual day off doesn't render a full grid of fake "Free" slots.
- Filter out past-time slots for same-day bookings, and disable/label slots where the selected services' duration would run past closing.
- Filter barbers by actual service capability (`barber_services`) instead of showing every barber as a generic "Master Barber" for every service.
- Surface each step's query `error` with a retry action instead of rendering an empty state indistinguishable from "this shop has no barbers yet."
- Add inline phone-format validation on the Confirm step instead of relying solely on a generic post-submit error banner.
- Fix the triple-stacked de-emphasis (opacity + strikethrough + faint color) on unavailable time slots so they're legible in outdoor daylight.
- Wire up the already-defined `t.booking.*` i18n keys across the whole flow (landing feature bullets, section labels, summary card, success screen, legal text) — currently hardcoded English regardless of locale, distinct from the rating/layout bugs above.

**Shop profile & discovery**
- Route the shop profile page (`shop/[shop_id]/page.tsx`) through `useTranslation()` and locale-aware date formatting — currently 100% English regardless of locale.
- Replace the fixed stock-photo array with real per-shop/service images (or an explicitly-labeled placeholder), and add `.limit()` to the unbounded reviews query.
- Apply the already-written `.explore-grid` responsive class so the shop-discovery grid actually collapses on mobile.

**Customer portal cohesion**
- Add a durable `client_id`↔auth-user link at signup/first-login (rather than fuzzy name/phone/email matching) so returning customers don't see an empty history purely from a formatting mismatch.
- Localize all four customer-portal modals (cancel, logout, review, edit profile) and the entire appointment-detail page — currently islands of hardcoded English inside an Arabic experience.
- Fix the Past-tab badge to never show "Upcoming" for a lapsed appointment.
- Replace native `alert()`/`confirm()` on the detail page with the same styled toast/modal system used on the dashboard.
- Resolve or remove the dead-alias routes `/customer/bookings`, `/customer/profile`, and the unbranded redirect stub at `/customer/shops/[shopId]`.

**Dashboard & Calendar**
- Add an explicit "Unassigned / Any Barber" lane to the Timeline view so bookings made via the first-class "Any Barber" option don't silently disappear from the barber's day.
- Build a real, shop-scoped "add walk-in" action instead of routing "+ New Booking" to the anonymous public `/book` flow (which can resolve to an arbitrary shop).
- Consolidate the two simultaneous notification-bell systems (topbar inline dropdown vs. sidebar's `NotificationBell`) into one.
- Filter `workspace-store.ts`'s barbers list to `role = 'barber'` so shop admins don't appear as empty, permanently-selectable lanes.
- Align the sidebar's CSS breakpoint (768px) with its Tailwind `lg:` visibility breakpoint (1024px) to close the dead-zone gap on tablets.
- Surface real error states (not silent, empty-looking renders) across MetricCards, SalesChart, DailyReceipt, and TimelineView when their Supabase queries fail — a failed request and a genuinely quiet day currently look identical.
- Add a real cash/card payment-method picker to Daily Summary instead of hardcoding every payment as `"cash"` (`daily-receipt.tsx`) — distinct from the Tier 0 fix that only unifies *where* payment status gets written, not *what* method gets recorded.

**Clients / Leads / Analytics**
- Escape/parameterize the client search filter (raw commas/parentheses in a pasted phone number currently break the query and silently show "No clients yet"); debounce the input.
- Read the real `count` from the clients query so "Next" can't page past the last result into a false empty state.
- Make the clients grid responsive (mirror the `.card-grid-4` pattern already used on Analytics) instead of a rigid 4-column inline style.
- Wire "Import CSV" on Leads to the store's already-built (and tested) `importLeads` action, or hide the button.
- Add a confirm step before single and bulk lead deletion — currently one mis-tap permanently deletes.
- Add error handling + rollback to every Leads store write (`moveLead`, `addLead`, `updateLead`, `deleteLead`) so a dropped mobile-data request doesn't silently revert on next load with no explanation.
- Relabel the Peak Hours heatmap's four buckets as ranges ("9–12", "12–3"...) since that's what the underlying grouping actually computes.

**Services / Team**
- Add the missing `services` i18n namespace to `en.ts`/`ar.ts` — currently every label on the Services setup page silently falls back to English regardless of locale.
- Persist service drag-reorder via a real `position` column instead of discarding it on next load.
- Surface Supabase errors via the existing `toast()` pattern for all Services CRUD, and roll back optimistic state on failure.
- Add a "Remove from team" / deactivate action for departed staff — currently no way to revoke a former employee's access.

**Auth & Landing**
- Localize `forgot-password` and `reset-password` — currently 100% English while still inheriting RTL mirroring.
- Add a mobile hamburger nav to the landing page — the current nav row has no collapse behavior at all.
- Surface the `?error=auth_callback_error` query param on login with an actionable message (expired confirmation link) instead of dropping it silently.
- Unify the password minimum (pick 8, matching what's already displayed) across signup validation, signup copy, and reset-password.
- Add a confirm-password field to signup, matching the pattern already built for reset-password.
- Make the Terms of Service / Privacy Policy links on auth and booking screens go to real pages instead of dead links — a data-protection visibility gap, not just a broken link, for a product handling names and phone numbers.
- Hide or gate the landing page's "Dashboard / Calendar / Leads" nav links for logged-out visitors — right now they dead-end at a login wall, reading as a broken link on first click.

**Shared design system**
- Define `--glass-bg-elevated` (or drop the blur/undefined-variable pattern entirely) — every toast in the app currently renders with a functionally invisible background.
- Raise `GlassButton`'s `sm`/`md` heights and `ConfirmDialog`'s button height to the same ~44px minimum already enforced elsewhere, since these are the actual sizes used for real actions in the Calendar, Leads, and destructive confirmations.
- Darken `--border-primary` (currently ~1.1:1 contrast against white) so card/input boundaries survive bright outdoor viewing.
- Give `.badge-upcoming`/`.badge-pending` and `.badge-completed`/`.badge-open` visually distinct colors before this pattern is wired into any real screen.
- Remove the `html { font-size: 14px }` override that shrinks every `rem`-based size in the app to 87.5% of intended.

### Tier 2 — Signature Enhancements (bigger bets)

- **WhatsApp-native confirmations and reminders.** Given the app's own landing copy already leans on WhatsApp sharing, and this market's default channel is WhatsApp not push notifications or email: send booking confirmations, day-before reminders, and cancellation/reschedule links via WhatsApp (`wa.me` deep link at minimum, WhatsApp Business API if available). This directly answers "why not just WhatsApp the shop" by making the app *use* WhatsApp as the notification layer instead of competing with it.
- **A real, atomic reschedule flow.** Replace the Tier 0 interim fix with a proper flow: pass the existing appointment into `/book/{shop_id}`, and cancel/replace the original server-side on successful rebooking — eliminating the double-booking risk entirely rather than just relabeling it honestly.
- **A stripped-down "My Day" mobile view for barbers.** Distinct from the full owner dashboard: large touch targets, swipe-to-complete/no-show, no admin chrome, no navigation the barber doesn't need between clients — built for the exact "glance at phone between cuts" moment this audit repeatedly identifies as the primary use case, rather than shrinking the owner's dashboard down.
- **Trust-building that doesn't depend on payment.** Real, verified rating aggregates surfaced consistently everywhere they currently appear fake (booking landing, Explore, shop profile); a visible cancellation/no-show policy that's actually a real page; shop response-time or reliability signals sourced from real completion/no-show rates instead of a decorative "Open Now" pulse.
- **Loyalty and rebooking nudges.** A one-tap "Book again with [barber] — same service" surfaced in the customer portal based on real appointment cadence (e.g. "usually every 3 weeks, due soon"), which both increases repeat bookings and gives the retention metric something real to measure.
- **A finished, printable booking-link kit.** Once the real link + QR code exist (Tier 0), extend it into a downloadable print-ready card/poster the owner can put on the counter — a concrete, tangible artifact for a business that runs on in-person trust and word of mouth.
- **Working-hours model that accounts for prayer times.** Optional per-shop "prayer buffer" blocks in the working-hours editor (e.g. Dhuhr/Asr/Maghrib short closures) so barbers who close briefly for prayer don't have to manually zero out slots or risk a booking landing mid-closure — a small, market-specific correctness feature that also reads as the product understanding its users.
- **Ship the design system's own unused primitives.** `.badge-*`, `.time-slot`, `.date-pill`, `.shop-card` already exist in `globals.css` fully specified but are used nowhere in real screens — wiring them in everywhere instead of each page hand-rolling its own inline styles would fix the badge-collision and RTL-hardcoding issues once, centrally, and prevent the next screen from reintroducing them.
- **A genuinely useful search.** Once the topbar/clients search dead-buttons are fixed at Tier 0's minimum bar, extend to real fuzzy name/phone matching across clients, leads, and today's appointments from one place — the "quickly find Ahmad's booking" moment this app should own better than scrolling a WhatsApp thread.
- **A real team-invite pipeline.** Once the Tier 0 "Coming soon" honesty fix is in place, build the actual `invites` table + email/SMS delivery + join-by-code flow (already partially scaffolded in `api/invite/accept`) so shop owners can genuinely add barbers without sharing login credentials.

---

## By Journey

| Journey | Single biggest current problem | Highest-leverage fix |
|---|---|---|
| **(a) Guest discovering & booking a shop** | Guest completes the entire 4-step form and is silently rejected at the final tap because the API requires auth that the UI never mentions (`api/booking/route.ts`) | Pick and implement one honest policy: true guest booking, or an upfront login gate before effort is invested |
| **(b) Returning customer managing bookings** | "Cancel" calls a Postgres function that no longer exists, yet the app shows a confident "Appointment cancelled" toast anyway (`customer/page.tsx`) | Repoint every cancel call site to `cancel_customer_booking` and delete the RLS-blocked fallback update that masks the failure |
| **(c) Shop owner's daily glance at the dashboard** | Core reconciliation numbers are partly fabricated (hardcoded `120` daily goal, hardcoded `cash`-only payment split, revenue lost when marked paid via Calendar vs. Dashboard) | Wire real `shops.daily_goal`, read the real `payment_method`, and unify the two "mark as paid" code paths into one |
| **(d) Barber's mobile view of their day** | Appointments booked with the promoted "Any Barber" option (`barber_id: null`) never appear on any barber's Timeline lane — silent data loss | Add an explicit "Unassigned / Any Barber" row to the Timeline grid |
| **(e) New shop owner onboarding/setup** | First-run screens show fabricated data as if real: fake staff (Omar Al-Fayez, Sara Jenkins), a fake Pro Atelier subscription, placeholder contact info, a booking link/QR that resolve to nothing | Replace every fabricated first-run default with a real empty state, and generate the actual booking link + QR code |

---

## What NOT to Do Yet

- **No visual polish or new gradients/glassmorphism before the dead ends are fixed.** The design system's own header comment already states glassmorphism/blur was deliberately turned off as off-spec — don't reintroduce decorative treatments while `--glass-bg-elevated` is undefined and toasts are functionally invisible.
- **Don't build Billing or Invites to production depth yet.** An honest "Coming Soon" placeholder is the correct Tier-0 fix for both; a fully-featured subscription system or invite-email pipeline is a Tier-2-or-later investment that shouldn't block removing the current fabricated versions.
- **Don't patch i18n page-by-page.** The locale-prefix and theme-store desync bugs are systemic; fixing them once at the root (cookie + single source of truth for `dir`) prevents the same class of bug from being re-introduced on the next new page, versus chasing each symptom individually.
- **Don't add more toasts/error banners as a substitute for fixing the underlying plumbing.** Several "silent failure" findings (RLS policy gaps, a renamed RPC, a nonexistent `email` column on `leads`) are wrong at the data layer — better error messaging on top of a broken write still ends in data loss, just with a clearer apology.
- **Don't invent new shared components before reusing the ones already written.** `.badge-*`, `.time-slot`, `.shop-card`, and friends exist fully specified in `globals.css` and are used nowhere — building a second design system on top of an unused first one compounds the drift problem instead of fixing it.
- **Don't chase Tier 2 ideas (WhatsApp integration, loyalty nudges, prayer-time scheduling) while Tier 0 is open.** These are genuine differentiators, but they're built on top of trust and navigation that currently don't hold — a WhatsApp reminder for an appointment that the cancel button can't actually cancel just extends the same bug's blast radius.
