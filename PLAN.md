# Halaqy — Full Project Roadmap

> Generated from comprehensive audit on Mar 11, 2026.
> This plan covers every remaining feature, fix, and enhancement needed.

---

## Phase 0: Critical Fixes (Broken/Non-Functional)

These are bugs and inconsistencies that prevent existing features from working.

### 0.1 — Fix Database Migration Inconsistencies
- [ ] Migration 001 defines `get_user_shop_id()` but 002/003 reference `get_current_shop_id()` — create a consolidated migration that ensures the correct function exists
- [ ] Migration 001 uses `profiles.name` but 003 uses `profiles.full_name` — resolve schema drift
- [ ] `UserRole` type in `src/lib/supabase/types.ts` is missing `"customer"` — add it
- [ ] Create `.env.example` with placeholder keys for onboarding

### 0.2 — Fix Workspace Store Hydration
- [ ] Remove hardcoded `shopId: "shop-001"` and mock barber list from `workspace-store.ts`
- [ ] Default to empty strings/arrays so the store only contains real data after AuthProvider hydrates
- [ ] Ensure all dashboard pages show loading/empty states when store is not yet hydrated

### 0.3 — Fix Leads Store Hydration
- [ ] `hydrateFromSupabase()` is never called because `shopId` starts as `""` — fix the flow so it hydrates after AuthProvider sets the shopId
- [ ] Currently leads always show mock data — switch to real-only after hydration

### 0.4 — Fix Dashboard Upcoming Appointments
- [ ] Currently hardcoded (Tariq, Sami, Nabil) — replace with real Supabase query for today's upcoming appointments

### 0.5 — Fix Landing Page Links
- [ ] "Get Started" → should go to `/auth/signup` not `/`
- [ ] "Book Demo" → should go to `/auth/signup` or a contact form, not `/book` (which needs a shop param)
- [ ] Pricing CTA buttons → wire to `/auth/signup`
- [ ] Footer links → wire to real destinations or remove dead links

---

## Phase 1: Activate Existing But Non-Functional Features

These features have UI elements already built but the functionality behind them doesn't work.

### 1.1 — Sales Chart (Real Data)
- [ ] Replace mock `dailyChartData`, `weeklyChartData`, etc. in `sales-chart.tsx` with Supabase data
- [ ] Query `daily_sales` grouped by day/week/month
- [ ] Period selector (day/week/month/year) should actually filter data

### 1.2 — Dashboard Metrics Change Percentages
- [ ] `todayBookingsChange`, `salesChange`, etc. are always mock values
- [ ] Calculate real percentage changes by comparing current period to previous period

### 1.3 — Analytics Real Data
- [ ] **Bookings count** — currently hardcoded `"172"` — query from `appointments`
- [ ] **Peak hours** — currently hardcoded mock — aggregate `appointments.start_time` by hour
- [ ] **Acquisition channels** — currently hardcoded mock — aggregate `clients.source` or `appointments.source`
- [ ] **Period selector** — week/month/year buttons don't change data — wire them up
- [ ] **Top barbers** — partially real, improve with appointment/revenue aggregation

### 1.4 — Calendar "New Booking" Button
- [ ] Button exists but has no handler
- [ ] Open a modal/drawer to create a new appointment directly from the calendar
- [ ] Pre-fill the selected date

### 1.5 — Client Actions
- [ ] **WhatsApp button** — open `https://wa.me/{phone}` in new tab
- [ ] **Call button** — open `tel:{phone}`
- [ ] **Edit client** — `updateClient` hook exists but no edit UI in the drawer
- [ ] **Delete client** — not implemented in hook or UI
- [ ] **"New Booking" in drawer** — should navigate to `/book?shop=...` or open inline booking

### 1.6 — Daily Receipt Export
- [ ] PDF export button exists but does nothing — implement using browser print or a PDF library
- [ ] CSV export button exists but does nothing — generate CSV from sales data and trigger download

### 1.7 — Topbar Search
- [ ] Search icon/input exists but is non-functional
- [ ] Implement global search across clients, appointments, leads

### 1.8 — Topbar Notifications
- [ ] Bell icon exists but does nothing
- [ ] Show recent activity: new bookings, status changes, etc.

### 1.9 — Leads Import CSV
- [ ] "Import" button exists but does nothing
- [ ] Parse CSV file, create leads in Supabase, update store

