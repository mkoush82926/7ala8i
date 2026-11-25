"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getBlockedTimes,
  getBlockTypes,
  getCalendarTeamMeta,
  getScheduleInputs,
  type BlockTypeRow,
  type BlockedTimeRow,
  type CalendarTeamMeta,
} from "@/lib/queries/appointments";
import { EMPTY_SCHEDULE, type ScheduleInputs } from "./calendar-model";

export interface CalendarService {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  categorySlug: string | null;
}

/**
 * Everything around the appointments for a range: blocked time, block types,
 * team order/colours, schedules (shading + "Scheduled team") and services
 * (category colours). Each part fails soft — the calendar still works without it.
 */
export function useCalendarData(from: string, to: string) {
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const barberKey = barbers.map((b) => b.id).join(",");

  const [blocks, setBlocks] = useState<BlockedTimeRow[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockTypeRow[]>([]);
  const [teamMeta, setTeamMeta] = useState<CalendarTeamMeta[]>([]);
  const [schedule, setSchedule] = useState<ScheduleInputs>(EMPTY_SCHEDULE);
  const [services, setServices] = useState<CalendarService[]>([]);
  const [blocksError, setBlocksError] = useState(false);
  const token = useRef(0);

  const loadBlocks = useCallback(async () => {
    if (!shopId) return;
    const mine = ++token.current;
    const { data, error } = await getBlockedTimes(supabase, shopId, from, to);
    if (mine !== token.current) return;
    setBlocksError(!!error);
    setBlocks(error ? [] : data ?? []);
  }, [supabase, shopId, from, to]);

  const loadStatic = useCallback(async () => {
    if (!shopId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = supabase as any;
    const [types, meta, svc] = await Promise.all([
      getBlockTypes(supabase, shopId),
      getCalendarTeamMeta(supabase, shopId),
      anyDb
        .from("services")
        .select("id, name, name_ar, duration, price, category:service_categories(slug)")
        .eq("shop_id", shopId),
    ]);
    setBlockTypes(types.data ?? []);
    setTeamMeta(meta.data ?? []);
    setServices(
      ((svc.data ?? []) as Record<string, unknown>[]).map((s) => ({
        id: String(s.id),
        name: String(s.name ?? ""),
        name_ar: (s.name_ar as string | null) ?? null,
        duration: Number(s.duration) || 0,
        price: Number(s.price) || 0,
        categorySlug: ((s.category as { slug?: string } | null)?.slug as string | undefined) ?? null,
      })),
    );
  }, [supabase, shopId]);

  const loadSchedule = useCallback(async () => {
    if (!shopId) return;
    const ids = barberKey ? barberKey.split(",") : [];
    const res = await getScheduleInputs(supabase, shopId, from, to, ids);
    setSchedule(res.error ? EMPTY_SCHEDULE : res);
  }, [supabase, shopId, from, to, barberKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/range change
    loadBlocks();
  }, [loadBlocks]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/range change
    loadStatic();
  }, [loadStatic]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/range change
    loadSchedule();
  }, [loadSchedule]);

  const categoryOf = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s.categorySlug]));
    return (serviceIds: string[]) => {
      for (const id of serviceIds) {
        const slug = map.get(id);
        if (slug) return slug;
      }
      return null;
    };
  }, [services]);

  return {
    blocks,
    blocksError,
    blockTypes,
    teamMeta,
    schedule,
    services,
    categoryOf,
    reloadBlocks: loadBlocks,
    reloadStatic: loadStatic,
    setTeamMeta,
    setBlockTypes,
  };
}
