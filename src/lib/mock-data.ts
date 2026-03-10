// ═══════════════════════════════════════════════════════
// LUMINA — Mock Data for Phase 1 (UI Development)
// ═══════════════════════════════════════════════════════

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  barberId: string;
  barberName: string;
  service: string;
  price: number;
  date: string;
  time: string;
  duration: number; // in minutes
  status: "pending" | "confirmed" | "completed" | "no-show";
}

export interface DailySale {
  id: string;
  clientName: string;
  service: string;
  barberName: string;
  amount: number;
  time: string;
  paymentMethod: "cash" | "card";
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  value?: number;
  stage: "new" | "contacted" | "booked" | "completed" | "loyal";
  notes?: string;
  avatar?: string;
  createdAt: string;
}

export interface ChartDataPoint {
  label: string;
  revenue: number;
  bookings: number;
}

// ─── Dashboard Metrics ───
export const dashboardMetrics = {
  todayBookings: 12,
  todayBookingsChange: +15,
  todaySales: 84.5,
  todaySalesChange: +8.3,
  weeklyTrajectory: 523.0,
  weeklyTrajectoryChange: -2.1,
  monthlyRevenue: 2140.0,
  monthlyRevenueChange: +12.5,
  dailyGoal: 120,
  dailyProgress: 84.5,
};

// ─── Daily Sales Chart Data ───
export const dailyChartData: ChartDataPoint[] = [
  { label: "9 AM", revenue: 8, bookings: 1 },
  { label: "10 AM", revenue: 22.5, bookings: 3 },
  { label: "11 AM", revenue: 37, bookings: 5 },
  { label: "12 PM", revenue: 45.5, bookings: 6 },
  { label: "1 PM", revenue: 52, bookings: 7 },
  { label: "2 PM", revenue: 60, bookings: 8 },
  { label: "3 PM", revenue: 68.5, bookings: 9 },
  { label: "4 PM", revenue: 76, bookings: 10 },
  { label: "5 PM", revenue: 84.5, bookings: 12 },
];

export const weeklyChartData: ChartDataPoint[] = [
  { label: "Mon", revenue: 125, bookings: 16 },
  { label: "Tue", revenue: 98, bookings: 12 },
  { label: "Wed", revenue: 142, bookings: 18 },
  { label: "Thu", revenue: 110, bookings: 14 },
  { label: "Fri", revenue: 178, bookings: 22 },
  { label: "Sat", revenue: 195, bookings: 24 },
  { label: "Sun", revenue: 75, bookings: 8 },
];

export const monthlyChartData: ChartDataPoint[] = [
  { label: "Week 1", revenue: 520, bookings: 64 },
  { label: "Week 2", revenue: 610, bookings: 76 },
  { label: "Week 3", revenue: 480, bookings: 58 },
  { label: "Week 4", revenue: 530, bookings: 68 },
];

export const yearlyChartData: ChartDataPoint[] = [
  { label: "Jan", revenue: 1800, bookings: 220 },
  { label: "Feb", revenue: 2100, bookings: 260 },
  { label: "Mar", revenue: 2400, bookings: 300 },
  { label: "Apr", revenue: 2200, bookings: 275 },
  { label: "May", revenue: 2600, bookings: 320 },
  { label: "Jun", revenue: 2800, bookings: 345 },
  { label: "Jul", revenue: 3100, bookings: 380 },
  { label: "Aug", revenue: 2900, bookings: 360 },
  { label: "Sep", revenue: 2700, bookings: 335 },
  { label: "Oct", revenue: 2500, bookings: 310 },
  { label: "Nov", revenue: 2300, bookings: 285 },
  { label: "Dec", revenue: 2140, bookings: 266 },
];

