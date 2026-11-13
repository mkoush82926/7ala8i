/**
 * Pure helpers for Settings › Public profile (WS-1A): form state for the
 * shop details / location and each barber's public card, validation that
 * mirrors the DB CHECKs in 20250101002010_shop_media.sql, and minimal
 * update payloads (only changed columns are sent).
 */
import { isValidLatLng, roundCoord } from "../lib/map";
import { LATIN_SLUG_RE, normalizeHandle } from "../lib/slug";

export const LIMITS = {
  description: 2000,
  landmark: 160,
  shopNameAr: 120,
  title: 80,
  bio: 1200,
  alt: 200,
  caption: 200,
  languages: 12,
  yearsMax: 70,
  handleMin: 2,
  handleMax: 48,
} as const;

/** Languages offered as chips (ISO 639-1). Others can still be stored. */
export const LANGUAGE_OPTIONS = ["ar", "en", "fr", "tr", "ru", "de", "es", "it", "ur", "hi", "ku", "fa"] as const;

const trimOrNull = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

// ─── Shop details + location ───

export interface ShopProfileRow {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  address: string | null;
  city_id: string | null;
  area_id: string | null;
  lat: number | null;
  lng: number | null;
  landmark_en: string | null;
  landmark_ar: string | null;
  slug: string | null;
  slug_ar: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  cover_url: string | null;
}

export interface DetailsForm {
  name_ar: string;
  description: string;
  description_ar: string;
}

export interface LocationForm {
  city_id: string;
  area_id: string;
  lat: number | null;
  lng: number | null;
  landmark_en: string;
  landmark_ar: string;
}

export function detailsFromRow(row: Pick<ShopProfileRow, "name_ar" | "description" | "description_ar">): DetailsForm {
  return { name_ar: row.name_ar ?? "", description: row.description ?? "", description_ar: row.description_ar ?? "" };
}

export function locationFromRow(
  row: Pick<ShopProfileRow, "city_id" | "area_id" | "lat" | "lng" | "landmark_en" | "landmark_ar">,
): LocationForm {
  return {
    city_id: row.city_id ?? "",
    area_id: row.area_id ?? "",
    lat: row.lat,
    lng: row.lng,
    landmark_en: row.landmark_en ?? "",
    landmark_ar: row.landmark_ar ?? "",
  };
}

export type FieldErrorCode = "tooLong" | "invalid" | "required" | "range";

export function validateDetails(form: DetailsForm): Partial<Record<keyof DetailsForm, FieldErrorCode>> {
  const errors: Partial<Record<keyof DetailsForm, FieldErrorCode>> = {};
  if (form.name_ar.trim().length > LIMITS.shopNameAr) errors.name_ar = "tooLong";
  if (form.description.trim().length > LIMITS.description) errors.description = "tooLong";
  if (form.description_ar.trim().length > LIMITS.description) errors.description_ar = "tooLong";
  return errors;
}

export function validateLocation(form: LocationForm): Partial<Record<keyof LocationForm, FieldErrorCode>> {
  const errors: Partial<Record<keyof LocationForm, FieldErrorCode>> = {};
  if (form.landmark_en.trim().length > LIMITS.landmark) errors.landmark_en = "tooLong";
  if (form.landmark_ar.trim().length > LIMITS.landmark) errors.landmark_ar = "tooLong";
  if ((form.lat === null) !== (form.lng === null)) errors.lat = "invalid";
  else if (form.lat !== null && !isValidLatLng(form.lat, form.lng)) errors.lat = "invalid";
  if (form.area_id && !form.city_id) errors.area_id = "required";
  return errors;
}

export function detailsPatch(before: DetailsForm, after: DetailsForm): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const key of ["name_ar", "description", "description_ar"] as const) {
    const a = trimOrNull(before[key]);
    const b = trimOrNull(after[key]);
    if (a !== b) patch[key] = b;
  }
  return patch;
}

export function locationPatch(before: LocationForm, after: LocationForm): Record<string, string | number | null> {
  const patch: Record<string, string | number | null> = {};
  for (const key of ["city_id", "area_id", "landmark_en", "landmark_ar"] as const) {
    const a = trimOrNull(before[key]);
    const b = trimOrNull(after[key]);
    if (a !== b) patch[key] = b;
  }
  const lat = after.lat === null ? null : roundCoord(after.lat);
  const lng = after.lng === null ? null : roundCoord(after.lng);
  if (lat !== before.lat) patch.lat = lat;
  if (lng !== before.lng) patch.lng = lng;
  // Changing the city invalidates an area of another city.
  if ("city_id" in patch && !("area_id" in patch) && before.area_id) patch.area_id = trimOrNull(after.area_id);
  return patch;
}

// ─── Barber public card ───

