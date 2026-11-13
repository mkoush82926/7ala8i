/**
 * shop-media storage helpers (pure; safe on server and client).
 *
 * Object layout (first folder is always the shop id; enforced by the
 * storage.objects policies in 20250101002010_shop_media.sql):
 *   {shop}/photos/{uuid}.webp
 *   {shop}/portfolio/{uuid}.webp
 *   {shop}/barbers/{profileId}/{uuid}.webp
 */

export const SHOP_MEDIA_BUCKET = "shop-media";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Raw files above this are rejected before resizing (protects the tab). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"] as const;
export const MAX_SHOP_PHOTOS = 20;
export const MAX_PORTFOLIO_ITEMS = 60;
/** Long edge after client-side resize. */
export const PHOTO_MAX_EDGE = 1920;
export const AVATAR_MAX_EDGE = 512;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MediaKind = "photos" | "portfolio" | "barber";

export function mediaPath(kind: MediaKind, shopId: string, fileId: string, profileId?: string | null, ext = "webp"): string {
  if (!UUID.test(shopId)) throw new Error("INVALID_SHOP_ID");
  const safeId = fileId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "file";
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  if (kind === "barber") {
    if (!profileId || !UUID.test(profileId)) throw new Error("INVALID_PROFILE_ID");
    return `${shopId}/barbers/${profileId}/${safeId}.${safeExt}`;
  }
  return `${shopId}/${kind}/${safeId}.${safeExt}`;
}

/** Public URL for an object path (or passes absolute URLs through). */
export function publicMediaUrl(supabaseUrl: string | null | undefined, path: string | null | undefined): string | null {
  const p = (path ?? "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = (supabaseUrl ?? "").replace(/\/+$/, "");
  if (!base) return null;
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/${encoded}`;
}

/** Object path from a public URL in this bucket (for deletes), else null. */
export function pathFromPublicUrl(url: string | null | undefined): string | null {
  const marker = `/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/`;
  const u = url ?? "";
  const i = u.indexOf(marker);
  if (i < 0) return null;
  try {
    return decodeURIComponent(u.slice(i + marker.length).split("?")[0]);
  } catch {
    return null;
  }
}

/** next/image can optimise only allow-listed Supabase Storage URLs. */
export function isOptimizableUrl(url: string | null | undefined): boolean {
  return !!url && url.includes("/storage/v1/object/public/");
}

export type ImageFileError = "type" | "size";

export function validateImageFile(file: { type: string; size: number }): ImageFileError | null {
  const type = (file.type || "").toLowerCase();
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return "type";
  if (file.size > MAX_SOURCE_BYTES) return "size";
  return null;
}

/** Size that fits inside maxEdge, keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Source rectangle for a centred crop to `ratio` (w/h). */
export function centerCrop(width: number, height: number, ratio: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!(width > 0) || !(height > 0) || !(ratio > 0)) return { sx: 0, sy: 0, sw: width, sh: height };
  if (width / height > ratio) {
    const sw = Math.round(height * ratio);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / ratio);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

// ─── Ordering ───

export interface Sortable {
  id: string;
  sort_order: number;
}

/** Moves item `from` → `to` and renumbers sort_order 0..n-1. */
export function moveItem<T extends Sortable>(items: readonly T[], from: number, to: number): T[] {
  const list = [...items];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) {
    return list.map((item, i) => (item.sort_order === i ? item : { ...item, sort_order: i }));
  }
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return list.map((item, i) => (item.sort_order === i ? item : { ...item, sort_order: i }));
}

/** Rows whose sort_order differs between two orderings (to persist only those). */
export function changedOrder<T extends Sortable>(before: readonly T[], after: readonly T[]): { id: string; sort_order: number }[] {
  const prev = new Map(before.map((i) => [i.id, i.sort_order]));
  return after.filter((i) => prev.get(i.id) !== i.sort_order).map((i) => ({ id: i.id, sort_order: i.sort_order }));
}

export function sortByOrder<T extends { sort_order: number; created_at?: string | null }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );
}

/** Localised alt/caption with fallback to the other language, then a default. */
export function localizedText(locale: string, en: string | null | undefined, ar: string | null | undefined, fallback = ""): string {
  const first = locale === "ar" ? ar : en;
  const second = locale === "ar" ? en : ar;
  return (first ?? "").trim() || (second ?? "").trim() || fallback;
}
