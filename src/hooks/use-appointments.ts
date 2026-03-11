"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { format } from "date-fns";

export interface CalendarAppointment {
  id: string;
  clientName: string;
  barberId: string | null;
  barberName: string;
  service: string;
  price: number;
  date: string;
  time: string;
  duration: number;
  status: "pending" | "confirmed" | "completed" | "no-show" | "cancelled";
}

export function useAppointments(date: Date) {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const supabase = useRef(createClient()).current;

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const dayStart = `${dateStr}T00:00:00`;
      const dayEnd = `${dateStr}T23:59:59`;

      const { data, error } = await supabase
        .from("appointments")
        .select("*, profiles:barber_id(full_name)")
        .eq("shop_id", shopId)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time");

      if (error || !data || data.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const mapped: CalendarAppointment[] = data.map((a: Record<string, unknown>) => {
        const start = new Date(a.start_time as string);
        const end = new Date(a.end_time as string);
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);
        const barberProfile = a.profiles as { full_name: string } | null;
        const barberName = barberProfile?.full_name
          || barbers.find((b) => b.id === a.barber_id)?.name
          || "Any";

        return {
          id: a.id as string,
          clientName: a.client_name as string,
          barberId: a.barber_id as string | null,
          barberName,
          service: "Appointment",
          price: Number(a.price),
          date: format(start, "yyyy-MM-dd"),
          time: format(start, "HH:mm"),
          duration,
          status: (a.status as string) === "cancelled" ? "cancelled" : (a.status as CalendarAppointment["status"]),
        };
      });

      setAppointments(mapped);
    } catch {
      setAppointments([]);
    }
    setLoading(false);
  }, [supabase, shopId, dateStr, barbers]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const updateStatus = useCallback(async (appointmentId: string, status: CalendarAppointment["status"]) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a)),
    );

    try {
      await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);
    } catch { /* optimistic update stays */ }
  }, [supabase]);

  return { appointments, loading, refetch: fetchAppointments, updateStatus };
}