export interface BarberProfileRow {
  id: string;
  full_name: string;
  role: string | null;
  avatar_url: string | null;
  handle: string | null;
  title_en: string | null;
  title_ar: string | null;
  bio_en: string | null;
  bio_ar: string | null;
  languages: string[];
  years_experience: number | null;
  is_public: boolean;
}

export interface BarberForm {
  handle: string;
  title_en: string;
  title_ar: string;
  bio_en: string;
  bio_ar: string;
  languages: string[];
  years_experience: string;
  is_public: boolean;
}

export function barberFormFromRow(row: BarberProfileRow): BarberForm {
  return {
    handle: row.handle ?? "",
    title_en: row.title_en ?? "",
    title_ar: row.title_ar ?? "",
    bio_en: row.bio_en ?? "",
    bio_ar: row.bio_ar ?? "",
    languages: [...(row.languages ?? [])],
    years_experience: row.years_experience === null || row.years_experience === undefined ? "" : String(row.years_experience),
    is_public: row.is_public !== false,
  };
}

/** Parses the years field ("" = null). Returns undefined when invalid. */
export function parseYears(value: string): number | null | undefined {
  const v = value.trim();
  if (!v) return null;
  // Accept Arabic-Indic digits too.
  const latin = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (!/^\d{1,2}$/.test(latin)) return undefined;
  const n = Number(latin);
  return n >= 0 && n <= LIMITS.yearsMax ? n : undefined;
}

/** Lower-case 2–3 letter codes, de-duplicated, capped (mirrors the trigger). */
export function normalizeLanguages(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const code = raw.trim().toLowerCase();
    if (/^[a-z]{2,3}$/.test(code) && !out.includes(code)) out.push(code);
  }
  return out.slice(0, LIMITS.languages);
}

export function toggleLanguage(list: readonly string[], code: string): string[] {
  return list.includes(code) ? list.filter((l) => l !== code) : normalizeLanguages([...list, code]);
}

export function validateBarber(form: BarberForm): Partial<Record<keyof BarberForm, FieldErrorCode>> {
  const errors: Partial<Record<keyof BarberForm, FieldErrorCode>> = {};
  const handle = form.handle.trim().toLowerCase();
  if (!handle) errors.handle = "required";
  else if (handle.length < LIMITS.handleMin || handle.length > LIMITS.handleMax || !LATIN_SLUG_RE.test(handle))
    errors.handle = "invalid";
  if (form.title_en.trim().length > LIMITS.title) errors.title_en = "tooLong";
  if (form.title_ar.trim().length > LIMITS.title) errors.title_ar = "tooLong";
  if (form.bio_en.trim().length > LIMITS.bio) errors.bio_en = "tooLong";
  if (form.bio_ar.trim().length > LIMITS.bio) errors.bio_ar = "tooLong";
  if (parseYears(form.years_experience) === undefined) errors.years_experience = "range";
  return errors;
}

export function barberPatch(before: BarberForm, after: BarberForm): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const handleA = before.handle.trim().toLowerCase();
  const handleB = normalizeHandle(after.handle);
  if (handleB && handleA !== handleB) patch.handle = handleB;
  for (const key of ["title_en", "title_ar", "bio_en", "bio_ar"] as const) {
    const a = trimOrNull(before[key]);
    const b = trimOrNull(after[key]);
    if (a !== b) patch[key] = b;
  }
  const langA = normalizeLanguages(before.languages);
  const langB = normalizeLanguages(after.languages);
  if (langA.join(",") !== langB.join(",")) patch.languages = langB;
  const yearsA = parseYears(before.years_experience);
  const yearsB = parseYears(after.years_experience);
  if (yearsB !== undefined && yearsA !== yearsB) patch.years_experience = yearsB;
  if (before.is_public !== after.is_public) patch.is_public = after.is_public;
  return patch;
}

/** Maps a PostgREST/Postgres error to a settings error key. */
export type SaveErrorKey = "handleTaken" | "handleInvalid" | "forbidden" | "generic";

export function saveErrorKey(error: { message?: string | null; code?: string | null } | null | undefined): SaveErrorKey {
  const msg = error?.message ?? "";
  if (msg.includes("HANDLE_TAKEN") || (error?.code === "23505" && msg.includes("handle"))) return "handleTaken";
  if (msg.includes("INVALID_HANDLE") || msg.includes("profiles_handle_format")) return "handleInvalid";
  if (error?.code === "42501" || msg.includes("FORBIDDEN") || msg.includes("permission denied")) return "forbidden";
  return "generic";
}

/** Cover = first photo. Returns the URL the shops row should carry. */
export function coverFromPhotos(photos: readonly { url: string; sort_order: number }[]): string | null {
  if (photos.length === 0) return null;
  return [...photos].sort((a, b) => a.sort_order - b.sort_order)[0].url;
}
