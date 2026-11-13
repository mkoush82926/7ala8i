# Graph Report - 7ala8i  (2026-11-13)

## Corpus Check
- 438 files · ~348,986 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .woff2 7, (none) 5, .css 2)

## Summary
- 3324 nodes · 9702 edges · 188 communities (132 shown, 56 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `87590663`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth/signup/page.tsx
- interpolate
- booking/route.ts
- interpolate
- utils.ts
- booking-utils.ts
- with
- use-appointments.ts
- Halaqy Build Roadmap: Fresha-level capability, built for Jordan
- format.ts
- react
- validations.ts
- authErrorKey
- leads-store.ts
- analytics-page.ts
- Halaqy (حلقي)
- dependencies
- checkout-dialog.tsx
- package.json
- MockQueryBuilder
- index.ts
- 20250101001950_availability_engine.sql
- useWorkspaceStore
- middleware.ts
- mock-data.ts
- date-overrides-panel.tsx
- analytics-charts.tsx
- database.types.ts
- api-helpers.ts
- sidebar.tsx
- legal-page.tsx
- scripts
- compilerOptions
- Supabase
- rehearse-prod-upgrade.sh
- en.ts
- use-pos.ts
- Changelog
- 4. Functional History by Phase
- auth/actions.ts
- Changelog
- Writing Guidelines for Postgres References
- settings-page.tsx
- toast.tsx
- 20250101001600_production_hardening.sql
- next
- env.ts
- share-screen.tsx
- 20250101000100_initial_schema.sql
- timeline-view.tsx
- createQueryBuilder
- AppointmentStatus
- shop-data.ts
- [locale]/layout.tsx
- rate-limit.ts
- Phase 1: Activate Existing But Non-Functional Features
- Section Definitions
- Halaqy (7ala8i) — UX Enhancement Plan
- sitemap.ts
- config.ts
- Halaqy — Full Project Roadmap
- 20250101000210_indexes.sql
- public.shops
- Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)
- Halaqy — AI Conversation History & Project Summary
- booking/step-services.tsx
- shop-profile-client.tsx
- cn
- Phase 6: UI/UX Enhancements
- error-reporting.ts
- Supabase Postgres Best Practices
- eslint.config.mjs
- analytics.ts
- payments-logic.ts
- landing/page.tsx
- queries/services.ts
- fixtures.ts
- Phase 4: New Features — Customer Portal Enhancements
- TaxSettings
- Phase 7: Auth & Security Enhancements
- Phase 8: Performance & SEO
- Phase 9: Deployment & DevOps
- services-section.tsx
- 20250101002500_hours_checkout.sql
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
- public.profiles
- create/route.ts
- barbershop.ts
- step-location.tsx
- public.payments
- pg_temp.enum_column_to_text
- booking-state.ts
- shop/[shop_id]/page.tsx
- use-pos.test.ts
- go-live-db.sh
- run.sh
- media.ts
- wizard.ts
- hours-settings.tsx
- map.ts
- profile-form.ts
- publish-panel.tsx
- start-wizard.tsx
- step-time.tsx
- 20250101002300_booking_v2.sql
- public.complete_appointment_sale
- barber-profile-client.tsx
- analytics-period.ts
- step-review.tsx
- clients.ts
- photos-manager.tsx
- cn
- step-team.tsx
- search.ts
- instrumentation.ts
- health/route.ts
- start/page.tsx
- recurrence.ts
- lead-csv.ts
- booking/route.ts
- messaging-stub.ts
- location-map.tsx
- step-account.tsx
- helpers.ts
- checkout-dialog.tsx
- notification-bell.test.ts
- explore-utils.ts
- otp-panel.tsx
- seed-e2e.mjs
- Halaqy Master Development Plan
- Phase 5: New Features — Notifications & Communication
- use-booking-data.ts
- join/page.tsx
- Phase 3: New Features — Team Management
- Phase 0: Critical Fixes (Broken/Non-Functional)
- cancel/route.test.ts
- mask.ts
- server.test.ts

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 256 edges
2. `cn()` - 151 edges
3. `react` - 135 edges
4. `interpolate()` - 129 edges
5. `next` - 94 edges
6. `lucide-react` - 90 edges
7. `createClient()` - 78 edges
8. `useWorkspaceStore` - 77 edges
9. `EmptyState()` - 75 edges
10. `vitest` - 73 edges

## Surprising Connections (you probably didn't know these)
- `0.1 — Fix Database Migration Inconsistencies` --references--> `UserRole`  [INFERRED]
  PLAN.md → src/lib/types.ts
- `Phase 5 — POS & Payments (Pay in Shop Only)` --references--> `useDashboardMetrics()`  [INFERRED]
  PROJECT_HISTORY.md → src/hooks/use-dashboard-data.ts
- `7. Monitoring` --references--> `logServerError()`  [INFERRED]
  docs/DEPLOYMENT.md → src/lib/api-helpers.ts
- `6. Guidelines for Future Changes (for any AI)` --references--> `rateLimit()`  [INFERRED]
  PROJECT_HISTORY.md → src/lib/rate-limit.ts
- `Authentication` --references--> `signup()`  [INFERRED]
  TODO.md → src/app/[locale]/auth/actions.ts

## Import Cycles
- None detected.

