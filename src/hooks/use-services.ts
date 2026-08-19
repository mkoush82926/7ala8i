"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";

export interface ServiceItem {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  icon: string | null;
  is_active: boolean;
}

export function useServices() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;

  const fetchServices = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("services") as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setServices(
        data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          name_ar: (row.name_ar as string) ?? null,
          duration: Number(row.duration),
          price: Number(row.price),
          icon: (row.icon as string) ?? null,
          is_active: row.is_active !== false,
        })),
      );
    } else if (error) {
      toast("error", "Failed to load services. Please try again.");
    }
    setLoading(false);
  }, [supabase, shopId]);

  useEffect(() => {
    // Fetch-on-mount/dependency-change is the intended behavior here, not a
    // derived-state anti-pattern — there is no non-effect way to trigger this load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServices();
  }, [fetchServices]);

  const addService = useCallback(
    async (data: { name: string; name_ar?: string | null; duration: number; price: number; icon?: string }) => {
      if (!shopId) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase.from("services") as any)
        .insert({
          shop_id: shopId,
          name: data.name,
          name_ar: data.name_ar ?? null,
          duration: data.duration,
          price: data.price,
          icon: data.icon ?? null,
        })
        .select()
        .single();

      if (!error && result) {
        const newItem: ServiceItem = {
          id: result.id,
          name: result.name,
          name_ar: result.name_ar,
          duration: Number(result.duration),
          price: Number(result.price),
          icon: result.icon,
          is_active: true,
        };
        setServices((prev) => [...prev, newItem]);
      } else {
        toast("error", "Failed to add service. Please try again.");
      }
    },
    [supabase, shopId],
  );

  const updateService = useCallback(
    async (id: string, data: Partial<{ name: string; name_ar: string | null; duration: number; price: number; icon: string }>) => {
      const previous = services.find((s) => s.id === id);
      // Optimistic update
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data } : s)),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("services") as any)
        .update(data)
        .eq("id", id);

      if (error) {
        if (previous) {
          setServices((prev) => prev.map((s) => (s.id === id ? previous : s)));
        }
        toast("error", "Failed to update service. Please try again.");
      }
    },
    [supabase, services],
  );

  const deleteService = useCallback(
    async (id: string) => {
      const previous = services;
      setServices((prev) => prev.filter((s) => s.id !== id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("services") as any).delete().eq("id", id);

      if (error) {
        setServices(previous);
        toast("error", "Failed to delete service. Please try again.");
      }
    },
    [supabase, services],
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean) => {
      const previous = services.find((s) => s.id === id);
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: isActive } : s)),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("services") as any)
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) {
        if (previous) {
          setServices((prev) => prev.map((s) => (s.id === id ? previous : s)));
        }
        toast("error", "Failed to update service. Please try again.");
      }
    },
    [supabase, services],
  );

  const reorderServices = useCallback(
    async (orderedIds: string[]) => {
      const previous = services;
      const reordered = orderedIds
        .map((id) => previous.find((s) => s.id === id))
        .filter(Boolean) as ServiceItem[];
      setServices(reordered);

      // Persist the new order to the `sort_order` column
      const results = await Promise.all(
        reordered.map((service, index) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("services") as any)
            .update({ sort_order: index })
            .eq("id", service.id),
        ),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failed = results.find((r: any) => r.error);
      if (failed) {
        setServices(previous);
        toast("error", "Failed to save new order. Please try again.");
      }
    },
    [services, supabase],
  );

  return {
    services,
    loading,
    addService,
    updateService,
    deleteService,
    toggleActive,
    reorderServices,
    refetch: fetchServices,
  };
}
