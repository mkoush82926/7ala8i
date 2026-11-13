// ─────────────────────────────────────────────────────────────────────────
// LOCAL DESIGN-PREVIEW MOCK DATA — never used in production.
//
// Local Supabase isn't always running in dev (it needs Docker), so the
// public marketplace pages (explore / shop profile / booking wizard) have
// nothing to render. This file provides realistic, clearly-fictional
// barbershop data so those pages can be previewed and iterated on visually
// without a live backend.
//
// Gated by NEXT_PUBLIC_USE_MOCK_DATA via src/lib/env.ts, which REFUSES mock
// mode whenever NODE_ENV === "production" (unless the explicit escape hatch
// NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true is set). Import MOCK_DATA_ENABLED /
// MOCK_AUTH_ROLE from here (or MOCK_MODE from env.ts) — never read the raw
// env flags directly, so browser, middleware and server agree.
// ─────────────────────────────────────────────────────────────────────────

import type { AppointmentStatus } from "@/lib/types";
import { MOCK_MODE, MOCK_AUTH_ROLE as ENV_MOCK_AUTH_ROLE, type MockAuthRole } from "@/lib/env";

export const MOCK_DATA_ENABLED: boolean = MOCK_MODE;

// Optional, separate opt-in on top of MOCK_DATA_ENABLED — set
// NEXT_PUBLIC_MOCK_AUTH_ROLE=shop_admin|barber|customer in .env.local to also
// preview the auth-gated pages (middleware must use this same export for its
// bypass). Always null when mock mode is off or refused.
export const MOCK_AUTH_ROLE: MockAuthRole | null = ENV_MOCK_AUTH_ROLE;

export const MOCK_ADMIN_ID = "99999999-9999-9999-9999-999999999999";

export const MOCK_SHOP_IDS = {
  gentlemansChair: "11111111-1111-1111-1111-111111111111",
  classicRazor: "22222222-2222-2222-2222-222222222222",
  urbanClippers: "33333333-3333-3333-3333-333333333333",
} as const;

export interface MockShop {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  instagram: string;
  google_maps_url: string;
  whatsapp: string;
  description: string | null;
  currency: string;
  timezone: string;
  cancellation_policy_hours: number;
  cancellation_fee_percent: number;
}

const SHOP_DEFAULTS = {
  description: null,
  currency: "JOD",
  timezone: "Asia/Amman",
  cancellation_policy_hours: 12,
  cancellation_fee_percent: 0,
} as const;

export const MOCK_SHOPS: MockShop[] = [
  {
    id: MOCK_SHOP_IDS.gentlemansChair,
    name: "The Gentleman's Chair",
    address: "Amman, Abdoun",
    phone: "+962 79 123 4567",
    email: "hello@gentlemanschair.jo",
    instagram: "gentlemanschair",
    google_maps_url: "https://maps.google.com/?q=Abdoun+Amman",
    whatsapp: "+962791234567",
    ...SHOP_DEFAULTS,
  },
  {
    id: MOCK_SHOP_IDS.classicRazor,
    name: "The Classic Razor",
    address: "Amman, Al Weibdeh",
    phone: "+962 78 987 6543",
    email: "info@classicrazor.jo",
    instagram: "classicrazor.jo",
    google_maps_url: "https://maps.google.com/?q=Al+Weibdeh+Amman",
    whatsapp: "+962789876543",
    ...SHOP_DEFAULTS,
  },
  {
    id: MOCK_SHOP_IDS.urbanClippers,
    name: "Urban Clippers",
    address: "Amman, Sweifieh",
    phone: "+962 77 111 2222",
    email: "contact@urbanclippers.jo",
    instagram: "urbanclippers",
    google_maps_url: "https://maps.google.com/?q=Sweifieh+Amman",
    whatsapp: "+962771112222",
    ...SHOP_DEFAULTS,
  },
];