## Communities (188 total, 56 thin omitted)

### Community 0 - "auth/signup/page.tsx"
Cohesion: 0.18
Nodes (28): isAuthErrorKey(), AuthAlert(), AuthCard(), AuthField(), AuthFieldProps, AuthFootnote(), AuthHeader(), AuthHeaderProps (+20 more)

### Community 1 - "interpolate"
Cohesion: 0.12
Nodes (21): react-dom, Lightbox(), LightboxImage, mosaicSpan(), PhotoGallery(), notify(), DialogProps, DialogSize (+13 more)

### Community 2 - "booking/route.ts"
Cohesion: 0.09
Nodes (21): Entry, parseIdempotencyKey(), prune(), runIdempotent(), store, CreateOutcome, booking, ENV_KEYS (+13 more)

### Community 3 - "interpolate"
Cohesion: 0.13
Nodes (27): AppointmentDetail, BookingDetailPage(), confirmCancel(), AppointmentLike, AppointmentTab, CancelBlockReason, CancellationState, cancellationState() (+19 more)

### Community 4 - "utils.ts"
Cohesion: 0.07
Nodes (61): Architecture, AnalyticsPage(), handleExport(), ChangePill(), DAY_ORDER, heatColor(), PERIODS, RevenueTrendChart (+53 more)

