// ─────────────────────────────────────────────────────────────────────────
// LOCAL DESIGN-PREVIEW MOCK DATA — never used in production.
//
// Local Supabase isn't always running in dev (it needs Docker), so the
// public marketplace pages (explore / shop profile / booking wizard) have
// nothing to render. This file provides realistic, clearly-fictional
// barbershop data so those pages can be previewed and iterated on visually
// without a live backend.
//
// Gated by NEXT_PUBLIC_USE_MOCK_DATA, read only from .env.local (which is
// git-ignored and never deployed) — see src/lib/supabase/client.ts. There is
// no code path that can accidentally enable this in production: the flag
// defaults to unset/false, and Vercel's env for the real deployment never
// sets it.
// ─────────────────────────────────────────────────────────────────────────

export const MOCK_DATA_ENABLED = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

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
}

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
  },
];

export interface MockService {
  id: string;
  shop_id: string;
  name: string;
  name_ar: string;
  duration: number;
  price: number;
}

export const MOCK_SERVICES: MockService[] = [
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

export interface MockReview {
  id: string;
  shop_id: string;
  rating: number;
  comment: string;
  created_at: string;
  clients: { name: string };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const MOCK_REVIEWS: MockReview[] = [
  { id: "r-gc-1", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Best fade I've had in Amman — Sami really knows his craft.", created_at: daysAgo(2), clients: { name: "Yousef R." } },
  { id: "r-gc-2", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Clean shop, friendly staff, quick service. Highly recommend.", created_at: daysAgo(5), clients: { name: "Tariq H." } },
  { id: "r-gc-3", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 4, comment: "The hot towel shave is worth every dinar.", created_at: daysAgo(9), clients: { name: "Mahmoud S." } },
  { id: "r-gc-4", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Been coming here for two years, never disappointed.", created_at: daysAgo(14), clients: { name: "Basel N." } },
  { id: "r-gc-5", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 3, comment: "A bit busy on weekends, but the quality makes up for the wait.", created_at: daysAgo(20), clients: { name: "Fadi K." } },
  { id: "r-gc-6", shop_id: MOCK_SHOP_IDS.gentlemansChair, rating: 5, comment: "Khaled's beard lineup is unreal. My go-to shop now.", created_at: daysAgo(26), clients: { name: "Zaid A." } },

  { id: "r-cr-1", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 5, comment: "Old-school barbering done right. Great atmosphere.", created_at: daysAgo(4), clients: { name: "Hassan T." } },
  { id: "r-cr-2", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 4, comment: "Solid haircut, reasonable prices, easy to book online.", created_at: daysAgo(11), clients: { name: "Ali Z." } },
  { id: "r-cr-3", shop_id: MOCK_SHOP_IDS.classicRazor, rating: 5, comment: "Omar is precise and fast. In and out in 30 minutes looking sharp.", created_at: daysAgo(18), clients: { name: "Karam F." } },

  { id: "r-uc-1", shop_id: MOCK_SHOP_IDS.urbanClippers, rating: 5, comment: "Modern space, great music, even better haircuts.", created_at: daysAgo(3), clients: { name: "Saeed M." } },
  { id: "r-uc-2", shop_id: MOCK_SHOP_IDS.urbanClippers, rating: 4, comment: "Rami nailed the color job, exactly what I asked for.", created_at: daysAgo(8), clients: { name: "Majed S." } },
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

// No pre-existing bookings — every generated slot shows as open for this
// fresh design preview.
export const MOCK_APPOINTMENTS: { start_time: string; end_time: string; barber_id: string; shop_id: string; status: string }[] = [];