### 1.10 — Settings Tabs
- [ ] **Team tab** — shows barbers from workspace store but no invite/remove functionality
- [ ] **Billing tab** — completely placeholder, needs billing info or plan selector
- [ ] **QR Code download** — `qrcode.react` is installed, component may exist, but download button doesn't work

---

## Phase 2: New Features — Services Management

Currently there is no way for shop admins to manage their services from the dashboard.

### 2.1 — Services CRUD Page
- [ ] Create `/services` route under dashboard
- [ ] Add sidebar navigation item
- [ ] List all services with name, name_ar, duration, price, icon, active status
- [ ] Add service modal/form
- [ ] Edit service inline or via modal
- [ ] Delete service with confirmation
- [ ] Toggle active/inactive
- [ ] Drag-to-reorder (sort_order)

---

## Phase 3: New Features — Team Management

Barbers can sign up but have no way to join a shop. Admins can't invite or manage team members.

### 3.1 — Invite System
- [ ] Create `shop_invites` table with invite code, shop_id, role, expiry
- [ ] Admin can generate invite link/code from Settings > Team
- [ ] Barber signup with invite code → auto-assign to shop
- [ ] Alternative: Admin enters barber's email → sends invite email

### 3.2 — Team Page in Settings
- [ ] List all team members (profiles in the same shop)
- [ ] Show role, join date, avatar
- [ ] Admin can change roles (barber ↔ admin)
- [ ] Admin can remove a team member (set shop_id to null)

### 3.3 — Barber Dashboard View
- [ ] When logged in as `barber` role, show filtered dashboard:
  - Only their appointments, not the full shop's
  - Their personal stats (bookings, revenue)
  - No access to leads, analytics, or settings (or limited access)

---

## Phase 4: New Features — Customer Portal Enhancements

The customer dashboard exists but is minimal.

### 4.1 — Customer Profile Edit
- [ ] Allow editing name, phone, email
- [ ] Profile picture upload (Supabase Storage)

### 4.2 — Rebook from History
- [ ] "Book Again" button on past appointments
- [ ] Pre-fill services and barber from the previous appointment

### 4.3 — Cancel/Reschedule
- [ ] Allow customers to cancel upcoming appointments (with time restrictions)
- [ ] Reschedule to a different time slot

### 4.4 — Favorite Shops
- [ ] Save shops for quick rebooking
- [ ] Show favorite shops on customer dashboard

---

## Phase 5: New Features — Notifications & Communication

### 5.1 — In-App Notifications
- [ ] Create `notifications` table
- [ ] Real-time with Supabase Realtime subscriptions
- [ ] Notification bell shows unread count
- [ ] Types: new booking, cancellation, status change, lead update

### 5.2 — Email Notifications
- [ ] Booking confirmation email to customer
- [ ] Appointment reminder (day before)
- [ ] Use Supabase Edge Functions or a service like Resend

### 5.3 — WhatsApp/SMS Integration (Optional)
- [ ] Send booking confirmation via WhatsApp API
- [ ] Appointment reminders via SMS

---

## Phase 6: UI/UX Enhancements

### 6.1 — Booking Engine Polish
- [ ] Remove hardcoded rating "4.8 (127 reviews)" — use real data or remove
- [ ] Remove "Interactive Map" placeholder — integrate Google Maps or remove
- [ ] Remove hardcoded "5.0" barber ratings — use real data or remove
- [ ] Fix "SMS sent" message on booking success — only show if SMS is actually implemented
- [ ] Add barber avatars in booking flow

### 6.2 — Customer Dashboard Polish
- [ ] Fetch and display barber name for each appointment (currently always `null`)
- [ ] Add shop logo/avatar next to shop name
- [ ] Make "My Profile" card clickable with edit form

### 6.3 — Dashboard Polish
- [ ] Remove mock data fallbacks once real data is working
- [ ] Add empty states for new shops with no data yet (onboarding guidance)
- [ ] Quick actions — "Export PDF" links to `#` → implement or remove

### 6.4 — Responsive & Mobile
- [ ] Test all pages on mobile viewport
- [ ] Ensure sidebar collapses properly
- [ ] Customer dashboard mobile layout
- [ ] Booking engine mobile testing

### 6.5 — Loading & Error States
- [ ] Add skeleton loading to all data-fetching pages
- [ ] Consistent error messages and retry buttons
- [ ] Toast feedback for all CRUD operations

### 6.6 — Accessibility
- [ ] Add `aria-label` to icon-only buttons
- [ ] Ensure keyboard navigation works (modals, drawers, dropdowns)
- [ ] Color contrast check for all text

---