// ─── Today's Transactions (Receipt) ───
export const todaysSales: DailySale[] = [
  {
    id: "s1",
    clientName: "Tariq Mansour",
    service: "Premium Haircut",
    barberName: "Ahmad Al-Masri",
    amount: 12.0,
    time: "09:15",
    paymentMethod: "cash",
  },
  {
    id: "s2",
    clientName: "Sami Khalil",
    service: "Beard Trim & Shape",
    barberName: "Khalid Nasser",
    amount: 8.0,
    time: "09:45",
    paymentMethod: "card",
  },
  {
    id: "s3",
    clientName: "Rami Abu-Said",
    service: "Haircut + Beard",
    barberName: "Omar Haddad",
    amount: 15.0,
    time: "10:00",
    paymentMethod: "cash",
  },
  {
    id: "s4",
    clientName: "Nabil Darwish",
    service: "Hot Towel Shave",
    barberName: "Ahmad Al-Masri",
    amount: 10.0,
    time: "10:30",
    paymentMethod: "cash",
  },
  {
    id: "s5",
    clientName: "Walid Khoury",
    service: "Kids Haircut",
    barberName: "Faris Jabari",
    amount: 7.0,
    time: "11:00",
    paymentMethod: "card",
  },
  {
    id: "s6",
    clientName: "Bassem Hani",
    service: "Premium Haircut",
    barberName: "Yousef Qasem",
    amount: 12.0,
    time: "11:30",
    paymentMethod: "cash",
  },
  {
    id: "s7",
    clientName: "Mazen Sabbagh",
    service: "Full Grooming",
    barberName: "Khalid Nasser",
    amount: 20.5,
    time: "12:00",
    paymentMethod: "card",
  },
];

// ─── Appointments ───
export const appointments: Appointment[] = [
  {
    id: "a1",
    clientName: "Tariq Mansour",
    clientPhone: "+962791234567",
    barberId: "barber-001",
    barberName: "Ahmad Al-Masri",
    service: "Premium Haircut",
    price: 12,
    date: "2026-03-10",
    time: "09:00",
    duration: 45,
    status: "completed",
  },
  {
    id: "a2",
    clientName: "Sami Khalil",
    clientPhone: "+962797654321",
    barberId: "barber-002",
    barberName: "Khalid Nasser",
    service: "Beard Trim",
    price: 8,
    date: "2026-03-10",
    time: "09:30",
    duration: 30,
    status: "completed",
  },
  {
    id: "a3",
    clientName: "Rami Abu-Said",
    clientPhone: "+962781112233",
    barberId: "barber-003",
    barberName: "Omar Haddad",
    service: "Haircut + Beard",
    price: 15,
    date: "2026-03-10",
    time: "10:00",
    duration: 60,
    status: "completed",
  },
  {
    id: "a4",
    clientName: "Nabil Darwish",
    clientPhone: "+962789998877",
    barberId: "barber-001",
    barberName: "Ahmad Al-Masri",
    service: "Hot Towel Shave",
    price: 10,
    date: "2026-03-10",
    time: "10:30",
    duration: 30,
    status: "confirmed",
  },
  {
    id: "a5",
    clientName: "Walid Khoury",
    clientPhone: "+962794445566",
    barberId: "barber-004",
    barberName: "Faris Jabari",
    service: "Kids Haircut",
    price: 7,
    date: "2026-03-10",
    time: "11:00",
    duration: 30,
    status: "confirmed",
  },
  {
    id: "a6",
    clientName: "Bassem Hani",
    clientPhone: "+962782223344",
    barberId: "barber-005",
    barberName: "Yousef Qasem",
    service: "Premium Haircut",
    price: 12,
    date: "2026-03-10",
    time: "11:30",
    duration: 45,
    status: "pending",
  },
  {
    id: "a7",
    clientName: "Mazen Sabbagh",
    clientPhone: "+962793334455",
    barberId: "barber-002",
    barberName: "Khalid Nasser",
    service: "Full Grooming",
    price: 20.5,
    date: "2026-03-10",
    time: "12:00",
    duration: 75,
    status: "pending",
  },
  {
    id: "a8",
    clientName: "Hisham Qadri",
    clientPhone: "+962785556677",
    barberId: "barber-003",
    barberName: "Omar Haddad",
    service: "Premium Haircut",
    price: 12,
    date: "2026-03-10",
    time: "13:00",
    duration: 45,
    status: "pending",
  },
  {
    id: "a9",
    clientName: "Fadi Nassar",
    clientPhone: "+962796667788",
    barberId: "barber-001",
    barberName: "Ahmad Al-Masri",
    service: "Haircut + Beard",
    price: 15,
    date: "2026-03-10",
    time: "14:00",
    duration: 60,
    status: "pending",
  },
  {
    id: "a10",
    clientName: "Zain Omari",
    clientPhone: "+962787778899",
    barberId: "barber-004",
    barberName: "Faris Jabari",
    service: "Beard Trim",
    price: 8,
    date: "2026-03-10",
    time: "14:30",
    duration: 30,
    status: "no-show",
  },
  {
    id: "a11",
    clientName: "Layth Battah",
    clientPhone: "+962798889900",
    barberId: "barber-005",
    barberName: "Yousef Qasem",
    service: "Hot Towel Shave",
    price: 10,
    date: "2026-03-10",
    time: "15:00",
    duration: 30,
    status: "pending",
  },
  {
    id: "a12",
    clientName: "Ammar Saleh",
    clientPhone: "+962780001122",
    barberId: "barber-002",
    barberName: "Khalid Nasser",
    service: "Premium Haircut",
    price: 12,
    date: "2026-03-10",
    time: "16:00",
    duration: 45,
    status: "pending",
  },
];

