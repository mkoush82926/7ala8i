# Graph Report - 7ala8i  (2026-11-13)

## Corpus Check
- 310 files · ~238,752 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .woff2 7, (none) 5, .css 2)

## Summary
- 2287 nodes · 5698 edges · 146 communities (91 shown, 55 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8d730a35`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createClient
- clients/page.tsx
- next
- interpolate
- useTranslation
- booking-utils.ts
- with
- use-appointments.ts
- Halaqy Build Roadmap: Fresha-level capability, built for Jordan
- format.ts
- react
- validations.ts
- cn
- leads-store.ts
- analytics-page.ts
- Halaqy (حلقي)
- dependencies
- booking/route.ts
- devDependencies
- MockQueryBuilder
- index.ts
- 20250101001950_availability_engine.sql
- useWorkspaceStore
- middleware.ts
- mock-data.ts
- package.json
- analytics/page.tsx
- database.types.ts
- api-helpers.ts
- useWorkspaceStore
- legal-page.tsx
- scripts
- compilerOptions
- Supabase
- rehearse-prod-upgrade.sh
- en.ts
- leads.ts
- Changelog
- 4. Functional History by Phase
- mock-client.ts
- Changelog
- Writing Guidelines for Postgres References
- settings-page.tsx
- lib/types.ts
- 20250101001600_production_hardening.sql
- workspace-store.ts
- env.ts
- EmptyState
- 20250101000100_initial_schema.sql
- timeline-view.tsx
- createQueryBuilder
- appointment-details-dialog.tsx
- next.config.ts
- [locale]/layout.tsx
- rate-limit.ts
- Phase 1: Activate Existing But Non-Functional Features
- Section Definitions
- Halaqy (7ala8i) — UX Enhancement Plan
- sitemap.ts
- Halaqy Master Development Plan
- Halaqy — Full Project Roadmap
- 20250101000210_indexes.sql
- public.shops
- Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)
- Halaqy — AI Conversation History & Project Summary
- vitest
- public.clients
- services/page.tsx
- Phase 6: UI/UX Enhancements
- error-reporting.ts
- Supabase Postgres Best Practices
- eslint.config.mjs
- Phase 0: Critical Fixes (Broken/Non-Functional)
- instrumentation.ts
- landing/page.tsx
- use-services.ts
- helpers.ts
- Phase 4: New Features — Customer Portal Enhancements
- Phase 5: New Features — Notifications & Communication
- Phase 7: Auth & Security Enhancements
- Phase 8: Performance & SEO
- Phase 9: Deployment & DevOps
- appointment-form-dialog.tsx
- auth.users
- generate_seed.js
- public.invites
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- CLAUDE.md
- .claude/CLAUDE.md
- .mcp.json
- postcss.config.mjs
- public.barber_services
- create/route.ts
- vite-tsconfig-paths
- glass-button.tsx
- public.payments
- pg_temp.enum_column_to_text
- robots.ts
- @testing-library/jest-dom
- idempotency.ts
- go-live-db.sh
- run.sh
- accept/route.test.ts

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 139 edges
2. `cn()` - 97 edges
3. `react` - 76 edges
4. `next` - 70 edges
5. `createClient()` - 67 edges
6. `vitest` - 56 edges
7. `interpolate()` - 55 edges
8. `useWorkspaceStore` - 55 edges
9. `public.shops` - 48 edges
10. `lucide-react` - 46 edges

## Surprising Connections (you probably didn't know these)
- `0.1 — Fix Database Migration Inconsistencies` --references--> `UserRole`  [INFERRED]
  PLAN.md → src/lib/types.ts
- `Authentication` --references--> `signup()`  [INFERRED]
  TODO.md → src/app/[locale]/auth/actions.ts
- `7. Monitoring` --references--> `logServerError()`  [INFERRED]
  docs/DEPLOYMENT.md → src/lib/api-helpers.ts
- `Phase 5 — POS & Payments (Pay in Shop Only)` --references--> `useDashboardMetrics()`  [INFERRED]
  PROJECT_HISTORY.md → src/hooks/use-dashboard-data.ts
- `6. Guidelines for Future Changes (for any AI)` --references--> `rateLimit()`  [INFERRED]
  PROJECT_HISTORY.md → src/lib/rate-limit.ts

## Import Cycles
- None detected.

## Communities (146 total, 55 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.06
Nodes (80): lucide-react, AuthActionResult, AUTH_ERROR_KEYS, AuthErrorKey, authErrorKey(), AuthErrorLike, isAuthErrorKey(), isValidEmail() (+72 more)

### Community 1 - "clients/page.tsx"
Cohesion: 0.09
Nodes (47): AVATAR_TONES, ClientDrawer(), ClientFormDialog(), ClientListItem(), ClientsPage(), ClientsView(), codeMessage(), ContactField() (+39 more)

### Community 2 - "next"
Cohesion: 0.11
Nodes (15): next, clientIp(), login(), logout(), signup(), GET(), AUTH_LOCALES, AuthLocale (+7 more)

### Community 3 - "interpolate"
Cohesion: 0.06
Nodes (69): AppointmentDetail, BookingDetailPage(), confirmCancel(), AppointmentLike, AppointmentTab, CancelBlockReason, CancellationState, cancellationState() (+61 more)

### Community 4 - "useTranslation"
Cohesion: 0.11
Nodes (43): Architecture, handleExport(), AppointmentDetailsDialog(), SearchBox(), goTo(), onKeyDown(), NotificationBell(), openNotification() (+35 more)

### Community 5 - "booking-utils.ts"
Cohesion: 0.06
Nodes (72): BarberAvatar(), BarberRow, BookingEngine(), BookingStep, BottomBar(), C, CardsSkeleton(), ChipsSkeleton() (+64 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (42): name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, continue-on-error (+34 more)

### Community 7 - "use-appointments.ts"
Cohesion: 0.20
Nodes (15): AppointmentActionError, toCalendarAppointment(), useAppointments(), APPOINTMENT_COLUMNS, Client, completeAppointmentSale(), createStaffAppointment(), dayRangeBounds() (+7 more)

### Community 8 - "Halaqy Build Roadmap: Fresha-level capability, built for Jordan"
Cohesion: 0.06
Nodes (32): 1. Executive summary, 2. Design and UX upgrade principles (Ink & Brass, not Fresha), 3. Day-0 owner actions and open decisions, 4. Phased roadmap, 5. Out of scope until the owner provides external accounts, 6. Explicitly deprioritised, 7. Feature parity matrix, Decisions needed before the named workstream starts (+24 more)

### Community 9 - "format.ts"
Cohesion: 0.08
Nodes (47): BOOKING_ENTRIES, BookingCta(), BookingCtaProps, BookingCtaVariant, BookingEntry, BookingHrefInput, buildBookingHref(), servicesCountLabel() (+39 more)

### Community 10 - "react"
Cohesion: 0.09
Nodes (42): @dnd-kit/core@^6.3.1, @dnd-kit/core, @dnd-kit/sortable, react, LeadsPage(), errorText(), CheckoutDialog(), DragPreview (+34 more)

### Community 11 - "validations.ts"
Cohesion: 0.07
Nodes (33): BOOKING_SOURCES, PAYMENT_METHODS, AppointmentStatusSchema, AvailabilityQuerySchema, BookingInput, BookingSchema, CancelBookingInput, CancelBookingSchema (+25 more)

### Community 12 - "cn"
Cohesion: 0.14
Nodes (35): BookingShell(), AVATAR_TONES, codeMessage(), DaySchedule, dbErrorMessage(), InviteDialog(), MemberSettingsDialog(), PanelActions() (+27 more)

### Community 13 - "leads-store.ts"
Cohesion: 0.18
Nodes (15): AuthProvider(), errorCodeOf(), bump(), draftToLead(), DrawerMode, fail(), LeadRecord, LeadResult (+7 more)

### Community 14 - "analytics-page.ts"
Cohesion: 0.08
Nodes (50): @supabase/supabase-js@^2.99.0, @supabase/supabase-js, bucketLabel(), Client, DashboardMetricsView, getBarberPerformance(), getDashboardMetrics(), getRevenueChart() (+42 more)

### Community 15 - "Halaqy (حلقي)"
Cohesion: 0.07
Nodes (25): 1. Environment variables (Vercel → Project → Settings → Environment Variables), 2. Vercel project, 3. Database, 4. Supabase Auth (Dashboard → Authentication), 5. Rate limiting and abuse, 6. Backups and recovery, 7. Monitoring, 8. Release smoke test (production, after each deploy) (+17 more)

### Community 16 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, adhan@^4.4.6, clsx@^2.1.1, date-fns@^4.1.0, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, framer-motion@^12.35.2, lucide-react@^0.577.0 (+20 more)

### Community 17 - "booking/route.ts"
Cohesion: 0.24
Nodes (25): POST(), parseIdempotencyKey(), CreateOutcome, GET(), POST(), callRpc(), POST, POST() (+17 more)

### Community 18 - "devDependencies"
Cohesion: 0.09
Nodes (23): devDependencies, @axe-core/playwright@^4.13.0, jsdom@^30.0.1, lint-staged@^17.3.0, @playwright/test@^1.62.1, supabase@^2.114.0, tailwindcss@^4, @testing-library/react@^16.3.2 (+15 more)

### Community 21 - "index.ts"
Cohesion: 0.11
Nodes (36): RFC-5545, AvailabilityError, availabilityErrorCode(), dayPartOf(), daySpan(), getAvailableSlots(), groupSlotsByDate(), groupSlotsByDayPart() (+28 more)

### Community 22 - "20250101001950_availability_engine.sql"
Cohesion: 0.09
Nodes (27): guard_profile_booking_flags, idx_appointments_shop_unassigned, idx_blocked_time_types_shop, idx_blocked_times_barber_time, idx_blocked_times_series, idx_blocked_times_shop_time, idx_closed_periods_shop, idx_shift_overrides_shop_date (+19 more)

### Community 23 - "useWorkspaceStore"
Cohesion: 0.08
Nodes (55): date-fns, isResolved(), MyDayPage(), confirmCheckout(), confirmPending(), setOverride(), Pending, DashboardPage() (+47 more)

### Community 24 - "middleware.ts"
Cohesion: 0.13
Nodes (20): @supabase/ssr@^0.9.0, @supabase/ssr, MOCK_AUTH_ROLE, MOCK_DATA_ENABLED, ADMIN_ONLY_ROUTES, AppRole, config, CUSTOMER_ROUTES (+12 more)

### Community 25 - "mock-data.ts"
Cohesion: 0.11
Nodes (16): MOCK_BARBERS, MOCK_SERVICE_SEED, MOCK_SERVICES, MOCK_SHOP_IDS, MOCK_WORKING_HOURS, MockAdminProfile, MockBarber, MockClient (+8 more)

### Community 26 - "package.json"
Cohesion: 0.11
Nodes (17): husky@^9.1.7, @tailwindcss/postcss@^4, @types/react-dom@^19, @types/web-push@^3.6.4, typescript@^5, engines, node, lint-staged (+9 more)

### Community 27 - "analytics/page.tsx"
Cohesion: 0.18
Nodes (12): RevenuePoint, RevenueTrendChartProps, SLICE_COLORS, SourceSlice, tick, AnalyticsPage(), ChangePill(), DAY_ORDER (+4 more)

### Community 28 - "database.types.ts"
Cohesion: 0.10
Nodes (20): FunctionName, BookingResult, BusySlot, CancelBookingResult, CompleteSaleResult, CompositeTypes, Constants, Database (+12 more)

### Community 29 - "api-helpers.ts"
Cohesion: 0.08
Nodes (30): API_ERROR_CODES, apiError(), ApiErrorOptions, ApiErrorResponse, ApiSuccessResponse, AuthContext, AuthenticatedHandler, cleanFieldErrors() (+22 more)

### Community 30 - "useWorkspaceStore"
Cohesion: 0.06
Nodes (55): react-dom@19.2.3, react-dom, DashboardLayout(), ADMIN, canAccessPath(), findNavItem(), homePathFor(), isNavActive() (+47 more)

### Community 31 - "legal-page.tsx"
Cohesion: 0.21
Nodes (16): generateMetadata(), PolicyPage(), Props, LEGAL_LAST_UPDATED, LegalLocale, legalMetadata(), LegalPage(), LegalSection (+8 more)

### Community 32 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:check-migrations, db:reset, db:seed:e2e, db:start, db:stop, dev (+11 more)

### Community 33 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 34 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 35 - "rehearse-prod-upgrade.sh"
Cohesion: 0.80
Nodes (4): psql_admin(), psql_pg(), row_counts(), rehearse-prod-upgrade.sh script

### Community 36 - "en.ts"
Cohesion: 0.13
Nodes (9): Dict, ar, DeepStringRecord, en, TranslationKeys, flatAr, flatEn, flatten() (+1 more)

### Community 37 - "leads.ts"
Cohesion: 0.26
Nodes (12): Client, createLead(), createLeads(), deleteLead(), deleteLeads(), getLeads(), LEAD_COLUMNS, LeadWrite (+4 more)

### Community 38 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 39 - "4. Functional History by Phase"
Cohesion: 0.12
Nodes (16): 1. Technology Stack & Architecture, 2.1 Supabase, 2.2 Vercel, 2. External Services & Configuration, 3. Auth Model, Roles & Security, 4. Functional History by Phase, 5. Running & Developing Locally, 6. Guidelines for Future Changes (for any AI) (+8 more)

### Community 40 - "mock-client.ts"
Cohesion: 0.12
Nodes (15): MOCK_ADMIN_ID, MOCK_ADMIN_PROFILE, MOCK_APPOINTMENTS, MOCK_CLIENTS, MOCK_PROFILES, MOCK_REVIEWS, ACTIVE, localDay() (+7 more)

### Community 41 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 42 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 43 - "settings-page.tsx"
Cohesion: 0.08
Nodes (46): SettingsRoute(), copyDayToWorkingDays(), CURRENCIES, DayHours, DayHoursError, DEFAULT_DAY, FieldError, hhmm() (+38 more)

### Community 45 - "lib/types.ts"
Cohesion: 0.12
Nodes (20): BADGE_CLASS, statusLabel(), describeNotification(), localDay(), NotificationPayload, NotificationRow, fmt, t (+12 more)

### Community 46 - "20250101001600_production_hardening.sql"
Cohesion: 0.07
Nodes (36): public.clients, public.profiles, public.get_current_shop_id(), public.get_current_shop_id(), public.working_hours, public.current_profile_shop_and_role(), appointment_status_side_effects, guard_last_shop_admin (+28 more)

### Community 47 - "workspace-store.ts"
Cohesion: 0.20
Nodes (9): zustand@^5.0.11, zustand, BOOKABLE_ROLES, INITIAL_DATA, isBookableRole(), WorkspaceBarber, WorkspaceRole, WorkspaceState (+1 more)

### Community 48 - "env.ts"
Cohesion: 0.08
Nodes (27): zod, checkDatabase(), DbStatus, dynamic, GET(), HEAD(), NO_STORE, runtime (+19 more)

### Community 49 - "EmptyState"
Cohesion: 0.18
Nodes (14): ChangeBadge(), MetricCards(), StatCard, colors, Confetti(), ConfettiPiece, ConfettiProps, generatePieces() (+6 more)

### Community 50 - "20250101000100_initial_schema.sql"
Cohesion: 0.10
Nodes (23): idx_appointments_barber_date, idx_appointments_shop_date, idx_daily_sales_shop_date, on_auth_user_created, on_shops_updated, public.appointments, public.barbers, public.daily_sales (+15 more)

### Community 51 - "timeline-view.tsx"
Cohesion: 0.15
Nodes (22): framer-motion, CalendarPage(), blockPlacement(), computeHourRange(), DEFAULT_DAY_END, DEFAULT_DAY_START, hoursOf(), hourTicks() (+14 more)

### Community 52 - "createQueryBuilder"
Cohesion: 0.11
Nodes (18): bookingResult, fromMock, getUserMock, rateLimitMock, rpcMock, validPayload, apptBuilder(), fromMock (+10 more)

### Community 53 - "appointment-details-dialog.tsx"
Cohesion: 0.27
Nodes (8): Appt, Appt, AppointmentDetailsDialogProps, CalendarAppointment, MockAppointment, MyAppointment, AppointmentStatus, PaymentMethod

### Community 54 - "next.config.ts"
Cohesion: 0.29
Nodes (4): csp, nextConfig, securityHeaders, supa

### Community 55 - "[locale]/layout.tsx"
Cohesion: 0.20
Nodes (9): bdoGrotesk, cairo, generateMetadata(), isSupportedLocale(), RootLayout(), siteUrl(), SUPPORTED_LOCALES, SupportedLocale (+1 more)

### Community 56 - "rate-limit.ts"
Cohesion: 0.18
Nodes (14): getServerEnv(), getAdminClient(), hashKey(), memoryLimit(), pruneExpired(), RATE_LIMITS, rateLimitAll(), RateLimitCheck (+6 more)

### Community 57 - "Phase 1: Activate Existing But Non-Functional Features"
Cohesion: 0.18
Nodes (11): 1.10 — Settings Tabs, 1.1 — Sales Chart (Real Data), 1.2 — Dashboard Metrics Change Percentages, 1.3 — Analytics Real Data, 1.4 — Calendar "New Booking" Button, 1.5 — Client Actions, 1.6 — Daily Receipt Export, 1.7 — Topbar Search (+3 more)

### Community 58 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 59 - "Halaqy (7ala8i) — UX Enhancement Plan"
Cohesion: 0.22
Nodes (7): By Journey, Design Principles for This Product, Halaqy (7ala8i) — UX Enhancement Plan, Prioritized Roadmap, Tier 0 — Fix Trust & Dead Ends (days, do first), Tier 2 — Signature Enhancements (bigger bets), What NOT to Do Yet

### Community 60 - "sitemap.ts"
Cohesion: 0.27
Nodes (9): listPublicShops(), LOCALES, localizedEntries(), revalidate, ShopRow, sitemap(), siteOrigin(), STATIC_PAGES (+1 more)

### Community 61 - "Halaqy Master Development Plan"
Cohesion: 0.20
Nodes (9): Authentication, Calendar & Bookings (Pending), CRM & KanBan Integration (Pending), Database Setup, Halaqy Master Development Plan, Phase 1 & 2: Frontend Foundation & Component Design, Phase 2.5: UI Polish & Landing Page, Phase 3: Backend Integration (Supabase) (+1 more)

### Community 62 - "Halaqy — Full Project Roadmap"
Cohesion: 0.22
Nodes (9): 2.1 — Services CRUD Page, 3.1 — Invite System, 3.2 — Team Page in Settings, 3.3 — Barber Dashboard View, Feature Status Summary, Halaqy — Full Project Roadmap, Phase 2: New Features — Services Management, Phase 3: New Features — Team Management (+1 more)

### Community 63 - "20250101000210_indexes.sql"
Cohesion: 0.12
Nodes (12): idx_appointments_barber, idx_appointments_client, idx_appointments_shop_date, idx_appointments_status, idx_clients_phone, idx_clients_shop, idx_leads_shop_stage, idx_profiles_shop (+4 more)

### Community 64 - "public.shops"
Cohesion: 0.11
Nodes (22): public.shops, guard_platform_role, idx_areas_city, idx_shops_geo, idx_shops_marketplace, idx_shops_organization, on_organizations_updated, public.areas (+14 more)

### Community 65 - "Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)"
Cohesion: 0.25
Nodes (7): Core tokens (already live in `src/app/globals.css` and `:root`), Do's (from the reference spec), Don'ts, Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference), Old → new color mapping (apply exactly this way — do not invent new hexes), Verification checklist (apply to every file before considering it done), What NOT to change

### Community 66 - "Halaqy — AI Conversation History & Project Summary"
Cohesion: 0.25
Nodes (7): Halaqy — AI Conversation History & Project Summary, 🔜 Next Immediate Steps (Phase 3 Continued), Phase 1 & 2: UI Foundation & Core Components, Phase 2.5: UI Polish & Public Landing Page, Phase 3 (Currently Active): Backend Integration (Supabase), 🚀 Phases Completed, 📅 Project Overview

### Community 67 - "vitest"
Cohesion: 0.14
Nodes (9): vitest, rateLimitMock, rpcMock, MASK_CHAR, maskPhone(), createBrowserClientMock, CookieMethods, cookieStore (+1 more)

### Community 68 - "public.clients"
Cohesion: 0.60
Nodes (4): idx_reviews_rating, idx_reviews_shop_id, public.reviews, idx_reviews_shop_created

### Community 69 - "services/page.tsx"
Cohesion: 0.14
Nodes (16): FormErrors, FormField, ICONS, ServiceRow(), ServiceRowBody(), ServiceRowProps, ServicesPage(), handleSave() (+8 more)

### Community 70 - "Phase 6: UI/UX Enhancements"
Cohesion: 0.29
Nodes (7): 6.1 — Booking Engine Polish, 6.2 — Customer Dashboard Polish, 6.3 — Dashboard Polish, 6.4 — Responsive & Mobile, 6.5 — Loading & Error States, 6.6 — Accessibility, Phase 6: UI/UX Enhancements

### Community 71 - "error-reporting.ts"
Cohesion: 0.22
Nodes (13): C, detectLocale(), GlobalError(), LocaleError(), buildEnvelope(), envelopeUrl(), ErrorContext, isErrorReportingEnabled() (+5 more)

### Community 72 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 73 - "eslint.config.mjs"
Cohesion: 0.22
Nodes (7): CLASS_CALLEES, eslintConfig, halaqyPlugin, eslint@^9, eslint-config-next@16.1.6, eslint, eslint-config-next

### Community 74 - "Phase 0: Critical Fixes (Broken/Non-Functional)"
Cohesion: 0.33
Nodes (6): 0.1 — Fix Database Migration Inconsistencies, 0.2 — Fix Workspace Store Hydration, 0.3 — Fix Leads Store Hydration, 0.4 — Fix Dashboard Upcoming Appointments, 0.5 — Fix Landing Page Links, Phase 0: Critical Fixes (Broken/Non-Functional)

### Community 75 - "instrumentation.ts"
Cohesion: 0.38
Nodes (5): headerValue(), onRequestError(), RequestErrorContext, RequestInfo, safePath()

### Community 76 - "landing/page.tsx"
Cohesion: 0.25
Nodes (16): BackgroundVideo(), LandingNav(), LandingShell(), shouldStream(), useViewer(), Viewer, Eyebrow(), generateMetadata() (+8 more)

### Community 77 - "use-services.ts"
Cohesion: 0.23
Nodes (15): toItem(), useServices(), archiveService(), Client, countServiceAppointments(), createService(), deleteService(), getPublicServices() (+7 more)

### Community 78 - "helpers.ts"
Cohesion: 0.09
Nodes (24): BLOCKING_IMPACTS, checkA11y(), DYNAMIC_SELECTORS, expectDirection(), Fixtures, gotoLocale(), Locale, LOCALES (+16 more)

### Community 79 - "Phase 4: New Features — Customer Portal Enhancements"
Cohesion: 0.40
Nodes (5): 4.1 — Customer Profile Edit, 4.2 — Rebook from History, 4.3 — Cancel/Reschedule, 4.4 — Favorite Shops, Phase 4: New Features — Customer Portal Enhancements

### Community 80 - "Phase 5: New Features — Notifications & Communication"
Cohesion: 0.50
Nodes (4): 5.1 — In-App Notifications, 5.2 — Email Notifications, 5.3 — WhatsApp/SMS Integration (Optional), Phase 5: New Features — Notifications & Communication

### Community 81 - "Phase 7: Auth & Security Enhancements"
Cohesion: 0.50
Nodes (4): 7.1 — Password Reset Flow, 7.2 — Email Verification, 7.3 — Rate Limiting, Phase 7: Auth & Security Enhancements

### Community 82 - "Phase 8: Performance & SEO"
Cohesion: 0.50
Nodes (4): 8.1 — Performance, 8.2 — SEO, 8.3 — PWA (Progressive Web App), Phase 8: Performance & SEO

### Community 83 - "Phase 9: Deployment & DevOps"
Cohesion: 0.50
Nodes (4): 9.1 — Vercel Deployment, 9.2 — CI/CD, 9.3 — Monitoring, Phase 9: Deployment & DevOps

### Community 84 - "appointment-form-dialog.tsx"
Cohesion: 0.23
Nodes (15): AppointmentForm(), handleSubmit(), AppointmentFormDefaults, AppointmentFormDialog(), AppointmentFormDialogProps, roundedNow(), ServiceOption, SOURCES (+7 more)

### Community 86 - "auth.users"
Cohesion: 0.09
Nodes (16): idx_notifications_user_id, public.notifications, public.notify_client_on_appointment_status(), public.notify_shop_on_appointment(), trigger_notify_client_on_appointment_status, trigger_notify_shop_on_appointment, public.link_customer_client(), idx_notifications_user_unread (+8 more)

### Community 88 - "public.invites"
Cohesion: 0.36
Nodes (6): idx_invites_token, public.accept_invite(), public.get_invite_by_token(), public.invites, idx_invites_shop, public.get_invite_by_token()

### Community 126 - "public.barber_services"
Cohesion: 0.25
Nodes (8): public.services, public.barber_services, idx_barber_services_service, public.barber_offers_services(), public.seed_staff_defaults(), idx_services_category, public.availability_engine(), public.get_busy_slots()

### Community 127 - "create/route.ts"
Cohesion: 0.29
Nodes (5): getUserMock, insertMock, inviteSingle, profileSingle, rateLimitMock

### Community 128 - "vite-tsconfig-paths"
Cohesion: 0.40
Nodes (4): vite-tsconfig-paths@^6.1.1, @vitejs/plugin-react@^6.0.5, vite-tsconfig-paths, @vitejs/plugin-react

### Community 129 - "glass-button.tsx"
Cohesion: 0.40
Nodes (4): GlassButton(), GlassButtonProps, sizes, variants

### Community 130 - "public.payments"
Cohesion: 0.83
Nodes (3): idx_payments_appointment, idx_payments_shop_created, public.payments

### Community 138 - "robots.ts"
Cohesion: 0.67
Nodes (3): PRIVATE_PATHS, robots(), siteOrigin()

### Community 141 - "idempotency.ts"
Cohesion: 0.40
Nodes (4): Entry, prune(), runIdempotent(), store

## Knowledge Gaps
- **3 isolated node(s):** `RFC-4180`, `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 895 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `createClient`, `clients/page.tsx`, `interpolate`, `useTranslation`, `booking-utils.ts`, `format.ts`, `robots.ts`, `react`, `cn`, `dependencies`, `booking/route.ts`, `accept/route.test.ts`, `useWorkspaceStore`, `middleware.ts`, `package.json`, `analytics/page.tsx`, `api-helpers.ts`, `useWorkspaceStore`, `legal-page.tsx`, `en.ts`, `settings-page.tsx`, `lib/types.ts`, `env.ts`, `EmptyState`, `timeline-view.tsx`, `createQueryBuilder`, `next.config.ts`, `[locale]/layout.tsx`, `sitemap.ts`, `error-reporting.ts`, `landing/page.tsx`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useTranslation()` (e.g. with `Architecture` and `Current State — What's Actually Undermining the Experience`) actually correct?**
  _`useTranslation()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `PATH`, `RFC-4180` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05964912280701754 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `createClient`, `clients/page.tsx`, `next`, `interpolate`, `useTranslation`, `booking-utils.ts`, `vite-tsconfig-paths`, `use-appointments.ts`, `format.ts`, `react`, `validations.ts`, `leads-store.ts`, `analytics-page.ts`, `booking/route.ts`, `devDependencies`, `accept/route.test.ts`, `index.ts`, `useWorkspaceStore`, `middleware.ts`, `mock-data.ts`, `package.json`, `useWorkspaceStore`, `en.ts`, `leads.ts`, `settings-page.tsx`, `lib/types.ts`, `env.ts`, `timeline-view.tsx`, `createQueryBuilder`, `rate-limit.ts`, `error-reporting.ts`, `use-services.ts`, `create/route.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `clients/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09085213032581453 - nodes in this community are weakly interconnected._
- **Why does `useTranslation()` connect `useTranslation` to `createClient`, `clients/page.tsx`, `interpolate`, `booking-utils.ts`, `format.ts`, `react`, `cn`, `useWorkspaceStore`, `analytics/page.tsx`, `useWorkspaceStore`, `leads.ts`, `settings-page.tsx`, `lib/types.ts`, `EmptyState`, `timeline-view.tsx`, `appointment-details-dialog.tsx`, `services/page.tsx`, `error-reporting.ts`, `landing/page.tsx`, `use-services.ts`, `appointment-form-dialog.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._