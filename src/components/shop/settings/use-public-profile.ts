"use client";

/**
 * Loads everything Settings › Public profile edits, in one round of parallel
 * queries: the shop row, the publish checklist, photos, portfolio, amenities,
 * team cards, cities/areas and services (to tag portfolio items).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";
import { publicMediaUrl, sortByOrder } from "../lib/media";
import type { Amenity } from "../lib/types";
import type { ChecklistState } from "../lib/checklist";
import type { BarberProfileRow, ShopProfileRow } from "./profile-form";
import type { AnyClient } from "./types";

export interface PlaceOption {
  id: string;
  city_id?: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

export interface EditablePhoto {
  id: string;
  path: string;
  url: string;
  sort_order: number;
  alt_en: string | null;
  alt_ar: string | null;
  blur_data: string | null;
  created_at?: string | null;
}

export interface EditablePortfolioItem {
  id: string;
  barber_id: string | null;
  service_id: string | null;
  path: string;
  url: string;
  caption: string | null;
  caption_ar: string | null;
  sort_order: number;
  is_featured: boolean;
  blur_data: string | null;
  created_at?: string | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  name_ar: string | null;
}

export interface PublicProfileState {
  shop: ShopProfileRow;
  checklist: ChecklistState;
  photos: EditablePhoto[];
  portfolio: EditablePortfolioItem[];
  amenities: Amenity[];
  selectedAmenities: string[];
  team: BarberProfileRow[];
  cities: PlaceOption[];
  areas: PlaceOption[];
  services: ServiceOption[];
}

const SHOP_COLS =
  "id, name, name_ar, description, description_ar, address, city_id, area_id, lat, lng, landmark_en, landmark_ar, slug, slug_ar, is_published, marketplace_visible, cover_url";
const TEAM_COLS = "id, full_name, role, avatar_url, handle, title_en, title_ar, bio_en, bio_ar, languages, years_experience, is_public";

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

export function mapPhotoRow(row: Row, base: string | null | undefined): EditablePhoto | null {
  const path = s(row.path);
  const url = publicMediaUrl(base, path);
  if (!path || !url) return null;
  return {
    id: String(row.id),
    path,
    url,
    sort_order: n(row.sort_order) ?? 0,
    alt_en: s(row.alt_en),
    alt_ar: s(row.alt_ar),
    blur_data: s(row.blur_data),
    created_at: s(row.created_at),
  };
}

export function mapPortfolioRow(row: Row, base: string | null | undefined): EditablePortfolioItem | null {
  const path = s(row.path);
  const url = publicMediaUrl(base, path);
  if (!path || !url) return null;
  return {
    id: String(row.id),
    barber_id: s(row.barber_id),
    service_id: s(row.service_id),
    path,
    url,
    caption: s(row.caption),
    caption_ar: s(row.caption_ar),
    sort_order: n(row.sort_order) ?? 0,
    is_featured: row.is_featured === true,
    blur_data: s(row.blur_data),
    created_at: s(row.created_at),
  };
}

function mapShop(row: Row): ShopProfileRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    name_ar: s(row.name_ar),
    description: s(row.description),
    description_ar: s(row.description_ar),
    address: s(row.address),
    city_id: s(row.city_id),
    area_id: s(row.area_id),
    lat: n(row.lat),
    lng: n(row.lng),
    landmark_en: s(row.landmark_en),
    landmark_ar: s(row.landmark_ar),
    slug: s(row.slug),
    slug_ar: s(row.slug_ar),
    is_published: row.is_published === true,
    marketplace_visible: row.marketplace_visible !== false,
    cover_url: s(row.cover_url),
  };
}

function mapTeam(row: Row): BarberProfileRow {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? "").trim(),
    role: s(row.role),
    avatar_url: s(row.avatar_url),
    handle: s(row.handle),
    title_en: s(row.title_en),
    title_ar: s(row.title_ar),
    bio_en: s(row.bio_en),
    bio_ar: s(row.bio_ar),
    languages: Array.isArray(row.languages) ? (row.languages as unknown[]).filter((l): l is string => typeof l === "string") : [],
    years_experience: n(row.years_experience),
    is_public: row.is_public !== false,
  };
}

export type LoadStatus = "loading" | "ready" | "error";

export function usePublicProfile(supabase: AnyClient, shopId: string | null) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [state, setState] = useState<PublicProfileState | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!shopId) return;
      const mine = ++seq.current;
      if (!quiet) setStatus("loading");
      const base = publicEnv.supabaseUrl;
      try {
        const [shopRes, checkRes, photoRes, portRes, amRes, selRes, teamRes, cityRes, areaRes, svcRes] = await Promise.all([
          supabase.from("shops").select(SHOP_COLS).eq("id", shopId).maybeSingle(),
          supabase.rpc("get_shop_publish_checklist", { p_shop_id: shopId }),
          supabase.from("shop_photos").select("id, path, sort_order, alt_en, alt_ar, blur_data, created_at").eq("shop_id", shopId).order("sort_order"),
          supabase
            .from("portfolio_items")
            .select("id, barber_id, service_id, path, caption, caption_ar, sort_order, is_featured, blur_data, created_at")
            .eq("shop_id", shopId)
            .order("sort_order"),
          supabase.from("amenities").select("id, slug, name_en, name_ar, icon, sort").eq("is_active", true).order("sort"),
          supabase.from("shop_amenities").select("amenity_id").eq("shop_id", shopId),
          supabase.from("profiles").select(TEAM_COLS).eq("shop_id", shopId).in("role", ["shop_admin", "barber"]).order("full_name"),
          supabase.from("cities").select("id, name_en, name_ar, sort").order("sort"),
          supabase.from("areas").select("id, city_id, name_en, name_ar, sort").order("sort"),
          supabase.from("services").select("id, name, name_ar").eq("shop_id", shopId).eq("is_active", true).order("name"),
        ]);
        if (mine !== seq.current) return;
        if (shopRes.error || !shopRes.data) throw shopRes.error ?? new Error("SHOP_NOT_FOUND");
        const check = (checkRes.data ?? null) as { items?: ChecklistState } | null;
        setState({
          shop: mapShop(shopRes.data as Row),
          checklist: check?.items ?? {},
          photos: sortByOrder(((photoRes.data ?? []) as Row[]).map((r) => mapPhotoRow(r, base)).filter((p): p is EditablePhoto => !!p)),
          portfolio: sortByOrder(
            ((portRes.data ?? []) as Row[]).map((r) => mapPortfolioRow(r, base)).filter((p): p is EditablePortfolioItem => !!p),
          ),
          amenities: ((amRes.data ?? []) as Amenity[]).map((a) => ({ ...a, sort: Number(a.sort) || 0 })),
          selectedAmenities: ((selRes.data ?? []) as { amenity_id: string }[]).map((r) => r.amenity_id),
          team: ((teamRes.data ?? []) as Row[]).map(mapTeam),
          cities: ((cityRes.data ?? []) as PlaceOption[]) ?? [],
          areas: ((areaRes.data ?? []) as PlaceOption[]) ?? [],
          services: ((svcRes.data ?? []) as ServiceOption[]) ?? [],
        });
        setStatus("ready");
      } catch {
        if (mine !== seq.current) return;
        if (!quiet) setStatus("error");
      }
    },
    [supabase, shopId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** Optimistic local edits (sections call reload(true) to resync). */
  const patch = useCallback((fn: (prev: PublicProfileState) => PublicProfileState) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  return { status, state, reload: load, patch };
}