### Community 5 - "booking-utils.ts"
Cohesion: 0.09
Nodes (42): addDaysToDateStr(), BarberCapability, barberOffersServices(), barberWindow(), bookingReference(), buildIcs(), BusyRow, CalendarEvent (+34 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (42): name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, continue-on-error (+34 more)

### Community 7 - "use-appointments.ts"
Cohesion: 0.15
Nodes (23): handleSubmit(), AppointmentFormDialogProps, AppointmentActionError, toCalendarAppointment(), useAppointments(), APPOINTMENT_COLUMNS, Client, completeAppointmentSale() (+15 more)

### Community 8 - "Halaqy Build Roadmap: Fresha-level capability, built for Jordan"
Cohesion: 0.06
Nodes (32): 1. Executive summary, 2. Design and UX upgrade principles (Ink & Brass, not Fresha), 3. Day-0 owner actions and open decisions, 4. Phased roadmap, 5. Out of scope until the owner provides external accounts, 6. Explicitly deprioritised, 7. Feature parity matrix, Decisions needed before the named workstream starts (+24 more)

### Community 9 - "format.ts"
Cohesion: 0.19
Nodes (23): Price(), PriceProps, CashRounding, DIGIT_PREFERENCE_COOKIE, DIGIT_PREFERENCES, DigitPreference, formatJOD(), FormatJODOptions (+15 more)

### Community 10 - "react"
Cohesion: 0.13
Nodes (27): @dnd-kit/sortable, LeadsPage(), errorText(), DragPreview, isStage(), KanbanBoard(), handleDragEnd(), handleImportFileChange() (+19 more)

### Community 11 - "validations.ts"
Cohesion: 0.07
Nodes (32): AppointmentStatusSchema, AvailabilityQuerySchema, BookingInput, BookingSchema, CancelBookingInput, CancelBookingSchema, CompleteSaleInput, CompleteSaleSchema (+24 more)

### Community 12 - "authErrorKey"
Cohesion: 0.17
Nodes (20): AuthActionResult, AUTH_ERROR_KEYS, AuthErrorKey, authErrorKey(), AuthErrorLike, isValidEmail(), isValidPhone(), MIN_PASSWORD_LENGTH (+12 more)

### Community 13 - "leads-store.ts"
Cohesion: 0.12
Nodes (27): Client, createLead(), createLeads(), deleteLead(), deleteLeads(), getLeads(), LEAD_COLUMNS, LeadWrite (+19 more)

### Community 14 - "analytics-page.ts"
Cohesion: 0.13
Nodes (18): AnalyticsData, Builder, csvCell(), ExportRow, getFullAnalytics(), MAX_ROWS, MetricDelta, normalizeSource() (+10 more)

### Community 15 - "Halaqy (حلقي)"
Cohesion: 0.07
Nodes (25): 1. Environment variables (Vercel → Project → Settings → Environment Variables), 2. Vercel project, 3. Database, 4. Supabase Auth (Dashboard → Authentication), 5. Rate limiting and abuse, 6. Backups and recovery, 7. Monitoring, 8. Release smoke test (production, after each deploy) (+17 more)

### Community 16 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, adhan@^4.4.6, clsx@^2.1.1, date-fns@^4.1.0, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, framer-motion@^12.35.2 (+19 more)

### Community 17 - "checkout-dialog.tsx"
Cohesion: 0.24
Nodes (14): AddItem(), add(), CartLineRow(), CheckoutDialog(), DiscountEditor(), PaymentsEditor(), addSplit(), Row() (+6 more)

### Community 18 - "package.json"
Cohesion: 0.06
Nodes (42): devDependencies, husky@^9.1.7, jsdom@^30.0.1, lint-staged@^17.3.0, @playwright/test@^1.62.1, supabase@^2.114.0, tailwindcss@^4, @tailwindcss/postcss@^4 (+34 more)

### Community 21 - "index.ts"
Cohesion: 0.16
Nodes (27): AvailabilityError, availabilityErrorCode(), dayPartOf(), daySpan(), getAvailableSlots(), groupSlotsByDate(), groupSlotsByDayPart(), isSlotBookable() (+19 more)

### Community 22 - "20250101001950_availability_engine.sql"
Cohesion: 0.08
Nodes (32): public.barber_services, idx_barber_services_service, public.barber_offers_services(), guard_profile_booking_flags, idx_appointments_shop_unassigned, idx_blocked_time_types_shop, idx_blocked_times_barber_time, idx_blocked_times_series (+24 more)

### Community 23 - "useWorkspaceStore"
Cohesion: 0.08
Nodes (58): date-fns, isResolved(), MyDayPage(), confirmCheckout(), confirmPending(), setOverride(), Pending, DashboardPage() (+50 more)

### Community 24 - "middleware.ts"
Cohesion: 0.13
Nodes (20): @supabase/ssr@^0.9.0, @supabase/ssr, MOCK_AUTH_ROLE, ADMIN_ONLY_ROUTES, AppRole, config, CUSTOMER_ROUTES, isLocale() (+12 more)

### Community 25 - "mock-data.ts"
Cohesion: 0.07
Nodes (32): MOCK_ADMIN_ID, MOCK_ADMIN_PROFILE, MOCK_APPOINTMENTS, MOCK_BARBERS, MOCK_CLIENTS, MOCK_PROFILES, MOCK_REVIEWS, MOCK_SERVICE_SEED (+24 more)

### Community 26 - "date-overrides-panel.tsx"
Cohesion: 0.09
Nodes (53): lucide-react, react, KIND_ICON, ProductRow, AffectedAppointments(), ApptRow, changeBounds(), buildClosureNotices() (+45 more)

### Community 27 - "analytics-charts.tsx"
Cohesion: 0.20
Nodes (7): recharts@^3.8.0, recharts, RevenuePoint, RevenueTrendChartProps, SLICE_COLORS, SourceSlice, tick

### Community 28 - "database.types.ts"
Cohesion: 0.09
Nodes (23): Appt, Appt, MockAppointment, BookingResult, BusySlot, CompleteSaleResult, CompositeTypes, Constants (+15 more)

### Community 29 - "api-helpers.ts"
Cohesion: 0.10
Nodes (45): POST(), POST(), GET(), callRpc(), callRpcLoose(), FunctionName, RescheduleSchema, POST (+37 more)

### Community 30 - "sidebar.tsx"
Cohesion: 0.13
Nodes (33): DashboardLayout(), ADMIN, canAccessPath(), findNavItem(), homePathFor(), isNavActive(), NAV_ITEMS, NavId (+25 more)

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
Nodes (8): ExplorePage(), ar, DeepStringRecord, en, flatAr, flatEn, flatten(), Tree

### Community 37 - "use-pos.ts"
Cohesion: 0.09
Nodes (26): CartIssue, CartItemKind, CartLineTotals, CartPayment, CartSettings, CartTip, CartTotals, CheckoutOptions (+18 more)

### Community 38 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 39 - "4. Functional History by Phase"
Cohesion: 0.12
Nodes (16): 1. Technology Stack & Architecture, 2.1 Supabase, 2.2 Vercel, 2. External Services & Configuration, 3. Auth Model, Roles & Security, 4. Functional History by Phase, 5. Running & Developing Locally, 6. Guidelines for Future Changes (for any AI) (+8 more)

### Community 40 - "auth/actions.ts"
Cohesion: 0.26
Nodes (13): clientIp(), login(), logout(), signup(), GET(), AUTH_LOCALES, AuthLocale, localizePath() (+5 more)

### Community 41 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 42 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 43 - "settings-page.tsx"
Cohesion: 0.09
Nodes (45): copyDayToWorkingDays(), CURRENCIES, DayHours, DayHoursError, DEFAULT_DAY, FieldError, hhmm(), isFormDirty() (+37 more)

### Community 45 - "toast.tsx"
Cohesion: 0.06
Nodes (44): @testing-library/react@^16.3.2, @testing-library/react, builder(), b, rpc, searchParams, slotRow(), tables (+36 more)

### Community 46 - "20250101001600_production_hardening.sql"
Cohesion: 0.05
Nodes (51): public.appointments, public.clients, idx_reviews_rating, idx_reviews_shop_id, public.reviews, idx_notifications_user_id, public.notifications, public.notify_client_on_appointment_status() (+43 more)

### Community 47 - "next"
Cohesion: 0.07
Nodes (10): csp, nextConfig, securityHeaders, supa, next, decodeSafe(), ShortShopLink(), PRIVATE_PATHS (+2 more)

### Community 48 - "env.ts"
Cohesion: 0.14
Nodes (13): zod, EnvSource, IS_PRODUCTION, MOCK_ALLOWED, MOCK_AUTH_ROLE, MOCK_ROLES, MockAuthRole, optionalUrl (+5 more)

### Community 49 - "share-screen.tsx"
Cohesion: 0.18
Nodes (13): noopSubscribe(), ShareScreen(), downloadQr(), bookingLink(), bookingLinkPath(), qrFileName(), whatsappShareUrl(), handleCopy() (+5 more)

### Community 50 - "20250101000100_initial_schema.sql"
Cohesion: 0.19
Nodes (12): idx_appointments_barber_date, idx_appointments_shop_date, idx_daily_sales_shop_date, on_auth_user_created, on_shops_updated, public.barbers, public.daily_sales, public.get_user_shop_id() (+4 more)

### Community 51 - "timeline-view.tsx"
Cohesion: 0.08
Nodes (46): framer-motion, CalendarPage(), AppointmentDetailsDialog(), AppointmentDetailsDialogProps, AppointmentForm(), AppointmentFormDefaults, AppointmentFormDialog(), roundedNow() (+38 more)

### Community 52 - "createQueryBuilder"
Cohesion: 0.10
Nodes (20): vitest, bookingResult, fromMock, getUserMock, rateLimitMock, rpcMock, validPayload, apptBuilder() (+12 more)

### Community 53 - "AppointmentStatus"
Cohesion: 0.16
Nodes (12): AuthContext, WithAuthOptions, Appointment, ClientRecord, DailySale, Database, Json, Lead (+4 more)

### Community 54 - "shop-data.ts"
Cohesion: 0.11
Nodes (37): BarberProfileData, BarberProfileResult, BarberReview, loadBarberProfile(), Row, servicesForBarber(), AnyClient, BARBER_COLUMNS (+29 more)

### Community 55 - "[locale]/layout.tsx"
Cohesion: 0.16
Nodes (11): @vercel/speed-insights@^2.0.0, @vercel/speed-insights, bdoGrotesk, cairo, generateMetadata(), isSupportedLocale(), RootLayout(), siteUrl() (+3 more)

### Community 56 - "rate-limit.ts"
Cohesion: 0.20
Nodes (15): getServerEnv(), getAdminClient(), hashKey(), memoryLimit(), pruneExpired(), RATE_LIMITS, rateLimit(), rateLimitAll() (+7 more)

### Community 57 - "Phase 1: Activate Existing But Non-Functional Features"
Cohesion: 0.18
Nodes (11): 1.10 — Settings Tabs, 1.1 — Sales Chart (Real Data), 1.2 — Dashboard Metrics Change Percentages, 1.3 — Analytics Real Data, 1.4 — Calendar "New Booking" Button, 1.5 — Client Actions, 1.6 — Daily Receipt Export, 1.7 — Topbar Search (+3 more)

### Community 58 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 59 - "Halaqy (7ala8i) — UX Enhancement Plan"
Cohesion: 0.33
Nodes (4): By Journey, Design Principles for This Product, Halaqy (7ala8i) — UX Enhancement Plan, What NOT to Do Yet

### Community 60 - "sitemap.ts"
Cohesion: 0.21
Nodes (13): anonRows(), BarberRow, listPublicBarbers(), listPublicShops(), LOCALES, localizedEntries(), pathEntries(), revalidate (+5 more)

### Community 61 - "config.ts"
Cohesion: 0.10
Nodes (37): POST(), runtime, BookingShell(), BookingShopPage(), generateMetadata(), getShop, Params, ShopRef (+29 more)

### Community 62 - "Halaqy — Full Project Roadmap"
Cohesion: 0.40
Nodes (5): 2.1 — Services CRUD Page, Feature Status Summary, Halaqy — Full Project Roadmap, Phase 2: New Features — Services Management, Priority Matrix

### Community 63 - "20250101000210_indexes.sql"
Cohesion: 0.12
Nodes (12): idx_appointments_barber, idx_appointments_client, idx_appointments_shop_date, idx_appointments_status, idx_clients_phone, idx_clients_shop, idx_leads_shop_stage, idx_profiles_shop (+4 more)

### Community 64 - "public.shops"
Cohesion: 0.06
Nodes (34): public.shops, idx_daily_sales_shop_date, public.daily_sales, public.dashboard_metrics(), public.get_my_shop_private(), public.get_profile_phones(), public.shop_daily_goal(), public.verified_identity() (+26 more)

### Community 65 - "Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)"
Cohesion: 0.25
Nodes (7): Core tokens (already live in `src/app/globals.css` and `:root`), Do's (from the reference spec), Don'ts, Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference), Old → new color mapping (apply exactly this way — do not invent new hexes), Verification checklist (apply to every file before considering it done), What NOT to change

