"use client";

import React, { useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/recipes";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { publicEnv } from "@/lib/env";
import { ShopImage } from "../shop-image";
import { changedOrder, localizedText, MAX_SHOP_PHOTOS, moveItem, PHOTO_MAX_EDGE } from "../lib/media";
import { prepareImage, removeShopMedia, UploadError, uploadShopMedia } from "../lib/upload";
import { coverFromPhotos, LIMITS } from "./profile-form";
import type { AnyClient, UploadErrorCode } from "./types";
import { SettingsSection, TextField } from "./ui";
import { mapPhotoRow, type EditablePhoto } from "./use-public-profile";

const COVER_ASPECT = 16 / 9;

/** Gallery manager: upload (resized to WebP + blur), reorder, alt text, delete. First photo = cover. */
export function PhotosManager({
  supabase,
  shopId,
  photos,
  canEdit,
  onPhotos,
  onChanged,
}: {
  supabase: AnyClient;
  shopId: string;
  photos: EditablePhoto[];
  canEdit: boolean;
  onPhotos: (next: EditablePhoto[]) => void;
  onChanged: () => void;
}) {
  const { t, locale, formatNumber } = useTranslation();
  const pp = t.publicProfile;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditablePhoto | null>(null);
  const [altEn, setAltEn] = useState("");
  const [altAr, setAltAr] = useState("");
  const [savingAlt, setSavingAlt] = useState(false);
  const [deleting, setDeleting] = useState<EditablePhoto | null>(null);
  const remaining = Math.max(0, MAX_SHOP_PHOTOS - photos.length);

  const uploadErrorText = (code: UploadErrorCode) => pp.uploadErrors[code];

  /** Keeps shops.cover_url equal to the first photo (cards + og:image). */
  const syncCover = async (list: EditablePhoto[]) => {
    const cover = coverFromPhotos(list);
    await supabase.from("shops").update({ cover_url: cover }).eq("id", shopId);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, remaining);
    if (files.length > remaining) toast.info(interpolate(pp.photoLimit, { max: formatNumber(MAX_SHOP_PHOTOS) }));
    if (picked.length === 0) return;
    setUploading({ done: 0, total: picked.length });
    let list = [...photos];
    let failed = 0;
    for (const [i, file] of picked.entries()) {
      try {
        const img = await prepareImage(file, { maxEdge: PHOTO_MAX_EDGE, aspect: COVER_ASPECT });
        const path = await uploadShopMedia(supabase, "photos", shopId, img);
        const { data, error } = await supabase
          .from("shop_photos")
          .insert({
            shop_id: shopId,
            path,
            sort_order: list.length,
            width: img.width,
            height: img.height,
            blur_data: img.blurData,
          })
          .select("id, path, sort_order, alt_en, alt_ar, blur_data, created_at")
          .single();
        if (error || !data) {
          await removeShopMedia(supabase, [path]);
          throw new UploadError("upload");
        }
        const row = mapPhotoRow(data as Record<string, unknown>, publicEnv.supabaseUrl);
        if (row) {
          list = [...list, row];
          onPhotos(list);
        }
      } catch (err) {
        failed += 1;
        toast.error(`${file.name}: ${uploadErrorText(err instanceof UploadError ? err.code : "upload")}`);
      }
      setUploading({ done: i + 1, total: picked.length });
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length - failed > 0) {
      await syncCover(list);
      toast.success(interpolate(pp.photosUploaded, { count: formatNumber(picked.length - failed) }));
      onChanged();
    }
  };

  const move = async (from: number, to: number) => {
    const next = moveItem(photos, from, to);
    const changes = changedOrder(photos, next);
    if (changes.length === 0) return;
    const prev = photos;
    onPhotos(next);
    setBusyId(photos[from].id);
    const results = await Promise.all(
      changes.map((c) => supabase.from("shop_photos").update({ sort_order: c.sort_order }).eq("id", c.id)),
    );
    setBusyId(null);
    if (results.some((r) => r.error)) {
      onPhotos(prev);
      toast.error(pp.saveFailed);
      return;
    }
    if (from === 0 || to === 0) await syncCover(next);
    toast.success(pp.orderSaved);
  };

  const openAlt = (photo: EditablePhoto) => {
    setEditing(photo);
    setAltEn(photo.alt_en ?? "");
    setAltAr(photo.alt_ar ?? "");
  };

  const saveAlt = async () => {
    if (!editing) return;
    if (altEn.trim().length > LIMITS.alt || altAr.trim().length > LIMITS.alt) return;
    setSavingAlt(true);
    const patch = { alt_en: altEn.trim() || null, alt_ar: altAr.trim() || null };
    const { error } = await supabase.from("shop_photos").update(patch).eq("id", editing.id);
    setSavingAlt(false);
    if (error) {
      toast.error(pp.saveFailed);
      return;
    }
    onPhotos(photos.map((p) => (p.id === editing.id ? { ...p, ...patch } : p)));
    setEditing(null);
    toast.success(pp.saved);
  };

  const remove = async (photo: EditablePhoto) => {
    const { error } = await supabase.from("shop_photos").delete().eq("id", photo.id);
    if (error) {
      toast.error(pp.saveFailed);
      throw error;
    }
    await removeShopMedia(supabase, [photo.path]);
    const rest = photos.filter((p) => p.id !== photo.id);
    const renumbered = rest.map((p, i) => ({ ...p, sort_order: i }));
    onPhotos(renumbered);
    await Promise.all(
      changedOrder(rest, renumbered).map((c) => supabase.from("shop_photos").update({ sort_order: c.sort_order }).eq("id", c.id)),
    );
    await syncCover(renumbered);
    toast.success(pp.photoDeleted);
    onChanged();
  };

  const uploadButton = canEdit && (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button
        type="button"
        className={buttonClasses({ variant: "secondary" })}
        disabled={!!uploading || remaining === 0}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
        {uploading
          ? interpolate(pp.uploadingProgress, { done: formatNumber(uploading.done), total: formatNumber(uploading.total) })
          : pp.addPhotos}
      </button>
    </>
  );

  return (
    <SettingsSection
      id="photos"
      title={pp.photosTitle}
      description={interpolate(pp.photosDesc, { max: formatNumber(MAX_SHOP_PHOTOS) })}
      aside={photos.length > 0 ? uploadButton : undefined}
    >
      {uploading && (
        <p role="status" className="sr-only">
          {interpolate(pp.uploadingProgress, { done: formatNumber(uploading.done), total: formatNumber(uploading.total) })}
        </p>
      )}
      {photos.length === 0 ? (
        <EmptyState icon={ImagePlus} size="sm" title={pp.photosEmptyTitle} description={pp.photosEmptyDesc}>
          {uploadButton}
        </EmptyState>
      ) : (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={pp.photosTitle}>
          {photos.map((photo, i) => {
            const alt = localizedText(locale, photo.alt_en, photo.alt_ar, interpolate(pp.photoNumber, { n: formatNumber(i + 1) }));
            return (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-line bg-sunken">
                <div className="relative aspect-video">
                  <ShopImage src={photo.url} blurData={photo.blur_data} alt={alt} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                  {i === 0 && (
                    <span className="absolute top-2 start-2">
                      <Pill tone="brand" size="sm">
                        {pp.coverBadge}
                      </Pill>
                    </span>
                  )}
                  {busyId === photo.id && (
                    <span className="absolute inset-0 grid place-items-center bg-black/30" aria-hidden="true">
                      <Loader2 className="animate-spin text-white" size={20} />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 p-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-ink-muted" title={alt}>
                    {photo.alt_en || photo.alt_ar ? alt : pp.noAltText}
                  </p>
                  {canEdit && (
                    <>
                      <IconButton label={interpolate(pp.moveEarlier, { n: formatNumber(i + 1) })} disabled={i === 0 || !!busyId} onClick={() => void move(i, i - 1)}>
                        <ArrowUp size={16} aria-hidden="true" />
                      </IconButton>
                      <IconButton label={interpolate(pp.moveLater, { n: formatNumber(i + 1) })} disabled={i === photos.length - 1 || !!busyId} onClick={() => void move(i, i + 1)}>
                        <ArrowDown size={16} aria-hidden="true" />
                      </IconButton>
                      <IconButton label={interpolate(pp.editAlt, { n: formatNumber(i + 1) })} onClick={() => openAlt(photo)}>
                        <Pencil size={16} aria-hidden="true" />
                      </IconButton>
                      <IconButton label={interpolate(pp.deletePhoto, { n: formatNumber(i + 1) })} danger onClick={() => setDeleting(photo)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </IconButton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={pp.altTitle}
        description={pp.altDesc}
        size="sm"
        footer={
          <DialogFooter>
            <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => setEditing(null)}>
              {t.common.cancel}
            </button>
            <button type="button" className={buttonClasses({ variant: "primary" })} disabled={savingAlt} onClick={() => void saveAlt()}>
              {savingAlt && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {t.common.save}
            </button>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <TextField label={pp.altEn} value={altEn} onChange={setAltEn} dir="ltr" maxLength={LIMITS.alt} />
          <TextField label={pp.altAr} value={altAr} onChange={setAltAr} dir="rtl" maxLength={LIMITS.alt} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
        title={pp.deletePhotoTitle}
        description={pp.deletePhotoDesc}
        confirmLabel={t.common.delete}
        destructive
      />
    </SettingsSection>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "focus-ring inline-grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-40 " +
        (danger
          ? "text-danger-text hover:bg-card"
          : "text-ink-muted hover:bg-card hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

export default PhotosManager;
