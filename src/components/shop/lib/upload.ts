"use client";

/**
 * Browser-side image preparation + upload to the shop-media bucket:
 * decode → (optional centre crop) → resize → WebP, plus a ~16px blur
 * placeholder data URL stored with the row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { centerCrop, fitWithin, MAX_UPLOAD_BYTES, mediaPath, SHOP_MEDIA_BUCKET, validateImageFile, type MediaKind } from "./media";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export class UploadError extends Error {
  constructor(public code: "type" | "size" | "decode" | "upload" | "too_large") {
    super(code);
    this.name = "UploadError";
  }
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  blurData: string | null;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      // fall back to <img> (e.g. Safari without options support)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, opts: { maxEdge: number; aspect?: number }): Promise<PreparedImage> {
  const invalid = validateImageFile(file);
  if (invalid) throw new UploadError(invalid);
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new UploadError("decode");
  }
  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;
  const crop = opts.aspect ? centerCrop(srcW, srcH, opts.aspect) : { sx: 0, sy: 0, sw: srcW, sh: srcH };
  const size = fitWithin(crop.sw, crop.sh, opts.maxEdge);
  if (!size.width || !size.height) throw new UploadError("decode");

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UploadError("decode");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height);

  let blob = await canvasToBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new UploadError("decode");
  if (blob.size > MAX_UPLOAD_BYTES) {
    blob = (await canvasToBlob(canvas, blob.type, 0.6)) ?? blob;
    if (blob.size > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  }

  // Tiny blurred preview (≤16px), stored as a data URL.
  let blurData: string | null = null;
  try {
    const tiny = fitWithin(size.width, size.height, 16);
    const small = document.createElement("canvas");
    small.width = tiny.width;
    small.height = tiny.height;
    small.getContext("2d")?.drawImage(canvas, 0, 0, tiny.width, tiny.height);
    const url = small.toDataURL("image/webp", 0.5);
    blurData = url.startsWith("data:image/") && url.length <= 4000 ? url : null;
  } catch {
    blurData = null;
  }
  if ("close" in source && typeof source.close === "function") source.close();
  return { blob, width: size.width, height: size.height, blurData };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Uploads a prepared image; returns its object path. */
export async function uploadShopMedia(
  supabase: AnyClient,
  kind: MediaKind,
  shopId: string,
  image: PreparedImage,
  profileId?: string | null,
): Promise<string> {
  const ext = image.blob.type === "image/jpeg" ? "jpg" : "webp";
  const path = mediaPath(kind, shopId, newId(), profileId, ext);
  const { error } = await supabase.storage.from(SHOP_MEDIA_BUCKET).upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new UploadError("upload");
  return path;
}

/** Best-effort removal (the row is the source of truth). */
export async function removeShopMedia(supabase: AnyClient, paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return;
  try {
    await supabase.storage.from(SHOP_MEDIA_BUCKET).remove(clean);
  } catch {
    /* orphaned object; harmless */
  }
}