### Community 66 - "Halaqy — AI Conversation History & Project Summary"
Cohesion: 0.25
Nodes (7): Halaqy — AI Conversation History & Project Summary, 🔜 Next Immediate Steps (Phase 3 Continued), Phase 1 & 2: UI Foundation & Core Components, Phase 2.5: UI Polish & Public Landing Page, Phase 3 (Currently Active): Backend Integration (Supabase), 🚀 Phases Completed, 📅 Project Overview

### Community 67 - "booking/step-services.tsx"
Cohesion: 0.18
Nodes (17): money(), PriceLabels, serviceDurationLabel(), servicePriceLabel(), PriceType, HEURISTIC_ORDER, StepServices(), Tab (+9 more)

### Community 68 - "shop-profile-client.tsx"
Cohesion: 0.12
Nodes (31): ContactList(), HoursCard(), RatingBar(), SectionHeading(), ShopPageSkeleton(), ShopProfileClient(), computeWeeklyHours(), COVER_PALETTE (+23 more)

### Community 69 - "cn"
Cohesion: 0.12
Nodes (29): @dnd-kit/core, renderActions(), BookingRulesDialog(), ServiceRow(), ServiceRowBody(), ServicesPage(), SortableServiceRow(), SettingsRoute() (+21 more)

### Community 70 - "Phase 6: UI/UX Enhancements"
Cohesion: 0.29
Nodes (7): 6.1 — Booking Engine Polish, 6.2 — Customer Dashboard Polish, 6.3 — Dashboard Polish, 6.4 — Responsive & Mobile, 6.5 — Loading & Error States, 6.6 — Accessibility, Phase 6: UI/UX Enhancements

