"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useAppointments } from "@/hooks/use-appointments";
import { invalidateDashboard } from "@/hooks/use-pos";
import {
  assignQueueEntry,
  checkInWalkIn,
  getQueue,
  getScheduleInputs,
  updateQueueEntry,
  type WalkInInput,
} from "@/lib/queries/appointments";
import { isActiveAppointmentStatus } from "@/lib/types";
import { EMPTY_SCHEDULE, fromIsoDay, isoDay, workRanges, type ScheduleInputs } from "./calendar-model";
import {
  DEFAULT_WALK_IN_MINUTES,
  estimateWaits,
  toQueueEntry,
  type BusyInterval,
  type QueueBarber,
  type QueueEntry,
} from "./queue-model";

export interface QueueService {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
}

/** Thrown by queue mutations; `code` is a key of t.error.codes (or null). */
export class QueueActionError extends Error {
  constructor(public code: string | null) {
    super(code ?? "QUEUE_ERROR");
  }
}

const codeOf = (err: { message?: string; code?: string } | null | undefined): string | null => {
  if (!err) return null;
  if (err.code === "23P01") return "SLOT_TAKEN";
  if (err.code === "42501") return "FORBIDDEN";
  return err.message && /^[A-Z_]+$/.test(err.message) ? err.message : null;
};

/**
 * Walk-in queue for today: entries (live via Realtime, with a polling
 * fallback), today's appointments and schedules for the wait estimates, and
 * the check-in / seat / left actions.
 */
export function useQueue() {
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const [today, setToday] = useState(() => isoDay(new Date()));
  const todayDate = useMemo(() => fromIsoDay(today), [today]);
  const { appointments, refresh: refreshAppointments } = useAppointments(todayDate);

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleInputs>(EMPTY_SCHEDULE);
  const [services, setServices] = useState<QueueService[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const token = useRef(0);

  const load = useCallback(async () => {
    if (!shopId) return;
    const mine = ++token.current;
    const since = fromIsoDay(today).toISOString();
    const { data, error: qErr } = await getQueue(supabase, shopId, since);
    if (mine !== token.current) return;
    setLoading(false);
    if (qErr) {
      setError(codeOf(qErr) ?? "LOAD_FAILED");
      return;
    }
    setError(null);
    setEntries((data ?? []).map(toQueueEntry));
  }, [supabase, shopId, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/range change
    load();
  }, [load]);

  // Services (durations) and today's schedules: fail soft.
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("services")
        .select("id, name, name_ar, duration, is_active")
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      setServices(
        ((data ?? []) as Record<string, unknown>[])
          .filter((s) => s.is_active !== false)
          .map((s) => ({ id: String(s.id), name: String(s.name ?? ""), name_ar: (s.name_ar as string | null) ?? null, duration: Number(s.duration) || 0 })),
      );
      const res = await getScheduleInputs(supabase, shopId, today, today, barbers.map((b) => b.id));
      if (!cancelled) setSchedule(res.error ? EMPTY_SCHEDULE : res);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, shopId, today, barbers]);

  // Live updates: Realtime on walk_in_queue (RLS applies), plus a 30 s poll
  // so a TV that lost its socket still converges. The clock ticks with it.
  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`walk_in_queue:${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "walk_in_queue", filter: `shop_id=eq.${shopId}` }, () => {
        load();
        refreshAppointments();
      })
      .subscribe();
    const timer = setInterval(() => {
      setNow(Date.now());
      const day = isoDay(new Date());
      setToday((prev) => (prev === day ? prev : day));
      load();
      refreshAppointments();
    }, 30_000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, shopId, load, refreshAppointments]);

  const durationById = useMemo(() => new Map(services.map((s) => [s.id, s.duration])), [services]);
  const durationOf = useCallback(
    (e: QueueEntry) => {
      const sum = e.serviceIds.reduce((acc, id) => acc + (durationById.get(id) ?? 0), 0);
      return sum > 0 ? sum : DEFAULT_WALK_IN_MINUTES;
    },
    [durationById],
  );

  const estimates = useMemo(() => {
    const dayStart = fromIsoDay(today).getTime();
    const queueBarbers: QueueBarber[] = barbers.map((b) => ({
      id: b.id,
      shifts: workRanges(b.id, today, schedule).map(([s, e]) => [dayStart + s * 60_000, dayStart + e * 60_000] as [number, number]),
    }));
    const busy: BusyInterval[] = appointments
      .filter((a) => a.barberId && isActiveAppointmentStatus(a.status))
      .map((a) => ({ barberId: a.barberId!, start: new Date(a.startTime).getTime(), end: new Date(a.endTime).getTime() }));
    return estimateWaits({ now, entries, barbers: queueBarbers, busy, durationOf });
  }, [today, barbers, schedule, appointments, now, entries, durationOf]);

  const waiting = useMemo(
    () => entries.filter((e) => e.status === "waiting").sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt) || a.ticketNo - b.ticketNo),
    [entries],
  );
  const serving = useMemo(() => entries.filter((e) => e.status === "serving"), [entries]);
  const finished = useMemo(
    () => entries.filter((e) => (e.status === "done" || e.status === "left") && e.checkedInAt >= fromIsoDay(today).toISOString()),
    [entries, today],
  );

  const checkIn = useCallback(
    async (input: WalkInInput) => {
      const { data, error: e } = await checkInWalkIn(supabase, shopId, input);
      if (e) throw new QueueActionError(codeOf(e));
      if (data) setEntries((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, toQueueEntry(data)]));
      return data ? toQueueEntry(data) : null;
    },
    [supabase, shopId],
  );

  const assign = useCallback(
    async (entryId: string, barberId?: string | null) => {
      const { data, error: e } = await assignQueueEntry(supabase, entryId, barberId ?? null);
      if (e) throw new QueueActionError(codeOf(e));
      invalidateDashboard();
      await Promise.all([load(), refreshAppointments()]);
      return data;
    },
    [supabase, load, refreshAppointments],
  );

  const setStatus = useCallback(
    async (entryId: string, status: "waiting" | "done" | "left") => {
      const before = entries.find((e) => e.id === entryId);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status } : e)));
      const { error: e } = await updateQueueEntry(supabase, entryId, { status });
      if (e) {
        if (before) setEntries((prev) => prev.map((x) => (x.id === entryId ? before : x)));
        throw new QueueActionError(codeOf(e));
      }
    },
    [supabase, entries],
  );

  return {
    loading,
    error,
    entries,
    waiting,
    serving,
    finished,
    estimates,
    services,
    durationOf,
    now,
    reload: load,
    checkIn,
    assign,
    setStatus,
  };
}
