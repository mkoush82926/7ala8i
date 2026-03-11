# Lumina Master Development Plan

## Phase 1 & 2: Frontend Foundation & Component Design
- [x] Initial Next.js & Tailwind setup
- [x] Create glassmorphism design system (`globals.css`, color tokens)
- [x] Setup global Zustand state (Theme, Workspace, Leads)
- [x] Sidebar and Topbar navigation shell
- [x] English/Arabic localization (i18n hook, RTL layout support)
- [x] Interactive Dashboard (animated AreaCharts, Metric Cards)
- [x] Kanban Board (drag-and-drop `@dnd-kit` implementation)
- [x] Calendar View (custom time-grid, appointment rendering)
- [x] Settings Page (form inputs, tab navigation)

## Phase 2.5: UI Polish & Landing Page
- [x] `app/landing` marketing page (animated hero, feature grid, pricing)
- [x] Responsive layout fixes for mobile & tablet
- [x] New Analytics Page (donut charts, heatmaps)
- [x] New Clients Directory Page
- [x] Booking Engine flow animations
- [x] Micro-animations (hover lifts, glowing borders, active UI states)

## Phase 3: Backend Integration (Supabase)
### Database Setup
- [x] Connect Next.js to Supabase Project
- [x] Design multi-tenant SQL Schema (shops, profiles, clients, leads, appts)
- [x] Enable Row Level Security (RLS) policies
- [x] Generate TypeScript types for database

### Authentication
- [x] Build `/login` and `/signup` UI routes
- [x] Write server-actions for `login()` and `signup()` user flow
- [x] Implement Next.js Middleware to protect `/` dashboard
- [x] Add Logout action to Topbar
- [ ] Implement auto-registration trigger (create new shop per signup)

### CRM & KanBan Integration (Pending)
- [ ] Replace `mock-data.ts` leads in Kanban store with Supabase Fetch
- [ ] Add Database Write actions (Create lead, Update pipeline stage)

### Calendar & Bookings (Pending)
- [ ] Replace `mock-data.ts` appointments with Supabase Fetch
- [ ] API endpoint for public booking engine to create new appointments
- [ ] Link `services` table to the booking selection step

## Phase 4: Refinement & Advanced Features (Future)
- [ ] Connect Stripe/Payment Provider for actual booking deposits
- [ ] File Storage (Upload Shop Logos & Barbershop Avatars)
- [ ] Role-Based Access Control UI (Shop Admins inviting Barbers via email link)
- [ ] Email/SMS Notification webhooks (e.g. Appointment Reminder)
- [ ] Realtime Supabase Subscriptions (Kanban board updates instantly if another barber touches it)