### Community 71 - "error-reporting.ts"
Cohesion: 0.25
Nodes (12): C, detectLocale(), GlobalError(), buildEnvelope(), envelopeUrl(), ErrorContext, isErrorReportingEnabled(), ParsedDsn (+4 more)

### Community 72 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 73 - "eslint.config.mjs"
Cohesion: 0.22
Nodes (7): CLASS_CALLEES, eslintConfig, halaqyPlugin, eslint@^9, eslint-config-next@16.1.6, eslint, eslint-config-next

### Community 74 - "analytics.ts"
Cohesion: 0.25
Nodes (14): bucketLabel(), Client, DashboardMetricsView, getBarberPerformance(), getDashboardMetrics(), getRevenueChart(), fetchAllRows(), getAppointmentsForExport() (+6 more)

### Community 75 - "payments-logic.ts"
Cohesion: 0.20
Nodes (12): METHOD_CODE_RE, METHOD_KINDS, methodCodeFor(), MethodDraft, MethodIssue, MethodKind, ProductDraft, ProductIssue (+4 more)

### Community 76 - "landing/page.tsx"
Cohesion: 0.25
Nodes (16): BackgroundVideo(), LandingNav(), LandingShell(), shouldStream(), useViewer(), Viewer, Eyebrow(), generateMetadata() (+8 more)

### Community 77 - "queries/services.ts"
Cohesion: 0.06
Nodes (77): submit(), ServiceRowProps, confirmDelete(), handleSave(), ICONS, segBtn(), ServiceEditor(), ServiceEditorBody() (+69 more)

### Community 78 - "fixtures.ts"
Cohesion: 0.16
Nodes (14): BLOCKING_IMPACTS, checkA11y(), DYNAMIC_SELECTORS, expectDirection(), Fixtures, gotoLocale(), Locale, LOCALES (+6 more)

### Community 79 - "Phase 4: New Features — Customer Portal Enhancements"
Cohesion: 0.40
Nodes (5): 4.1 — Customer Profile Edit, 4.2 — Rebook from History, 4.3 — Cancel/Reschedule, 4.4 — Favorite Shops, Phase 4: New Features — Customer Portal Enhancements

### Community 80 - "TaxSettings"
Cohesion: 0.28
Nodes (14): CASH_ROUNDING_STEPS, CashRoundingStep, inclusiveTax(), normalizePrefix(), normalizeTaxNumber(), parseRate(), receiptNumberPreview(), TaxDraft (+6 more)

### Community 81 - "Phase 7: Auth & Security Enhancements"
Cohesion: 0.50
Nodes (4): 7.1 — Password Reset Flow, 7.2 — Email Verification, 7.3 — Rate Limiting, Phase 7: Auth & Security Enhancements

### Community 82 - "Phase 8: Performance & SEO"
Cohesion: 0.50
Nodes (4): 8.1 — Performance, 8.2 — SEO, 8.3 — PWA (Progressive Web App), Phase 8: Performance & SEO

### Community 83 - "Phase 9: Deployment & DevOps"
Cohesion: 0.50
Nodes (4): 9.1 — Vercel Deployment, 9.2 — CI/CD, 9.3 — Monitoring, Phase 9: Deployment & DevOps

### Community 84 - "services-section.tsx"
Cohesion: 0.24
Nodes (13): barberBookingHref(), groupServicesByCategory(), ServicesSection(), BOOKING_ENTRIES, BookingCta(), BookingCtaProps, BookingCtaVariant, BookingEntry (+5 more)

### Community 86 - "20250101002500_hours_checkout.sql"
Cohesion: 0.12
Nodes (32): guard_payment_method_update, idx_payment_methods_shop, idx_products_shop, idx_sale_items_sale, idx_sale_items_shop, idx_sale_payments_sale, idx_sale_payments_shop, idx_sale_tips_barber (+24 more)

### Community 88 - "public.invites"
Cohesion: 0.36
Nodes (6): idx_invites_token, public.accept_invite(), public.get_invite_by_token(), public.invites, idx_invites_shop, public.get_invite_by_token()

### Community 126 - "public.profiles"
Cohesion: 0.08
Nodes (31): public.profiles, public.services, public.get_current_shop_id(), public.get_current_shop_id(), public.working_hours, public.current_profile_shop_and_role(), guard_last_shop_admin, idx_working_hours_barber (+23 more)

### Community 127 - "create/route.ts"
Cohesion: 0.29
Nodes (5): getUserMock, insertMock, inviteSingle, profileSingle, rateLimitMock

