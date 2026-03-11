import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { format, startOfDay, endOfDay } from "date-fns";

type Client = SupabaseClient<Database>;

// ─── Today's Appointments ───
export async function getTodayAppointments(supabase: Client, shopId: string) {
  const today = new Date();
  const start = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const end = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select("*")
    .eq("shop_id", shopId)
    .gte("start_time", start)
    .lte("start_time", end)
    .order("start_time", { ascending: true });
}

// ─── Upcoming (future pending/confirmed) ───
export async function getUpcomingAppointments(
  supabase: Client,
  shopId: string,
  limit = 5,
) {
  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select("*")
    .eq("shop_id", shopId)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", now)
    .order("start_time", { ascending: true })
    .limit(limit);
}

// ─── Appointments by Date Range ───
export async function getAppointmentsByDateRange(
  supabase: Client,
  shopId: string,
  startDate: string,
  endDate: string,
  barberId?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("appointments") as any)
    .select("*")
    .eq("shop_id", shopId)
    .gte("start_time", `${startDate}T00:00:00`)
    .lte("start_time", `${endDate}T23:59:59`)
    .order("start_time", { ascending: true });

  if (barberId) {
    query = query.eq("barber_id", barberId);
  }

  return query;
}

// ─── Get available slots for a date + barber ───
export async function getAvailableSlots(
  supabase: Client,
  shopId: string,
  date: string,
  barberId?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("appointments") as any)
    .select("start_time, end_time, barber_id")
    .eq("shop_id", shopId)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", `${date}T00:00:00`)
    .lte("start_time", `${date}T23:59:59`);

  if (barberId && barberId !== "any") {
    query = query.eq("barber_id", barberId);
  }

  return query;
}

// ─── Update appointment status ───
export async function updateAppointmentStatus(
  supabase: Client,
  appointmentId: string,
  status: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .select()
    .single();
}
