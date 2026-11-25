"use client";

import React, { useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/recipes";
import { ImagePlus, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { publicEnv } from "@/lib/env";
import { ShopImage } from "../shop-image";
import { localizedText, MAX_PORTFOLIO_ITEMS, PHOTO_MAX_EDGE } from "../lib/media";
import { prepareImage, removeShopMedia, UploadError, uploadShopMedia } from "../lib/upload";
import { LIMITS, type BarberProfileRow } from "./profile-form";
import { IconButton } from "./photos-manager";
import type { AnyClient } from "./types";
import { SettingsSection, Switch, TextField } from "./ui";
import { mapPortfolioRow, type EditablePortfolioItem, type ServiceOption } from "./use-public-profile";

const PORTFOLIO_SELECT = "id, barber_id, service_id, path, caption, caption_ar, sort_order, is_featured, blur_data, created_at";

/**
 * Portfolio: square work photos credited to a barber, optionally tagged with
 * a service. Admins manage every item; a barber manages items credited to
 * themselves (RLS + storage policies enforce the same rule).
 */
export function PortfolioManager({
  supabase,
  shopId,
  items,
  team,
  services,
  userId,
  isAdmin,
  onItems,
  onChanged,
}: {
  supabase: AnyClient;
  shopId: string;
  items: EditablePortfolioItem[];
  team: BarberProfileRow[];
  services: ServiceOption[];
  userId: string | null;
  isAdmin: boolean;
  onItems: (next: EditablePortfolioItem[]) => void;
  onChanged: () => void;
}) {
  const { t, locale, formatNumber } = useTranslation();
  const pp = t.publicProfile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string>(isAdmin ? "" : (userId ?? ""));
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [editing, setEditing] = useState<EditablePortfolioItem | null>(null);
  const [deleting, setDeleting] = useState<EditablePortfolioItem | null>(null);
  const remaining = Math.max(0, MAX_PORTFOLIO_ITEMS - items.length);
  const canManage = (item: EditablePortfolioItem) => isAdmin || (!!userId && item.barber_id === userId);
  const barberName = (id: string | null) => team.find((m) => m.id === id)?.full_name ?? null;
  const serviceName = (id: string | null) => {
    const s = services.find((x) => x.id === id);
    return s ? (locale === "ar" && s.name_ar) || s.name : null;
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, remaining);
    if (picked.length === 0) {
      toast.info(interpolate(pp.portfolioLimit, { max: formatNumber(MAX_PORTFOLIO_ITEMS) }));
      return;
    }
    const barberId = isAdmin ? uploadFor || null : userId;
    setUploading({ done: 0, total: picked.length });
    let list = [...items];
    let ok = 0;
    for (const [i, file] of picked.entries()) {
      try {
        const img = await prepareImage(file, { maxEdge: PHOTO_MAX_EDGE / 2, aspect: 1 });
        // A barber may only write under barbers/{self}/; admins use portfolio/.
        const path = isAdmin
          ? await uploadShopMedia(supabase, "portfolio", shopId, img)
          : await uploadShopMedia(supabase, "barber", shopId, img, userId);
        const { data, error } = await supabase
          .from("portfolio_items")
          .insert({ shop_id: shopId, barber_id: barberId, path, sort_order: list.length, blur_data: img.blurData })
          .select(PORTFOLIO_SELECT)
          .single();
        if (error || !data) {
          await removeShopMedia(supabase, [path]);
          throw new UploadError("upload");
        }
        const row = mapPortfolioRow(data as Record<string, unknown>, publicEnv.supabaseUrl);
        if (row) {
          list = [...list, row];
          onItems(list);
          ok += 1;
        }
      } catch (err) {
        toast.error(`${file.name}: ${pp.uploadErrors[err instanceof UploadError ? err.code : "upload"]}`);
      }
      setUploading({ done: i + 1, total: picked.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (ok > 0) {
      toast.success(interpolate(pp.photosUploaded, { count: formatNumber(ok) }));
      onChanged();
    }
  };

  const remove = async (item: EditablePortfolioItem) => {
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
    if (error) {
      toast.error(pp.saveFailed);
      throw error;
    }
    await removeShopMedia(supabase, [item.path]);
    onItems(items.filter((i) => i.id !== item.id));
    toast.success(pp.photoDeleted);
    onChanged();
  };

  const uploader = (
    <div className="flex flex-wrap items-end gap-2">
      {isAdmin && team.length > 0 && (
        <div>
          <label htmlFor="pf-barber" className="field-label">
            {pp.creditTo}
          </label>
          <select id="pf-barber" className="field-input" value={uploadFor} onChange={(e) => setUploadFor(e.target.value)}>
            <option value="">{pp.wholeShop}</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={!!uploading || remaining === 0} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
        {uploading
          ? interpolate(pp.uploadingProgress, { done: formatNumber(uploading.done), total: formatNumber(uploading.total) })
          : pp.addWork}
      </button>
    </div>
  );

  return (
    <SettingsSection id="portfolio" title={pp.portfolioTitle} description={pp.portfolioDesc}>
      <div className="mb-4">{uploader}</div>
      {items.length === 0 ? (
        <EmptyState icon={ImagePlus} size="sm" title={pp.portfolioEmptyTitle} description={pp.portfolioEmptyDesc} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={pp.portfolioTitle}>
          {items.map((item, i) => {
            const caption = localizedText(locale, item.caption, item.caption_ar);
            const by = barberName(item.barber_id);
            const alt = caption || interpolate(pp.workNumber, { n: formatNumber(i + 1) });
            return (
              <li key={item.id} className="overflow-hidden rounded-lg border border-line bg-sunken">
                <div className="relative aspect-square">
                  <ShopImage src={item.url} blurData={item.blur_data} alt={alt} fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 50vw" className="object-cover" />
                  {item.is_featured && (
                    <span className="absolute top-2 start-2">
                      <Pill tone="accent" size="sm" icon={<Star size={12} aria-hidden="true" />}>
                        {pp.featured}
                      </Pill>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{by ?? pp.wholeShop}</p>
                    <p className="truncate text-xs text-ink-muted">{serviceName(item.service_id) ?? caption ?? ""}</p>
                  </div>
                  {canManage(item) && (
                    <>
                      <IconButton label={interpolate(pp.editWork, { n: formatNumber(i + 1) })} onClick={() => setEditing(item)}>
                        <Pencil size={16} aria-hidden="true" />
                      </IconButton>
                      <IconButton label={interpolate(pp.deleteWork, { n: formatNumber(i + 1) })} danger onClick={() => setDeleting(item)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </IconButton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PortfolioEditor
          key={editing.id}
          supabase={supabase}
          item={editing}
          team={team}
          services={services}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            onItems(items.map((i) => (i.id === row.id ? row : i)));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
        title={pp.deleteWorkTitle}
        description={pp.deletePhotoDesc}
        confirmLabel={t.common.delete}
        destructive
      />
    </SettingsSection>
  );
}

function PortfolioEditor({
  supabase,
  item,
  team,
  services,
  isAdmin,
  onClose,
  onSaved,
}: {
  supabase: AnyClient;
  item: EditablePortfolioItem;
  team: BarberProfileRow[];
  services: ServiceOption[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (row: EditablePortfolioItem) => void;
}) {
  const { t, locale } = useTranslation();
  const pp = t.publicProfile;
  const [barberId, setBarberId] = useState(item.barber_id ?? "");
  const [serviceId, setServiceId] = useState(item.service_id ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [captionAr, setCaptionAr] = useState(item.caption_ar ?? "");
  const [featured, setFeatured] = useState(item.is_featured);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const patch: Record<string, unknown> = {
      service_id: serviceId || null,
      caption: caption.trim() || null,
      caption_ar: captionAr.trim() || null,
      is_featured: featured,
    };
    if (isAdmin) patch.barber_id = barberId || null;
    const { data, error } = await supabase.from("portfolio_items").update(patch).eq("id", item.id).select(PORTFOLIO_SELECT).maybeSingle();
    setSaving(false);
    const row = data ? mapPortfolioRow(data as Record<string, unknown>, publicEnv.supabaseUrl) : null;
    if (error || !row) {
      toast.error(pp.saveFailed);
      return;
    }
    toast.success(pp.saved);
    onSaved(row);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={pp.editWorkTitle}
      size="md"
      footer={
        <DialogFooter>
          <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className={buttonClasses({ variant: "primary" })} disabled={saving} onClick={() => void save()}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {t.common.save}
          </button>
        </DialogFooter>
      }
    >
      <div className="grid gap-4">
        {isAdmin && (
          <div>
            <label htmlFor="pfe-barber" className="field-label">
              {pp.creditTo}
            </label>
            <select id="pfe-barber" className="field-input" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">{pp.wholeShop}</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="pfe-service" className="field-label">
            {pp.serviceTag}
          </label>
          <select id="pfe-service" className="field-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">{pp.noService}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {(locale === "ar" && s.name_ar) || s.name}
              </option>
            ))}
          </select>
        </div>
        <TextField label={pp.captionEn} value={caption} onChange={setCaption} dir="ltr" maxLength={LIMITS.caption} />
        <TextField label={pp.captionAr} value={captionAr} onChange={setCaptionAr} dir="rtl" maxLength={LIMITS.caption} />
        <Switch checked={featured} onChange={setFeatured} label={pp.featureToggle} description={pp.featureToggleDesc} />
      </div>
    </Dialog>
  );
}

export default PortfolioManager;