### Community 128 - "barbershop.ts"
Cohesion: 0.10
Nodes (29): DayRow(), END_TIMES, samePreset(), StepHours(), TIMES, Switch(), BARBERSHOP_SERVICES, day() (+21 more)

### Community 129 - "step-location.tsx"
Cohesion: 0.17
Nodes (22): AMMAN, LocationMap, StepLocation(), locateMe(), pickArea(), pickCity(), setLoc(), StepPublish() (+14 more)

### Community 130 - "public.payments"
Cohesion: 0.83
Nodes (3): idx_payments_appointment, idx_payments_shop_created, public.payments

### Community 138 - "booking-state.ts"
Cohesion: 0.09
Nodes (43): BOOKING_CSS, BookingEngine(), BookingResultLike, RescheduleRow, SubmitOutcome, toOutcome(), barberSurcharge(), BookingPayloadInput (+35 more)

### Community 139 - "shop/[shop_id]/page.tsx"
Cohesion: 0.13
Nodes (33): BarberPage(), fill(), generateMetadata(), getBarber, Params, Search, fill(), generateMetadata() (+25 more)

### Community 141 - "use-pos.test.ts"
Cohesion: 0.23
Nodes (14): charge(), clearStagedCart(), computeCartTotals(), discountFils(), fromFils(), getStagedCart(), resolvePaymentDrafts(), stageCheckoutCart() (+6 more)

### Community 145 - "media.ts"
Cohesion: 0.13
Nodes (23): @supabase/supabase-js, ACCEPTED_IMAGE_TYPES, AVATAR_MAX_EDGE, centerCrop(), fitWithin(), ImageFileError, MAX_PORTFOLIO_ITEMS, MAX_SHOP_PHOTOS (+15 more)

### Community 146 - "wizard.ts"
Cohesion: 0.16
Nodes (19): blank(), buildPayload(), createDraft(), hasArabic(), idOrNull(), num(), PayloadContext, restoreDraft() (+11 more)

### Community 147 - "hours-settings.tsx"
Cohesion: 0.07
Nodes (54): HijriDateField(), ExceptionKind, groupSpecialRows(), MAX_CLOSURE_DAYS, MAX_SPECIAL_DAYS, presetDefaults(), RangeIssue, resolvePreset() (+46 more)

### Community 148 - "map.ts"
Cohesion: 0.24
Nodes (21): AMMAN_CENTER, clampZoom(), googleMapsDirectionsUrl(), isValidLatLng(), LatLng, MapTile, MAX_ZOOM, MIN_ZOOM (+13 more)

### Community 149 - "profile-form.ts"
Cohesion: 0.12
Nodes (40): pathFromPublicUrl(), LATIN_SLUG_RE, normalizeHandle(), Amenity, UploadError, BarberForm, barberFormFromRow(), barberPatch() (+32 more)

### Community 150 - "publish-panel.tsx"
Cohesion: 0.15
Nodes (18): CHECKLIST, CHECKLIST_KEYS, ChecklistItemDef, ChecklistKey, ChecklistState, ChecklistSummary, parseIncompleteDetail(), summarizeChecklist() (+10 more)

### Community 151 - "start-wizard.tsx"
Cohesion: 0.25
Nodes (17): Wizard(), addressLine(), back(), focusHeading(), goTo(), next(), publish(), firstInvalidStep() (+9 more)

### Community 152 - "step-time.tsx"
Cohesion: 0.20
Nodes (13): nextSlotLabel(), surchargeLabel(), dateRange(), BarberAvatar(), ChipsSkeleton(), InlineAlert(), SelectedMark(), NextMap (+5 more)

### Community 153 - "20250101002300_booking_v2.sql"
Cohesion: 0.14
Nodes (18): appointment_services_sync, idx_appointment_services_appt, idx_appointment_services_shop, idx_booking_attribution_shop, idx_phone_verifications_phone, idx_service_variants_service, idx_service_variants_shop, public.appointment_services (+10 more)

### Community 154 - "public.complete_appointment_sale"
Cohesion: 0.10
Nodes (8): public.can_write_shop_media(), public.get_shop_publish_checklist(), public.appointment_cart_lines(), public.complete_appointment_sale(), public.onboarding_progress, public.onboarding_shop_eligible(), public.save_onboarding_progress(), set_updated_at

### Community 155 - "barber-profile-client.tsx"
Cohesion: 0.14
Nodes (23): BarberProfileClient(), BarberSkeleton(), languageName(), localizedText(), minPrice(), PortfolioItem, dayDiff(), localDateIn() (+15 more)

### Community 156 - "analytics-period.ts"
Cohesion: 0.24
Nodes (16): addDays(), bucketKeyOf(), dayKey(), DEFAULT_TIMEZONE, formatterCache, getPeriodRange(), monthKey(), offsetMs() (+8 more)

### Community 157 - "step-review.tsx"
Cohesion: 0.23
Nodes (13): appendChip(), BarberServiceRow, freeCancellationUntil(), Line, NOTE_CHIPS, renderTemplate(), OtpState, ReviewProps (+5 more)

### Community 158 - "clients.ts"
Cohesion: 0.25
Nodes (14): useClients(), cleanClientInput(), Client, CLIENT_COLUMNS, ClientAppointmentRow, createClientRecord(), getClientAppointments(), getClients() (+6 more)