export interface MockService {
  id: string;
  shop_id: string;
  name: string;
  name_ar: string;
  duration: number;
  price: number;
  is_active: boolean;
  sort_order: number;
}

type MockServiceSeed = Omit<MockService, "is_active" | "sort_order">;

const MOCK_SERVICE_SEED: MockServiceSeed[] = [
  // Gentleman's Chair — the full menu
  { id: "s-gc-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Classic Haircut", name_ar: "قص كلاسيكي", duration: 30, price: 8 },
  { id: "s-gc-2", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Skin Fade", name_ar: "سكين فييد", duration: 30, price: 10 },
  { id: "s-gc-3", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Beard Trim & Lineup", name_ar: "تحديد وتهذيب اللحية", duration: 15, price: 5 },
  { id: "s-gc-4", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Haircut & Beard", name_ar: "قص ولحية", duration: 45, price: 12 },
  { id: "s-gc-5", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Hot Towel Shave", name_ar: "حلاقة بالمنشفة الساخنة", duration: 30, price: 7 },
  { id: "s-gc-6", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Kids Haircut", name_ar: "قص شعر أطفال", duration: 20, price: 6 },
  { id: "s-gc-7", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Hair Coloring", name_ar: "صبغ شعر", duration: 60, price: 25 },
  { id: "s-gc-8", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "VIP Grooming Package", name_ar: "باقة العناية VIP", duration: 120, price: 40 },

  // Classic Razor — a tighter menu
  { id: "s-cr-1", shop_id: MOCK_SHOP_IDS.classicRazor, name: "Classic Haircut", name_ar: "قص كلاسيكي", duration: 30, price: 8 },
  { id: "s-cr-2", shop_id: MOCK_SHOP_IDS.classicRazor, name: "Beard Trim", name_ar: "تهذيب اللحية", duration: 15, price: 5 },
  { id: "s-cr-3", shop_id: MOCK_SHOP_IDS.classicRazor, name: "Haircut & Beard", name_ar: "قص ولحية", duration: 45, price: 12 },
  { id: "s-cr-4", shop_id: MOCK_SHOP_IDS.classicRazor, name: "Hot Towel Shave", name_ar: "حلاقة بالمنشفة الساخنة", duration: 30, price: 7 },

  // Urban Clippers
  { id: "s-uc-1", shop_id: MOCK_SHOP_IDS.urbanClippers, name: "Skin Fade", name_ar: "سكين فييد", duration: 30, price: 10 },
  { id: "s-uc-2", shop_id: MOCK_SHOP_IDS.urbanClippers, name: "Kids Haircut", name_ar: "قص شعر أطفال", duration: 20, price: 6 },
  { id: "s-uc-3", shop_id: MOCK_SHOP_IDS.urbanClippers, name: "Haircut & Beard", name_ar: "قص ولحية", duration: 45, price: 12 },
  { id: "s-uc-4", shop_id: MOCK_SHOP_IDS.urbanClippers, name: "Hair Coloring", name_ar: "صبغ شعر", duration: 60, price: 22 },
];

export const MOCK_SERVICES: MockService[] = MOCK_SERVICE_SEED.map((s, i) => ({ ...s, is_active: true, sort_order: i }));

export interface MockBarber {
  id: string;
  shop_id: string;
  full_name: string;
  avatar_url: string;
  role: "barber";
  barber_services: { service_id: string }[];
}

export const MOCK_BARBERS: MockBarber[] = [
  {
    id: "b-gc-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, full_name: "Sami FadeMaster",
    avatar_url: "https://i.pravatar.cc/150?u=b-gc-1", role: "barber",
    barber_services: MOCK_SERVICES.filter(s => s.shop_id === MOCK_SHOP_IDS.gentlemansChair).map(s => ({ service_id: s.id })),
  },
  {
    id: "b-gc-2", shop_id: MOCK_SHOP_IDS.gentlemansChair, full_name: "Khaled Scissors",
    avatar_url: "https://i.pravatar.cc/150?u=b-gc-2", role: "barber",
    barber_services: MOCK_SERVICES.filter(s => s.shop_id === MOCK_SHOP_IDS.gentlemansChair).map(s => ({ service_id: s.id })),
  },
  {
    id: "b-cr-1", shop_id: MOCK_SHOP_IDS.classicRazor, full_name: "Omar Styling",
    avatar_url: "https://i.pravatar.cc/150?u=b-cr-1", role: "barber",
    barber_services: MOCK_SERVICES.filter(s => s.shop_id === MOCK_SHOP_IDS.classicRazor).map(s => ({ service_id: s.id })),
  },
  {
    id: "b-uc-1", shop_id: MOCK_SHOP_IDS.urbanClippers, full_name: "Rami The Classic",
    avatar_url: "https://i.pravatar.cc/150?u=b-uc-1", role: "barber",
    barber_services: MOCK_SERVICES.filter(s => s.shop_id === MOCK_SHOP_IDS.urbanClippers).map(s => ({ service_id: s.id })),
  },
];

export interface MockClient {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  total_spend: number;
  created_at: string;
  deleted_at: string | null;
  auth_user_id: string | null;
}

// Dashboard-only — the guest booking flow never reads this table, only the
// Clients list page does, to preview real row content instead of just an
// empty state.
export const MOCK_CLIENTS: MockClient[] = [
  { id: "c-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Yousef R.", phone: "+962 79 111 2233", email: "yousef.r@example.com", notes: null, total_spend: 84, created_at: daysAgo(2), deleted_at: null, auth_user_id: null },
  { id: "c-2", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Tariq H.", phone: "+962 78 222 3344", email: "tariq.h@example.com", notes: null, total_spend: 46, created_at: daysAgo(5), deleted_at: null, auth_user_id: null },
  { id: "c-3", shop_id: MOCK_SHOP_IDS.gentlemansChair, name: "Mahmoud S.", phone: "+962 77 333 4455", email: null, notes: null, total_spend: 21, created_at: daysAgo(9), deleted_at: null, auth_user_id: null },
];

// The signed-in shop_admin/barber MOCK_AUTH_ROLE resolves to, always scoped
// to Gentleman's Chair — dashboard pages query `profiles` for this id to
// resolve shopId/role, same shape as MOCK_BARBERS but without barber_services
// (an admin isn't a barber).
export interface MockAdminProfile {
  id: string;
  shop_id: string;
  full_name: string;
  avatar_url: string | null;
  role: "shop_admin" | "barber" | "customer";
}

export const MOCK_ADMIN_PROFILE: MockAdminProfile = {
  id: MOCK_ADMIN_ID,
  shop_id: MOCK_SHOP_IDS.gentlemansChair,
  full_name: "Mohammad (Preview)",
  avatar_url: null,
  role: "shop_admin",
};

// Every row the mock client's "profiles" table serves — dashboard queries
// (team lists, role lookups) expect admins and barbers side by side in one
// table, same as the real schema.
export const MOCK_PROFILES: (MockAdminProfile | MockBarber)[] = [MOCK_ADMIN_PROFILE, ...MOCK_BARBERS];

export interface MockReview {
  id: string;
  shop_id: string;
  rating: number;
  comment: string;
  created_at: string;
  /** Public display name stored on the review (replaces the clients(name) embed). */
  reviewer_name: string;
  clients: { name: string };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const MOCK_REVIEWS: MockReview[] = [
  { id: "r-gc-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Best fade I've had in Amman — Sami really knows his craft.", created_at: daysAgo(2), reviewer_name: "Yousef R.", clients: { name: "Yousef R." } },
  { id: "r-gc-2", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Clean shop, friendly staff, quick service. Highly recommend.", created_at: daysAgo(5), reviewer_name: "Tariq H.", clients: { name: "Tariq H." } },
  { id: "r-gc-3", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 4, comment: "The hot towel shave is worth every dinar.", created_at: daysAgo(9), reviewer_name: "Mahmoud S.", clients: { name: "Mahmoud S." } },
  { id: "r-gc-4", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Been coming here for two years, never disappointed.", created_at: daysAgo(14), reviewer_name: "Basel N.", clients: { name: "Basel N." } },
  { id: "r-gc-5", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 3, comment: "A bit busy on weekends, but the quality makes up for the wait.", created_at: daysAgo(20), reviewer_name: "Fadi K.", clients: { name: "Fadi K." } },
  { id: "r-gc-6", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Khaled's beard lineup is unreal. My go-to shop now.", created_at: daysAgo(26), reviewer_name: "Zaid A.", clients: { name: "Zaid A." } },

  { id: "r-cr-1", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 5, comment: "Old-school barbering done right. Great atmosphere.", created_at: daysAgo(4), reviewer_name: "Hassan T.", clients: { name: "Hassan T." } },
  { id: "r-cr-2", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 4, comment: "Solid haircut, reasonable prices, easy to book online.", created_at: daysAgo(11), reviewer_name: "Ali Z.", clients: { name: "Ali Z." } },
  { id: "r-cr-3", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 5, comment: "Omar is precise and fast. In and out in 30 minutes looking sharp.", created_at: daysAgo(18), reviewer_name: "Karam F.", clients: { name: "Karam F." } },

  { id: "r-uc-1", shop_id: MOCK_SHOP_IDS.urbanClippers, rating: 5, comment: "Modern space, great music, even better haircuts.", created_at: daysAgo(3), reviewer_name: "Saeed M.", clients: { name: "Saeed M." } },
  { id: "r-uc-2", shop_id: MOCK_SHOP_IDS.urbanClippers, rating: 4, comment: "Rami nailed the color job, exactly what I asked for.", created_at: daysAgo(8), reviewer_name: "Majed S.", clients: { name: "Majed S." } },
];

export interface MockWorkingHour {
  barber_id: string;
  day_of_week: number; // 0 = Sunday, matches JS Date#getDay()
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

// Sun–Thu 9:00–18:00 with a 1hr midday break, closed Friday, half-day Saturday
// — a realistic Jordanian barbershop week.
function standardWeek(barberId: string): MockWorkingHour[] {
  const days = [0, 1, 2, 3, 4, 5, 6];
  return days.map((day) => {
    if (day === 5) {
      return { barber_id: barberId, day_of_week: day, is_working: false, start_time: "00:00", end_time: "00:00", break_start: null, break_end: null };
    }
    if (day === 6) {
      return { barber_id: barberId, day_of_week: day, is_working: true, start_time: "10:00", end_time: "16:00", break_start: null, break_end: null };
    }
    return { barber_id: barberId, day_of_week: day, is_working: true, start_time: "09:00", end_time: "18:00", break_start: "13:00", break_end: "14:00" };
  });
}

export const MOCK_WORKING_HOURS: MockWorkingHour[] = MOCK_BARBERS.flatMap((b) => standardWeek(b.id));

export interface MockAppointment {
  id: string;
  shop_id: string;
  barber_id: string;
  client_id: string | null;
  client_name: string;
  service_name: string;
  service_ids: string[];
  price: number;
  currency: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  source: string;
}

// One real booking today (Gentleman's Chair, Sami, 2pm) so the dashboard
// Calendar/My Day pages have something to render instead of only their
// empty states — everything else stays open for the guest booking flow.
// Times are full ISO timestamps (timestamptz), like the real column.
function todayAt(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const MOCK_APPOINTMENTS: MockAppointment[] = [
  {
    id: "appt-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, barber_id: "b-gc-1",
    client_id: "c-1", client_name: "Yousef R.", service_name: "Classic Haircut", service_ids: ["s-gc-1"],
    price: 8, currency: "JOD",
    start_time: todayAt(14), end_time: todayAt(14, 30),
    status: "confirmed", source: "online",
  },
];
