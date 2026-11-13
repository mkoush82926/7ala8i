# Graph Report - 7ala8i  (2026-11-13)

## Corpus Check
- 279 files · ~194,781 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .woff2 7, (none) 5, .css 2)

## Summary
- 1996 nodes · 5134 edges · 142 communities (94 shown, 48 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e354af00`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createClient
- clients.ts
- toast.tsx
- shop-profile-client.tsx
- useTranslation
- booking-utils.ts
- with
- dialog.tsx
- toast.tsx
- useWorkspaceStore
- interpolate
- validations.ts
- i18n.test.ts
- my-day/page.tsx
- vitest
- Halaqy (حلقي)
- dependencies
- booking/route.ts
- devDependencies
- MockQueryBuilder
- use-services.ts
- team/page.tsx
- kanban-board.tsx
- middleware.ts
- mock-data.ts
- helpers.ts
- analytics/page.tsx
- database.types.ts
- api-helpers.ts
- clients/page.tsx
- legal-page.tsx
- scripts
- compilerOptions
- Supabase
- cn
- en.ts
- cn
- Changelog
- 4. Functional History by Phase
- mock-client.ts
- Changelog
- Writing Guidelines for Postgres References
- settings-page.tsx
- EmptyState
- analytics-page.ts
- 20250101001600_production_hardening.sql
- server.ts
- env.ts
- analytics-period.ts
- search.ts
- timeline-view.tsx
- analytics.ts
- public.appointments
- health/route.ts
- [locale]/layout.tsx
- rate-limit.ts
- Phase 1: Activate Existing But Non-Functional Features
- Section Definitions
- Halaqy (7ala8i) — UX Enhancement Plan
- sitemap.ts
- Halaqy Master Development Plan
- Halaqy — Full Project Roadmap
- 20250101000210_indexes.sql
- @supabase/supabase-js
- Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)
- Halaqy — AI Conversation History & Project Summary
- shop-data.ts
- public.clients
- next.config.ts
- Phase 6: UI/UX Enhancements
- instrumentation.ts
- Supabase Postgres Best Practices
- eslint.config.mjs
- Phase 0: Critical Fixes (Broken/Non-Functional)
- idempotency.ts
- landing/page.tsx
- auth.users
- vite-tsconfig-paths
- Phase 4: New Features — Customer Portal Enhancements
- Phase 5: New Features — Notifications & Communication
- Phase 7: Auth & Security Enhancements
- Phase 8: Performance & SEO
- Phase 9: Deployment & DevOps
- accept/route.test.ts
- 20250101001800_private_columns_and_verified_links.sql
- 20250101000900_notifications.sql
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
- route.full.test.ts
- Phase 3: New Features — Team Management
- vitest
- public.payments
- pg_temp.reset_fk
- dialog.test.tsx
- book/[shop_id]/page.tsx
- robots.ts
- use-supabase-query.ts

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 135 edges
2. `cn()` - 89 edges
3. `react` - 71 edges
4. `next` - 69 edges
5. `createClient()` - 67 edges
6. `interpolate()` - 55 edges
7. `useWorkspaceStore` - 55 edges
8. `vitest` - 49 edges
9. `lucide-react` - 46 edges
10. `headingTracking()` - 43 edges

## Surprising Connections (you probably didn't know these)
- `Phase 5 — POS & Payments (Pay in Shop Only)` --references--> `useDashboardMetrics()`  [INFERRED]
  PROJECT_HISTORY.md → src/hooks/use-dashboard-data.ts
- `0.1 — Fix Database Migration Inconsistencies` --references--> `UserRole`  [INFERRED]
  PLAN.md → src/lib/types.ts
- `Authentication` --references--> `signup()`  [INFERRED]
  TODO.md → src/app/[locale]/auth/actions.ts
- `7. Monitoring` --references--> `logServerError()`  [INFERRED]
  docs/DEPLOYMENT.md → src/lib/api-helpers.ts
- `6. Guidelines for Future Changes (for any AI)` --references--> `rateLimit()`  [INFERRED]
  PROJECT_HISTORY.md → src/lib/rate-limit.ts

## Import Cycles
- None detected.

## Communities (142 total, 48 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.05
Nodes (85): lucide-react, next, react, AuthActionResult, clientIp(), login(), logout(), signup() (+77 more)

### Community 1 - "clients.ts"
Cohesion: 0.21
Nodes (17): ClientMutationError, ClientMutationErrorCode, ClientsPage, toClientMutationError(), useClients(), cleanClientInput(), Client, CLIENT_COLUMNS (+9 more)

### Community 2 - "toast.tsx"
Cohesion: 0.10
Nodes (40): DashboardLayout(), ADMIN, canAccessPath(), findNavItem(), homePathFor(), isNavActive(), NAV_ITEMS, NavId (+32 more)

### Community 3 - "shop-profile-client.tsx"
Cohesion: 0.15
Nodes (29): fill(), generateMetadata(), getShopProfile, Params, ShopPage(), loadShopProfile(), ShopProfileResult, HoursCard() (+21 more)

### Community 4 - "useTranslation"
Cohesion: 0.10
Nodes (40): Architecture, handleExport(), AppointmentDetailsDialog(), LeadCard(), NotificationBell(), openNotification(), setRead(), FONT_AR (+32 more)

### Community 5 - "booking-utils.ts"
Cohesion: 0.05
Nodes (75): RFC-5545, BookingShell(), BarberAvatar(), BarberRow, BookingEngine(), BookingStep, BottomBar(), C (+67 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (42): name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, continue-on-error (+34 more)

### Community 7 - "dialog.tsx"
Cohesion: 0.15
Nodes (16): react-dom@19.2.3, react-dom, DialogProps, DialogSize, dialogStack, DRAWER_WIDTH, DrawerSide, FOCUSABLE (+8 more)

### Community 8 - "toast.tsx"
Cohesion: 0.09
Nodes (31): isThemedPath(), nav, THEMED_SEGMENTS, themeInitScript, ThemeProvider(), announcement, clearToasts(), containerListeners (+23 more)

### Community 9 - "useWorkspaceStore"
Cohesion: 0.13
Nodes (30): date-fns, DashboardPage(), PendingAction, SalesChart, DailyReceipt(), escapeCsvValue(), MethodRow(), tint() (+22 more)

### Community 10 - "interpolate"
Cohesion: 0.16
Nodes (24): AppointmentDetail, BookingDetailPage(), confirmCancel(), AppointmentLike, AppointmentTab, CancelBlockReason, CancellationState, cancellationState() (+16 more)

### Community 11 - "validations.ts"
Cohesion: 0.07
Nodes (33): BOOKING_SOURCES, PAYMENT_METHODS, AppointmentStatusSchema, AvailabilityQuerySchema, BookingInput, BookingSchema, CancelBookingInput, CancelBookingSchema (+25 more)

### Community 12 - "i18n.test.ts"
Cohesion: 0.16
Nodes (7): NotificationRow, fmt, t, flatAr, flatEn, flatten(), Tree

### Community 13 - "my-day/page.tsx"
Cohesion: 0.15
Nodes (20): isResolved(), MyDayPage(), confirmCheckout(), confirmPending(), setOverride(), Pending, UpcomingAppointments(), confirmPending() (+12 more)

### Community 14 - "vitest"
Cohesion: 0.17
Nodes (12): apptBuilder(), fromMock, getUserMock, profileBuilder(), counted(), mockAnalytics(), builderWith(), fromMock (+4 more)

### Community 15 - "Halaqy (حلقي)"
Cohesion: 0.07
Nodes (25): 1. Environment variables (Vercel → Project → Settings → Environment Variables), 2. Vercel project, 3. Database, 4. Supabase Auth (Dashboard → Authentication), 5. Rate limiting and abuse, 6. Backups and recovery, 7. Monitoring, 8. Release smoke test (production, after each deploy) (+17 more)

### Community 16 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, clsx@^2.1.1, date-fns@^4.1.0, @dnd-kit/utilities@^3.2.2, framer-motion@^12.35.2, lucide-react@^0.577.0, next@16.1.6, qrcode.react@^4.2.0 (+15 more)

### Community 17 - "booking/route.ts"
Cohesion: 0.40
Nodes (15): POST(), parseIdempotencyKey(), CreateOutcome, GET(), POST(), callRpc(), POST(), apiErrorCode() (+7 more)

### Community 18 - "devDependencies"
Cohesion: 0.07
Nodes (36): devDependencies, @axe-core/playwright@^4.13.0, husky@^9.1.7, jsdom@^30.0.1, lint-staged@^17.3.0, @playwright/test@^1.62.1, supabase@^2.114.0, tailwindcss@^4 (+28 more)

### Community 21 - "use-services.ts"
Cohesion: 0.10
Nodes (31): FormErrors, FormField, ICONS, ServiceRow(), ServiceRowBody(), ServiceRowProps, ServicesPage(), handleSave() (+23 more)

### Community 22 - "team/page.tsx"
Cohesion: 0.20
Nodes (19): AVATAR_TONES, codeMessage(), DaySchedule, dbErrorMessage(), MemberSettingsDialog(), PanelActions(), roleLabel(), RolePanel() (+11 more)

### Community 23 - "kanban-board.tsx"
Cohesion: 0.06
Nodes (57): @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/core, @dnd-kit/sortable, LeadsPage(), DragPreview, isStage(), KanbanBoard() (+49 more)

### Community 24 - "middleware.ts"
Cohesion: 0.16
Nodes (17): MOCK_AUTH_ROLE, ADMIN_ONLY_ROUTES, AppRole, config, CUSTOMER_ROUTES, isLocale(), isPublicPath(), Locale (+9 more)

### Community 25 - "mock-data.ts"
Cohesion: 0.11
Nodes (16): MOCK_BARBERS, MOCK_SERVICE_SEED, MOCK_SERVICES, MOCK_SHOP_IDS, MOCK_WORKING_HOURS, MockAdminProfile, MockBarber, MockClient (+8 more)

### Community 26 - "helpers.ts"
Cohesion: 0.40
Nodes (6): completeBooking(), escapeRegExp(), getSeed(), login(), SeedData, @playwright/test

### Community 27 - "analytics/page.tsx"
Cohesion: 0.16
Nodes (15): RevenuePoint, RevenueTrendChartProps, SLICE_COLORS, SourceSlice, tick, AnalyticsPage(), ChangePill(), DAY_ORDER (+7 more)

### Community 28 - "database.types.ts"
Cohesion: 0.13
Nodes (16): FunctionName, BookingResult, BusySlot, CancelBookingResult, CompleteSaleResult, DashboardMetrics, Database, Json (+8 more)

### Community 29 - "api-helpers.ts"
Cohesion: 0.12
Nodes (25): POST, API_ERROR_CODES, apiError(), ApiErrorCode, ApiErrorOptions, ApiErrorResponse, ApiResponse, apiResponse() (+17 more)

### Community 30 - "clients/page.tsx"
Cohesion: 0.22
Nodes (17): AVATAR_TONES, ClientDrawer(), ClientFormDialog(), ClientListItem(), ClientsPage(), ClientsView(), codeMessage(), ContactField() (+9 more)

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

### Community 35 - "cn"
Cohesion: 0.24
Nodes (14): InviteDialog(), formFor(), LeadDrawer(), useStages(), ConfirmDialog(), ConfirmDialogProps, Dialog(), DialogFooter() (+6 more)

### Community 36 - "en.ts"
Cohesion: 0.13
Nodes (9): C, detectLocale(), GlobalError(), ExplorePage(), Dict, ar, DeepStringRecord, en (+1 more)

### Community 37 - "cn"
Cohesion: 0.16
Nodes (17): ChangeBadge(), MetricCards(), StatCard, colors, Confetti(), ConfettiPiece, ConfettiProps, generatePieces() (+9 more)

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
Nodes (47): SettingsRoute(), copyDayToWorkingDays(), CURRENCIES, DayHours, DayHoursError, DEFAULT_DAY, FieldError, hhmm() (+39 more)

### Community 44 - "EmptyState"
Cohesion: 0.19
Nodes (14): ExploreClient(), ShopCardSkeleton(), ExploreShop, filterShops(), normalizeSearch(), shops, coverForShop(), hashString() (+6 more)

### Community 45 - "analytics-page.ts"
Cohesion: 0.16
Nodes (14): Builder, csvCell(), ExportRow, getFullAnalytics(), MAX_ROWS, MetricDelta, normalizeSource(), PAGE_SIZE (+6 more)

### Community 46 - "20250101001600_production_hardening.sql"
Cohesion: 0.09
Nodes (23): public.profiles, public.get_current_shop_id(), public.get_current_shop_id(), public.working_hours, public.current_profile_shop_and_role(), appointment_status_side_effects, guard_last_shop_admin, idx_profiles_shop_role (+15 more)

### Community 47 - "server.ts"
Cohesion: 0.17
Nodes (12): AuthContext, WithAuthOptions, Appointment, ClientRecord, DailySale, Database, Json, Lead (+4 more)

### Community 48 - "env.ts"
Cohesion: 0.08
Nodes (22): zod, createInviteSchema, POST, siteOrigin(), getUserMock, insertMock, inviteSingle, profileSingle (+14 more)

### Community 49 - "analytics-period.ts"
Cohesion: 0.24
Nodes (16): addDays(), bucketKeyOf(), dayKey(), DEFAULT_TIMEZONE, formatterCache, getPeriodRange(), monthKey(), offsetMs() (+8 more)

### Community 50 - "search.ts"
Cohesion: 0.35
Nodes (12): clientSearchFilter(), buildIlikeOrFilter(), Client, containsPattern(), EMPTY_RESULT, escapeLikePattern(), MAX_SEARCH_LENGTH, normalizeSearchTerm() (+4 more)

### Community 51 - "timeline-view.tsx"
Cohesion: 0.06
Nodes (71): framer-motion, CalendarPage(), Appt, Appt, AppointmentDetailsDialogProps, AppointmentForm(), handleSubmit(), AppointmentFormDefaults (+63 more)

### Community 52 - "analytics.ts"
Cohesion: 0.22
Nodes (15): bucketLabel(), Client, DashboardMetricsView, getBarberPerformance(), getDashboardMetrics(), getRevenueChart(), fetchAllRows(), getAppointmentsForExport() (+7 more)

### Community 53 - "public.appointments"
Cohesion: 0.12
Nodes (26): idx_appointments_barber_date, idx_appointments_shop_date, idx_daily_sales_shop_date, on_auth_user_created, on_shops_updated, public.appointments, public.barbers, public.daily_sales (+18 more)

### Community 54 - "health/route.ts"
Cohesion: 0.23
Nodes (9): checkDatabase(), DbStatus, dynamic, GET(), HEAD(), NO_STORE, runtime, version() (+1 more)

### Community 55 - "[locale]/layout.tsx"
Cohesion: 0.16
Nodes (11): @vercel/speed-insights@^2.0.0, @vercel/speed-insights, bdoGrotesk, cairo, generateMetadata(), isSupportedLocale(), RootLayout(), siteUrl() (+3 more)

### Community 56 - "rate-limit.ts"
Cohesion: 0.29
Nodes (10): getServerEnv(), getAdminClient(), hashKey(), memoryLimit(), pruneExpired(), rateLimit(), RateLimitResult, __resetRateLimitClient() (+2 more)

### Community 57 - "Phase 1: Activate Existing But Non-Functional Features"
Cohesion: 0.18
Nodes (11): 1.10 — Settings Tabs, 1.1 — Sales Chart (Real Data), 1.2 — Dashboard Metrics Change Percentages, 1.3 — Analytics Real Data, 1.4 — Calendar "New Booking" Button, 1.5 — Client Actions, 1.6 — Daily Receipt Export, 1.7 — Topbar Search (+3 more)

### Community 58 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 59 - "Halaqy (7ala8i) — UX Enhancement Plan"
Cohesion: 0.20
Nodes (8): By Journey, Current State — What's Actually Undermining the Experience, Design Principles for This Product, Halaqy (7ala8i) — UX Enhancement Plan, Prioritized Roadmap, Tier 0 — Fix Trust & Dead Ends (days, do first), Tier 2 — Signature Enhancements (bigger bets), What NOT to Do Yet

### Community 60 - "sitemap.ts"
Cohesion: 0.27
Nodes (9): listPublicShops(), LOCALES, localizedEntries(), revalidate, ShopRow, sitemap(), siteOrigin(), STATIC_PAGES (+1 more)

### Community 61 - "Halaqy Master Development Plan"
Cohesion: 0.20
Nodes (9): Authentication, Calendar & Bookings (Pending), CRM & KanBan Integration (Pending), Database Setup, Halaqy Master Development Plan, Phase 1 & 2: Frontend Foundation & Component Design, Phase 2.5: UI Polish & Landing Page, Phase 3: Backend Integration (Supabase) (+1 more)

### Community 62 - "Halaqy — Full Project Roadmap"
Cohesion: 0.40
Nodes (5): 2.1 — Services CRUD Page, Feature Status Summary, Halaqy — Full Project Roadmap, Phase 2: New Features — Services Management, Priority Matrix

### Community 63 - "20250101000210_indexes.sql"
Cohesion: 0.12
Nodes (12): idx_appointments_barber, idx_appointments_client, idx_appointments_shop_date, idx_appointments_status, idx_clients_phone, idx_clients_shop, idx_leads_shop_stage, idx_profiles_shop (+4 more)

### Community 64 - "@supabase/supabase-js"
Cohesion: 0.23
Nodes (8): globalSetup(), @supabase/supabase-js@^2.99.0, @supabase/supabase-js, E2E_CUSTOMER, E2E_OWNER, ensureUser(), findUserByEmail(), seedE2E()

### Community 65 - "Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)"
Cohesion: 0.25
Nodes (7): Core tokens (already live in `src/app/globals.css` and `:root`), Do's (from the reference spec), Don'ts, Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference), Old → new color mapping (apply exactly this way — do not invent new hexes), Verification checklist (apply to every file before considering it done), What NOT to change

### Community 66 - "Halaqy — AI Conversation History & Project Summary"
Cohesion: 0.25
Nodes (7): Halaqy — AI Conversation History & Project Summary, 🔜 Next Immediate Steps (Phase 3 Continued), Phase 1 & 2: UI Foundation & Core Components, Phase 2.5: UI Polish & Public Landing Page, Phase 3 (Currently Active): Backend Integration (Supabase), 🚀 Phases Completed, 📅 Project Overview

### Community 67 - "shop-data.ts"
Cohesion: 0.25
Nodes (8): AnyClient, BarberData, ReviewData, ServiceData, SHOP_COLUMNS, ShopData, ShopProfileData, WorkingHourRow

### Community 68 - "public.clients"
Cohesion: 0.21
Nodes (12): public.clients, idx_reviews_rating, idx_reviews_shop_id, public.reviews, idx_clients_auth_user, idx_clients_email_lower, idx_clients_shop_phone_digits, idx_reviews_shop_created (+4 more)

### Community 69 - "next.config.ts"
Cohesion: 0.29
Nodes (4): csp, nextConfig, securityHeaders, supa

### Community 70 - "Phase 6: UI/UX Enhancements"
Cohesion: 0.29
Nodes (7): 6.1 — Booking Engine Polish, 6.2 — Customer Dashboard Polish, 6.3 — Dashboard Polish, 6.4 — Responsive & Mobile, 6.5 — Loading & Error States, 6.6 — Accessibility, Phase 6: UI/UX Enhancements

### Community 71 - "instrumentation.ts"
Cohesion: 0.38
Nodes (5): headerValue(), onRequestError(), RequestErrorContext, RequestInfo, safePath()

### Community 72 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 73 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.1.6, eslint, eslint-config-next

### Community 74 - "Phase 0: Critical Fixes (Broken/Non-Functional)"
Cohesion: 0.33
Nodes (6): 0.1 — Fix Database Migration Inconsistencies, 0.2 — Fix Workspace Store Hydration, 0.3 — Fix Leads Store Hydration, 0.4 — Fix Dashboard Upcoming Appointments, 0.5 — Fix Landing Page Links, Phase 0: Critical Fixes (Broken/Non-Functional)

### Community 75 - "idempotency.ts"
Cohesion: 0.40
Nodes (4): Entry, prune(), runIdempotent(), store

### Community 76 - "landing/page.tsx"
Cohesion: 0.32
Nodes (13): BackgroundVideo(), LandingShell(), shouldStream(), Eyebrow(), generateMetadata(), headingTracking(), Headline(), LandingPage() (+5 more)

### Community 77 - "auth.users"
Cohesion: 0.18
Nodes (5): public.link_customer_client(), on_auth_user_created, public.cancel_customer_booking(), public.create_public_booking(), public.link_customer_client()

### Community 78 - "vite-tsconfig-paths"
Cohesion: 0.40
Nodes (4): vite-tsconfig-paths@^6.1.1, @vitejs/plugin-react@^6.0.5, vite-tsconfig-paths, @vitejs/plugin-react

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

### Community 85 - "20250101001800_private_columns_and_verified_links.sql"
Cohesion: 0.25
Nodes (4): public.get_my_shop_private(), public.get_profile_phones(), public.shop_daily_goal(), public.verified_identity()

### Community 86 - "20250101000900_notifications.sql"
Cohesion: 0.27
Nodes (8): idx_notifications_user_id, public.notifications, public.notify_client_on_appointment_status(), public.notify_shop_on_appointment(), trigger_notify_client_on_appointment_status, trigger_notify_shop_on_appointment, idx_notifications_user_unread, public.notify_shop_on_appointment()

### Community 88 - "public.invites"
Cohesion: 0.36
Nodes (6): idx_invites_token, public.accept_invite(), public.get_invite_by_token(), public.invites, idx_invites_shop, public.get_invite_by_token()

### Community 126 - "public.barber_services"
Cohesion: 0.33
Nodes (5): public.services, public.barber_services, idx_barber_services_service, public.barber_offers_services(), public.seed_staff_defaults()

### Community 127 - "route.full.test.ts"
Cohesion: 0.25
Nodes (6): bookingResult, fromMock, getUserMock, rateLimitMock, rpcMock, validPayload

### Community 128 - "Phase 3: New Features — Team Management"
Cohesion: 0.50
Nodes (4): 3.1 — Invite System, 3.2 — Team Page in Settings, 3.3 — Barber Dashboard View, Phase 3: New Features — Team Management

### Community 129 - "vitest"
Cohesion: 0.18
Nodes (7): vitest, rateLimitMock, rpcMock, createBrowserClientMock, CookieMethods, cookieStore, createServerClientMock

### Community 130 - "public.payments"
Cohesion: 0.83
Nodes (3): idx_payments_appointment, idx_payments_shop_created, public.payments

### Community 138 - "dialog.test.tsx"
Cohesion: 0.33
Nodes (4): @testing-library/react@^16.3.2, @testing-library/user-event@^14.6.4, @testing-library/react, @testing-library/user-event

### Community 139 - "book/[shop_id]/page.tsx"
Cohesion: 0.47
Nodes (5): BookingShopPage(), generateMetadata(), getShopName, Params, MOCK_DATA_ENABLED

### Community 140 - "robots.ts"
Cohesion: 0.67
Nodes (3): PRIVATE_PATHS, robots(), siteOrigin()

### Community 141 - "use-supabase-query.ts"
Cohesion: 0.50
Nodes (3): QueryFnResult, QueryOptions, QueryState

## Knowledge Gaps
- **3 isolated node(s):** `RFC-4180`, `RFC-5545`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 786 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `createClient` to `toast.tsx`, `shop-profile-client.tsx`, `useTranslation`, `booking-utils.ts`, `toast.tsx`, `useWorkspaceStore`, `interpolate`, `book/[shop_id]/page.tsx`, `robots.ts`, `dependencies`, `booking/route.ts`, `devDependencies`, `kanban-board.tsx`, `middleware.ts`, `analytics/page.tsx`, `api-helpers.ts`, `clients/page.tsx`, `legal-page.tsx`, `en.ts`, `settings-page.tsx`, `EmptyState`, `timeline-view.tsx`, `health/route.ts`, `[locale]/layout.tsx`, `sitemap.ts`, `next.config.ts`, `landing/page.tsx`, `accept/route.test.ts`, `route.full.test.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useTranslation()` (e.g. with `Architecture` and `Current State — What's Actually Undermining the Experience`) actually correct?**
  _`useTranslation()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `RFC-5545`, `RFC-4180` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05197920831667333 - nodes in this community are weakly interconnected._
- **Why does `useTranslation()` connect `createClient` to `toast.tsx`, `shop-profile-client.tsx`, `useTranslation`, `booking-utils.ts`, `dialog.tsx`, `toast.tsx`, `useWorkspaceStore`, `interpolate`, `my-day/page.tsx`, `use-services.ts`, `team/page.tsx`, `kanban-board.tsx`, `analytics/page.tsx`, `clients/page.tsx`, `cn`, `cn`, `settings-page.tsx`, `EmptyState`, `timeline-view.tsx`, `Halaqy (7ala8i) — UX Enhancement Plan`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `toast.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1036734693877551 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `createClient`, `clients.ts`, `toast.tsx`, `shop-profile-client.tsx`, `useTranslation`, `booking-utils.ts`, `toast.tsx`, `useWorkspaceStore`, `interpolate`, `dialog.test.tsx`, `i18n.test.ts`, `validations.ts`, `vitest`, `devDependencies`, `use-services.ts`, `kanban-board.tsx`, `middleware.ts`, `mock-data.ts`, `api-helpers.ts`, `cn`, `settings-page.tsx`, `EmptyState`, `analytics-page.ts`, `env.ts`, `search.ts`, `timeline-view.tsx`, `analytics.ts`, `health/route.ts`, `rate-limit.ts`, `vite-tsconfig-paths`, `accept/route.test.ts`, `route.full.test.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._