### Community 159 - "photos-manager.tsx"
Cohesion: 0.15
Nodes (29): PublicProfileRoute(), changedOrder(), isOptimizableUrl(), moveItem(), removeShopMedia(), IconButton(), PhotosManager(), PortfolioEditor() (+21 more)

### Community 160 - "cn"
Cohesion: 0.09
Nodes (46): AVATAR_TONES, ClientDrawer(), ClientFormDialog(), ClientListItem(), ClientsPage(), ClientsView(), codeMessage(), ContactField() (+38 more)

### Community 161 - "step-team.tsx"
Cohesion: 0.16
Nodes (16): StepServices(), addCustom(), BarberRow(), pick(), StepTeam(), add(), remove(), setBarbers() (+8 more)

### Community 162 - "search.ts"
Cohesion: 0.35
Nodes (12): clientSearchFilter(), buildIlikeOrFilter(), Client, containsPattern(), EMPTY_RESULT, escapeLikePattern(), MAX_SEARCH_LENGTH, normalizeSearchTerm() (+4 more)

### Community 163 - "instrumentation.ts"
Cohesion: 0.38
Nodes (5): headerValue(), onRequestError(), RequestErrorContext, RequestInfo, safePath()

### Community 164 - "health/route.ts"
Cohesion: 0.23
Nodes (9): checkDatabase(), DbStatus, dynamic, GET(), HEAD(), NO_STORE, runtime, version() (+1 more)

### Community 165 - "start/page.tsx"
Cohesion: 0.17
Nodes (16): AreaOption, CityOption, Frame(), RpcClient, SaveState, StartWizard(), StartWizardProps, OnboardingState (+8 more)

### Community 166 - "recurrence.ts"
Cohesion: 0.33
Nodes (8): RFC-5545, DAY_CODES, expandRecurrence(), fromUtcDay(), MAX_OCCURRENCES, parseRrule(), RecurrenceRule, toUtcDay()

### Community 167 - "lead-csv.ts"
Cohesion: 0.39
Nodes (6): clean(), MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseCsvLine(), parseLeadsCsv(), RFC-4180

### Community 168 - "booking/route.ts"
Cohesion: 0.16
Nodes (18): BOOKING_V2_ERRORS, bookingDbError(), bookingError(), BookingV2ErrorCode, isBookingV2ErrorCode(), POST(), runtime, POST() (+10 more)

### Community 169 - "messaging-stub.ts"
Cohesion: 0.27
Nodes (12): receiptLabels(), ReceiptView(), send(), buildReceiptText(), buildWaLink(), enqueueMessage(), EnqueueMessageInput, EnqueueMessageResult (+4 more)

### Community 170 - "location-map.tsx"
Cohesion: 0.31
Nodes (7): maplibre-gl@^6.18.0, maplibre-gl, LocationMap(), LocationMapProps, mapStyle(), OSM_STYLE, round6()

### Community 171 - "step-account.tsx"
Cohesion: 0.28
Nodes (13): clientIp(), OwnerSignupError, OwnerSignupResult, phoneAuthEnabled(), signUpOwner(), siteOrigin(), verifyOwnerOtp(), Field (+5 more)

### Community 172 - "helpers.ts"
Cohesion: 0.40
Nodes (6): completeBooking(), escapeRegExp(), getSeed(), login(), SeedData, @playwright/test

### Community 173 - "checkout-dialog.tsx"
Cohesion: 0.14
Nodes (13): AddMode, DICTS, DraftDiscount, Locale, Cart, CartItem, DiscountSpec, PaymentDraft (+5 more)

### Community 174 - "notification-bell.test.ts"
Cohesion: 0.25
Nodes (5): Dict, NotificationRow, fmt, t, TranslationKeys

### Community 175 - "explore-utils.ts"
Cohesion: 0.53
Nodes (4): ExploreShop, filterShops(), normalizeSearch(), shops

### Community 176 - "otp-panel.tsx"
Cohesion: 0.32
Nodes (10): phoneGate(), AuthClient, OtpPanel(), otpSatisfied(), RESEND_AFTER_SEC, maskForDisplay(), nationalKey(), phoneDigits() (+2 more)

### Community 177 - "seed-e2e.mjs"
Cohesion: 0.29
Nodes (6): globalSetup(), E2E_CUSTOMER, E2E_OWNER, ensureUser(), findUserByEmail(), seedE2E()

### Community 178 - "Halaqy Master Development Plan"
Cohesion: 0.20
Nodes (9): Authentication, Calendar & Bookings (Pending), CRM & KanBan Integration (Pending), Database Setup, Halaqy Master Development Plan, Phase 1 & 2: Frontend Foundation & Component Design, Phase 2.5: UI Polish & Landing Page, Phase 3: Backend Integration (Supabase) (+1 more)

### Community 179 - "Phase 5: New Features — Notifications & Communication"
Cohesion: 0.50
Nodes (4): 5.1 — In-App Notifications, 5.2 — Email Notifications, 5.3 — WhatsApp/SMS Integration (Optional), Phase 5: New Features — Notifications & Communication

### Community 180 - "use-booking-data.ts"
Cohesion: 0.29
Nodes (9): normalizeService(), ServiceRow, VariantRow, BookingCatalog, BookingShop, loadBookingCatalog(), Res, useBookingCatalog() (+1 more)

