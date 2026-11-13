"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import {
  getServices,
  getVariants,
  getCategories,
  getBookingRules,
  updateBookingRules,
  createService,
  updateService as updateServiceQuery,
  removeService as removeServiceQuery,
  saveServiceOrder,
  saveVariants,
  type Audience,
  type BookingRules,
  type CategoryRow,
  type LocationType,
  type PriceType,
  type ServiceWrite,
  type VariantDraft,
  type VariantRow,
} from "@/lib/queries/services";

export interface ServiceItem {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  icon: string | null;
  is_active: boolean;
  price_type: PriceType;
  audience: Audience;
  location_type: LocationType;
  description_en: string | null;
  description_ar: string | null;
  client_note_en: string | null;
  client_note_ar: string | null;
  online_bookable: boolean;
  category_id: string | null;
  buffer_minutes: number;
  processing_offset_minutes: number;
  processing_minutes: number;
  variants: VariantRow[];
}

export type ServiceInputData = ServiceWrite;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function toServiceItem(row: Record<string, unknown>, variants: ReadonlyArray<VariantRow> = []): ServiceItem {
  const id = row.id as string;
  return {
    id,
    name: (row.name as string) ?? "",
    name_ar: (row.name_ar as string | null) ?? null,
    duration: Number(row.duration) || 0,
    price: Number(row.price) || 0,
    icon: (row.icon as string | null) ?? null,
    is_active: row.is_active !== false,
    price_type: oneOf(row.price_type, ["fixed", "from", "free"] as const, "fixed"),
    audience: oneOf(row.audience, ["everyone", "men", "women", "kids"] as const, "everyone"),
    location_type: oneOf(row.location_type, ["in_shop", "home"] as const, "in_shop"),
    description_en: (row.description_en as string | null) ?? null,
    description_ar: (row.description_ar as string | null) ?? null,
    client_note_en: (row.client_note_en as string | null) ?? null,
    client_note_ar: (row.client_note_ar as string | null) ?? null,
    online_bookable: row.online_bookable !== false,
    category_id: (row.category_id as string | null) ?? null,
    buffer_minutes: Number(row.buffer_minutes) || 0,
    processing_offset_minutes: Number(row.processing_offset_minutes) || 0,
    processing_minutes: Number(row.processing_minutes) || 0,
    variants: variants.filter((v) => v.service_id === id && v.is_active).sort((a, b) => a.sort - b.sort),
  };
}

/**
 * Services catalogue for the current shop: services (+ variants), the
 * marketplace categories and the shop's online booking rules.
 *
 * Every mutation resolves to a success value (never throws) and shows a
 * translated toast, so callers decide what to do with the UI (e.g. keep a
 * dialog open on failure). Optimistic updates are rolled back on error.
 */
export function useServices() {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [rules, setRules] = useState<BookingRules | null>(null);
  /** The database predates the v2 catalogue (only the legacy fields save). */
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currency, setCurrency] = useState("JOD");
  const shopId = useWorkspaceStore((s) => s.shopId);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const [supabase] = useState(() => createClient());

  // Latest lists for rollbacks without re-creating callbacks on every change.
  const servicesRef = useRef<ServiceItem[]>([]);
  const variantsRef = useRef<VariantRow[]>([]);
  useEffect(() => {
    servicesRef.current = services;
    variantsRef.current = variants;
  }, [services, variants]);

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

    const [servicesRes, variantsRes, categoriesRes, rulesRes, shopRes] = await Promise.all([
      getServices(supabase, shopId),
      getVariants(supabase, shopId),
      getCategories(supabase),
      getBookingRules(supabase, shopId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("shops") as any).select("currency").eq("id", shopId).maybeSingle(),
    ]);

    const variantRows = variantsRes.error ? [] : variantsRes.data;
    setVariants(variantRows);
    if (servicesRes.error) {
      setLoadError(true);
      toast.error(tRef.current.services.loadFailed);
    } else {
      setLegacy(servicesRes.legacy);
      setServices((servicesRes.data ?? []).map((row) => toServiceItem(row, variantRows)));
    }
    setCategories(categoriesRes.error ? [] : categoriesRes.data);
    setRules(rulesRes.error ? null : rulesRes.data);
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

  /** Reloads one service's variants after a save. */
  const reloadVariants = useCallback(async () => {
    if (!shopId) return [];
    const res = await getVariants(supabase, shopId);
    if (res.error) return variantsRef.current;
    setVariants(res.data);
    return res.data;
  }, [supabase, shopId]);

  const addService = useCallback(
    async (data: ServiceInputData, variantDrafts: VariantDraft[] = []): Promise<boolean> => {
      if (!shopId) return false;
      const nextOrder = servicesRef.current.length;
      const { data: row, error } = await createService(supabase, shopId, { ...data, sort_order: nextOrder });
      if (error || !row) {
        toast.error(tRef.current.services.saveFailed);
        return false;
      }
      let variantRows = variantsRef.current;
      if (variantDrafts.length) {
        const res = await saveVariants(supabase, String(row.id), [], variantDrafts);
        if (res.error) toast.error(tRef.current.services.variantsFailed);
        variantRows = await reloadVariants();
      }
      setServices((prev) => [...prev, toServiceItem(row, variantRows)]);
      toast.success(tRef.current.services.created);
      return true;
    },
    [supabase, shopId, reloadVariants],
  );

  const updateService = useCallback(
    async (id: string, data: Partial<ServiceInputData>, variantDrafts?: VariantDraft[]): Promise<boolean> => {
      const previous = servicesRef.current.find((s) => s.id === id);
      setServices((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...data } as ServiceItem) : s)));

      const { data: row, error } = await updateServiceQuery(supabase, id, data);
      if (error) {
        if (previous) setServices((prev) => prev.map((s) => (s.id === id ? previous : s)));
        toast.error(tRef.current.services.saveFailed);
        return false;
      }
      let variantRows = variantsRef.current;
      if (variantDrafts) {
        const res = await saveVariants(supabase, id, variantsRef.current, variantDrafts);
        if (res.error) toast.error(tRef.current.services.variantsFailed);
        variantRows = await reloadVariants();
      }
      if (row) setServices((prev) => prev.map((s) => (s.id === id ? toServiceItem(row, variantRows) : s)));
      toast.success(tRef.current.services.updated);
      return true;
    },
    [supabase, reloadVariants],
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

  const saveRules = useCallback(
    async (next: BookingRules): Promise<boolean> => {
      if (!shopId) return false;
      const { error } = await updateBookingRules(supabase, shopId, next);
      if (error) {
        toast.error(tRef.current.services.rulesFailed);
        return false;
      }
      setRules(next);
      toast.success(tRef.current.services.rulesSaved);
      return true;
    },
    [supabase, shopId],
  );

  return {
    services,
    categories,
    rules,
    legacy,
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
    saveRules,
    refetch: fetchServices,
  };
}
