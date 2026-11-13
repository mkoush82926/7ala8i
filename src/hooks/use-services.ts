"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import {
  getServices,
  createService,
  updateService as updateServiceQuery,
  removeService as removeServiceQuery,
  saveServiceOrder,
  type ServiceWrite,
} from "@/lib/queries/services";

export interface ServiceItem {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  icon: string | null;
  is_active: boolean;
}

export type ServiceInputData = ServiceWrite;

function toItem(row: Record<string, unknown>): ServiceItem {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    name_ar: (row.name_ar as string | null) ?? null,
    duration: Number(row.duration) || 0,
    price: Number(row.price) || 0,
    icon: (row.icon as string | null) ?? null,
    is_active: row.is_active !== false,
  };
}

/**
 * Services CRUD for the current shop.
 *
 * Every mutation resolves to a success value (never throws) and shows a
 * translated toast, so callers decide what to do with the UI (e.g. keep a
 * dialog open on failure). Optimistic updates are rolled back on error.
 */
export function useServices() {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currency, setCurrency] = useState("JOD");
  const shopId = useWorkspaceStore((s) => s.shopId);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const [supabase] = useState(() => createClient());

  // Latest list for rollbacks without re-creating callbacks on every change.
  const servicesRef = useRef<ServiceItem[]>([]);
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchServices = useCallback(async () => {
    if (!shopId) {
      // No shop (yet): stop the spinner once the workspace has resolved, so
      // users without a shop see the empty state instead of loading forever.
      if (hydrated) setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);

    const [servicesRes, shopRes] = await Promise.all([
      getServices(supabase, shopId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("shops") as any).select("currency").eq("id", shopId).maybeSingle(),
    ]);

    if (servicesRes.error) {
      setLoadError(true);
      toast.error(tRef.current.services.loadFailed);
    } else {
      setServices(((servicesRes.data ?? []) as Record<string, unknown>[]).map(toItem));
    }
    const shopCurrency = (shopRes?.data as { currency?: string | null } | null)?.currency;
    if (shopCurrency) setCurrency(shopCurrency);
    setLoading(false);
  }, [supabase, shopId, hydrated]);

  useEffect(() => {
    // Fetch-on-mount/dependency-change is the intended behavior here, not a
    // derived-state anti-pattern — there is no non-effect way to trigger this load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServices();
  }, [fetchServices]);

  const addService = useCallback(
    async (data: ServiceInputData): Promise<boolean> => {
      if (!shopId) return false;
      const nextOrder = servicesRef.current.length;
      const { data: row, error } = await createService(supabase, shopId, { ...data, sort_order: nextOrder });
      if (error || !row) {
        toast.error(tRef.current.services.saveFailed);
        return false;
      }
      setServices((prev) => [...prev, toItem(row as Record<string, unknown>)]);
      toast.success(tRef.current.services.created);
      return true;
    },
    [supabase, shopId],
  );

  const updateService = useCallback(
    async (id: string, data: Partial<ServiceInputData>): Promise<boolean> => {
      const previous = servicesRef.current.find((s) => s.id === id);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } as ServiceItem : s)));

      const { error } = await updateServiceQuery(supabase, id, data);
      if (error) {
        if (previous) setServices((prev) => prev.map((s) => (s.id === id ? previous : s)));
        toast.error(tRef.current.services.saveFailed);
        return false;
      }
      toast.success(tRef.current.services.updated);
      return true;
    },
    [supabase],
  );

  /**
   * Removes a service safely: services used by any appointment are archived
   * (hidden from booking, history kept); unused ones are deleted.
   */
  const removeService = useCallback(
    async (id: string): Promise<"archived" | "deleted" | null> => {
      if (!shopId) return null;
      const { result, error } = await removeServiceQuery(supabase, shopId, id);
      if (error || !result) {
        toast.error(tRef.current.services.deleteFailed);
        return null;
      }
      if (result === "deleted") {
        setServices((prev) => prev.filter((s) => s.id !== id));
        toast.success(tRef.current.services.deleted);
      } else {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: false } : s)));
        toast.success(tRef.current.services.archived);
      }
      return result;
    },
    [supabase, shopId],
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      const previous = servicesRef.current.find((s) => s.id === id);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: isActive } : s)));
      const { error } = await updateServiceQuery(supabase, id, { is_active: isActive });
      if (error) {
        if (previous) setServices((prev) => prev.map((s) => (s.id === id ? previous : s)));
        toast.error(tRef.current.services.saveFailed);
        return false;
      }
      toast.success(isActive ? tRef.current.services.activated : tRef.current.services.deactivated);
      return true;
    },
    [supabase],
  );

  const reorderServices = useCallback(
    async (orderedIds: string[]): Promise<boolean> => {
      const previous = servicesRef.current;
      const byId = new Map(previous.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as ServiceItem[];
      if (reordered.length !== previous.length) return false;
      setServices(reordered);

      const { error } = await saveServiceOrder(
        supabase,
        orderedIds,
        previous.map((s) => s.id),
      );
      if (error) {
        setServices(previous);
        toast.error(tRef.current.services.reorderFailed);
        return false;
      }
      return true;
    },
    [supabase],
  );

  return {
    services,
    loading,
    error: loadError,
    currency,
    addService,
    updateService,
    removeService,
    /** @deprecated use removeService (archives services that have bookings) */
    deleteService: removeService,
    toggleActive,
    reorderServices,
    refetch: fetchServices,
  };
}