// ─── CRM Leads ───
export const leads: Lead[] = [
  {
    id: "l1",
    name: "Ibrahim Al-Rashid",
    phone: "+962791001001",
    email: "ibrahim@email.com",
    value: 200,
    stage: "new",
    notes: "Wedding groom",
    createdAt: "2026-03-08",
  },
  {
    id: "l2",
    name: "Karim Shaheen",
    phone: "+962792002002",
    value: 50,
    stage: "contacted",
    notes: "VIP regular - monthly package",
    createdAt: "2026-03-07",
  },
  {
    id: "l3",
    name: "Sultan Al-Nouri",
    phone: "+962793003003",
    email: "sultan@email.com",
    value: 350,
    stage: "booked",
    notes: "Groomsmen package x7",
    createdAt: "2026-03-05",
  },
  {
    id: "l4",
    name: "Adel Hamdan",
    phone: "+962794004004",
    stage: "completed",
    createdAt: "2026-03-01",
  },
  {
    id: "l5",
    name: "Murad Salim",
    phone: "+962795005005",
    value: 25,
    stage: "loyal",
    notes: "Monthly loyalty member",
    createdAt: "2026-02-15",
  },
  {
    id: "l6",
    name: "Rakan Al-Tamimi",
    phone: "+962796006006",
    value: 100,
    stage: "new",
    notes: "Corporate event styling",
    createdAt: "2026-03-09",
  },
  {
    id: "l7",
    name: "Bilal Farouk",
    phone: "+962797007007",
    stage: "contacted",
    createdAt: "2026-03-06",
  },
  {
    id: "l8",
    name: "Hatem Qureshi",
    phone: "+962798008008",
    value: 75,
    stage: "new",
    notes: "Interested in membership",
    createdAt: "2026-03-10",
  },
];

// ─── Services ───
export const services = [
  {
    id: "svc-1",
    name: "Premium Haircut",
    price: 12,
    duration: 45,
    icon: "scissors",
  },
  {
    id: "svc-2",
    name: "Beard Trim & Shape",
    price: 8,
    duration: 30,
    icon: "scissors",
  },
  {
    id: "svc-3",
    name: "Haircut + Beard",
    price: 15,
    duration: 60,
    icon: "scissors",
  },
  {
    id: "svc-4",
    name: "Hot Towel Shave",
    price: 10,
    duration: 30,
    icon: "scissors",
  },
  {
    id: "svc-5",
    name: "Kids Haircut",
    price: 7,
    duration: 30,
    icon: "scissors",
  },
  {
    id: "svc-6",
    name: "Full Grooming Package",
    price: 20.5,
    duration: 75,
    icon: "sparkles",
  },
  {
    id: "svc-7",
    name: "Hair Coloring",
    price: 25,
    duration: 90,
    icon: "palette",
  },
  {
    id: "svc-8",
    name: "Facial Treatment",
    price: 18,
    duration: 45,
    icon: "heart",
  },
];

// ─── Acquisition Channels ───
export const acquisitionData = [
  { name: "Instagram", value: 38, color: "var(--accent-lavender)" },
  { name: "Word of Mouth", value: 28, color: "var(--accent-mint)" },
  { name: "Walk-in", value: 20, color: "var(--accent-blue)" },
  { name: "Google", value: 10, color: "var(--accent-amber)" },
  { name: "Other", value: 4, color: "var(--accent-rose)" },
];