## Phase 7: Auth & Security Enhancements

### 7.1 — Password Reset Flow
- [ ] Add "Forgot password?" link on login page
- [ ] Use Supabase `resetPasswordForEmail`
- [ ] Create `/auth/reset-password` page

### 7.2 — Email Verification
- [ ] Verify email on signup before allowing access
- [ ] Handle verification callback properly

### 7.3 — Rate Limiting
- [ ] Rate limit the booking API to prevent spam
- [ ] Rate limit login attempts

---

## Phase 8: Performance & SEO

### 8.1 — Performance
- [ ] Remove unused `framer-motion` dependency if fully replaced by CSS animations
- [ ] Code-split heavy components (Recharts, dnd-kit)
- [ ] Image optimization for any uploaded images (Supabase Storage + Next.js Image)
- [ ] Fix Recharts width/height warning

### 8.2 — SEO
- [ ] Structured data (JSON-LD) for booking pages
- [ ] Dynamic OG images for shop pages
- [ ] Sitemap generation
- [ ] robots.txt

### 8.3 — PWA (Progressive Web App)
- [ ] Service worker for offline support
- [ ] App manifest for "Add to Home Screen"
- [ ] Push notifications

---

## Phase 9: Deployment & DevOps

### 9.1 — Vercel Deployment
- [ ] Login and deploy: `npx vercel login && npx vercel --prod`
- [ ] Add environment variables in Vercel dashboard
- [ ] Set up custom domain

### 9.2 — CI/CD
- [ ] Add lint check to `package.json` (`"lint": "eslint ."`)
- [ ] GitHub Actions for build + lint on PR
- [ ] Preview deployments for branches

### 9.3 — Monitoring
- [ ] Error tracking (Sentry or Vercel Analytics)
- [ ] Usage analytics (Vercel Analytics or PostHog)

---

## Priority Matrix

| Priority | Phase | Impact | Effort |
|----------|-------|--------|--------|
| 🔴 Critical | Phase 0 — Critical Fixes | Existing features broken | Low |
| 🟠 High | Phase 1 — Activate Features | Features exist, just not wired | Medium |
| 🟠 High | Phase 2 — Services CRUD | Core business feature | Medium |
| 🟡 Medium | Phase 3 — Team Management | Multi-user requirement | Medium |
| 🟡 Medium | Phase 6 — UI Polish | User experience | Low-Medium |
| 🟢 Normal | Phase 4 — Customer Portal | Nice-to-have | Medium |
| 🟢 Normal | Phase 5 — Notifications | Nice-to-have | High |
| 🟢 Normal | Phase 7 — Auth Security | Production requirement | Low |
| 🔵 Low | Phase 8 — Performance/SEO | Optimization | Medium |
| 🔵 Low | Phase 9 — DevOps | Infrastructure | Low |

---

## Feature Status Summary

| Feature | Status | Data Source |
|---------|--------|-------------|
| Auth (login/signup/callback) | ✅ Working | Supabase |
| Role-based signup | ✅ Working | Supabase |
| Middleware route protection | ✅ Working | Supabase |
| Dashboard metrics | ⚠️ Partial | Supabase + mock fallback |
| Dashboard sales chart | ❌ Mock only | Mock |
| Dashboard upcoming appts | ❌ Hardcoded | Mock |
| Dashboard daily receipt | ⚠️ Partial | Supabase + mock fallback |
| Calendar view | ✅ Working | Supabase |
| Calendar new booking | ❌ Button broken | — |
| Clients list | ✅ Working | Supabase |
| Client edit/delete | ❌ Not wired | — |
| Client actions (call/wa) | ❌ Not wired | — |
| Leads kanban | ⚠️ Mock only | Never hydrates |
| Leads CRUD | ⚠️ UI works, data mock | Zustand |
| Analytics revenue | ⚠️ Partial | Supabase + mock |
| Analytics other charts | ❌ Mock only | Mock |
| Settings general | ✅ Working | Supabase |
| Settings team | ❌ Placeholder | — |
| Settings billing | ❌ Placeholder | — |
| Booking engine | ✅ Working | Supabase API |
| Customer dashboard | ✅ Working | Supabase |
| Landing page | ⚠️ Links broken | Static |
| Services management | ❌ Missing | — |
| Team invite system | ❌ Missing | — |
| Notifications | ❌ Missing | — |
| Search | ❌ Not wired | — |
| Export (PDF/CSV) | ❌ Not wired | — |
| Password reset | ❌ Missing | — |