### Community 181 - "join/page.tsx"
Cohesion: 0.25
Nodes (5): ErrorCodeMap, InviteLookup, JoinContent(), JoinPage(), JoinStatus

### Community 182 - "Phase 3: New Features — Team Management"
Cohesion: 0.50
Nodes (4): 3.1 — Invite System, 3.2 — Team Page in Settings, 3.3 — Barber Dashboard View, Phase 3: New Features — Team Management

### Community 183 - "Phase 0: Critical Fixes (Broken/Non-Functional)"
Cohesion: 0.33
Nodes (6): 0.1 — Fix Database Migration Inconsistencies, 0.2 — Fix Workspace Store Hydration, 0.3 — Fix Leads Store Hydration, 0.4 — Fix Dashboard Upcoming Appointments, 0.5 — Fix Landing Page Links, Phase 0: Critical Fixes (Broken/Non-Functional)

### Community 187 - "server.test.ts"
Cohesion: 0.50
Nodes (3): CookieMethods, cookieStore, createServerClientMock

## Knowledge Gaps
- **3 isolated node(s):** `PATH`, `RFC-4180`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1114 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `auth/signup/page.tsx`, `step-location.tsx`, `booking/route.ts`, `interpolate`, `utils.ts`, `booking-utils.ts`, `booking-state.ts`, `shop/[shop_id]/page.tsx`, `authErrorKey`, `react`, `dependencies`, `package.json`, `profile-form.ts`, `publish-panel.tsx`, `useWorkspaceStore`, `middleware.ts`, `date-overrides-panel.tsx`, `barber-profile-client.tsx`, `api-helpers.ts`, `sidebar.tsx`, `legal-page.tsx`, `cn`, `step-review.tsx`, `photos-manager.tsx`, `health/route.ts`, `en.ts`, `start/page.tsx`, `booking/route.ts`, `auth/actions.ts`, `step-account.tsx`, `settings-page.tsx`, `toast.tsx`, `share-screen.tsx`, `timeline-view.tsx`, `createQueryBuilder`, `join/page.tsx`, `AppointmentStatus`, `[locale]/layout.tsx`, `sitemap.ts`, `config.ts`, `shop-profile-client.tsx`, `cn`, `error-reporting.ts`, `landing/page.tsx`, `services-section.tsx`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useTranslation()` (e.g. with `Architecture` and `Current State — What's Actually Undermining the Experience`) actually correct?**
  _`useTranslation()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH`, `RFC-4180`, `RFC-4180` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `interpolate` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Why does `useTranslation()` connect `utils.ts` to `auth/signup/page.tsx`, `barbershop.ts`, `step-location.tsx`, `interpolate`, `interpolate`, `booking-utils.ts`, `format.ts`, `booking-state.ts`, `react`, `authErrorKey`, `leads-store.ts`, `checkout-dialog.tsx`, `hours-settings.tsx`, `map.ts`, `profile-form.ts`, `publish-panel.tsx`, `useWorkspaceStore`, `start-wizard.tsx`, `step-time.tsx`, `date-overrides-panel.tsx`, `barber-profile-client.tsx`, `step-review.tsx`, `sidebar.tsx`, `photos-manager.tsx`, `cn`, `step-team.tsx`, `start/page.tsx`, `use-pos.ts`, `messaging-stub.ts`, `location-map.tsx`, `step-account.tsx`, `settings-page.tsx`, `checkout-dialog.tsx`, `toast.tsx`, `otp-panel.tsx`, `share-screen.tsx`, `timeline-view.tsx`, `join/page.tsx`, `config.ts`, `booking/step-services.tsx`, `shop-profile-client.tsx`, `cn`, `landing/page.tsx`, `queries/services.ts`, `TaxSettings`, `services-section.tsx`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `booking/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09401709401709402 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `createQueryBuilder` to `barbershop.ts`, `interpolate`, `booking/route.ts`, `interpolate`, `utils.ts`, `booking-utils.ts`, `use-appointments.ts`, `format.ts`, `booking-state.ts`, `shop/[shop_id]/page.tsx`, `authErrorKey`, `use-pos.test.ts`, `analytics-page.ts`, `leads-store.ts`, `validations.ts`, `package.json`, `hours-settings.tsx`, `profile-form.ts`, `index.ts`, `start-wizard.tsx`, `useWorkspaceStore`, `mock-data.ts`, `date-overrides-panel.tsx`, `middleware.ts`, `api-helpers.ts`, `sidebar.tsx`, `clients.ts`, `search.ts`, `health/route.ts`, `en.ts`, `recurrence.ts`, `lead-csv.ts`, `auth/actions.ts`, `messaging-stub.ts`, `settings-page.tsx`, `toast.tsx`, `notification-bell.test.ts`, `explore-utils.ts`, `env.ts`, `timeline-view.tsx`, `cancel/route.test.ts`, `mask.ts`, `rate-limit.ts`, `server.test.ts`, `config.ts`, `booking/step-services.tsx`, `shop-profile-client.tsx`, `error-reporting.ts`, `payments-logic.ts`, `queries/services.ts`, `TaxSettings`, `services-section.tsx`, `create/route.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._