"use client";

import React, { useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/recipes";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AmenityIcon } from "../amenity-icon";
import type { Amenity } from "../lib/types";
import {
  detailsFromRow,
  detailsPatch,
  LIMITS,
  locationFromRow,
  locationPatch,
  validateDetails,
  validateLocation,
  type DetailsForm,
  type FieldErrorCode,
  type LocationForm,
  type ShopProfileRow,
} from "./profile-form";
import { PinPicker } from "./pin-picker";
import type { AnyClient } from "./types";
import { SettingsSection, TextField } from "./ui";
import type { PlaceOption } from "./use-public-profile";

function useFieldError() {
  const { t, formatNumber } = useTranslation();
  const pp = t.publicProfile;
  return (code: FieldErrorCode | undefined, max?: number): string | null => {
    if (!code) return null;
    if (code === "tooLong") return pp.errors.tooLong.replace("{max}", formatNumber(max ?? 0));
    return pp.errors[code];
  };
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const { t } = useTranslation();
  const pp = t.publicProfile;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {dirty && (
        <span className="me-auto text-xs font-semibold text-ink-muted" role="status">
          {pp.unsaved}
        </span>
      )}
      <button type="button" className={buttonClasses({ variant: "ghost" })} disabled={!dirty || saving} onClick={onReset}>
        {pp.discard}
      </button>
      <button type="button" className={buttonClasses({ variant: "primary" })} disabled={!dirty || saving} onClick={onSave}>
        {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {t.common.save}
      </button>
    </div>
  );
}

// ─── Details: Arabic name + bilingual description ───

export function DetailsSection({
  supabase,
  shop,
  canEdit,
  onSaved,
}: {
  supabase: AnyClient;
  shop: ShopProfileRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const pp = t.publicProfile;
  const fieldError = useFieldError();
  const initial = useMemo(() => detailsFromRow(shop), [shop]);
  const [form, setForm] = useState<DetailsForm>(initial);
  const [base, setBase] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Server row changed (after a save/refresh): adopt it.
  if (base !== initial) {
    setBase(initial);
    setForm(initial);
  }

  const errors = validateDetails(form);
  const patch = detailsPatch(initial, form);
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update(patch).eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast.error(pp.saveFailed);
      return;
    }
    toast.success(pp.saved);
    onSaved();
  };

  return (
    <SettingsSection id="details" title={pp.detailsTitle} description={pp.detailsDesc}>
      <div className="grid gap-4">
        <TextField
          label={pp.nameAr}
          hint={pp.nameArHint}
          value={form.name_ar}
          onChange={(v) => setForm((f) => ({ ...f, name_ar: v }))}
          dir="rtl"
          maxLength={LIMITS.shopNameAr}
          disabled={!canEdit}
          error={fieldError(errors.name_ar, LIMITS.shopNameAr)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label={pp.descriptionEn}
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            multiline
            dir="ltr"
            maxLength={LIMITS.description}
            disabled={!canEdit}
            error={fieldError(errors.description, LIMITS.description)}
          />
          <TextField
            label={pp.descriptionAr}
            value={form.description_ar}
            onChange={(v) => setForm((f) => ({ ...f, description_ar: v }))}
            multiline
            dir="rtl"
            maxLength={LIMITS.description}
            disabled={!canEdit}
            error={fieldError(errors.description_ar, LIMITS.description)}
          />
        </div>
      </div>
      {canEdit && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => setForm(initial)} />}
    </SettingsSection>
  );
}

// ─── Location: city, area, pin, landmark ───

export function LocationSection({
  supabase,
  shop,
  cities,
  areas,
  canEdit,
  onSaved,
}: {
  supabase: AnyClient;
  shop: ShopProfileRow;
  cities: PlaceOption[];
  areas: PlaceOption[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t, locale } = useTranslation();
  const pp = t.publicProfile;
  const fieldError = useFieldError();
  const initial = useMemo(() => locationFromRow(shop), [shop]);
  const [form, setForm] = useState<LocationForm>(initial);
  const [base, setBase] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Server row changed (after a save/refresh): adopt it.
  if (base !== initial) {
    setBase(initial);
    setForm(initial);
  }

  const errors = validateLocation(form);
  const patch = locationPatch(initial, form);
  const dirty = Object.keys(patch).length > 0;
  const name = (p: PlaceOption) => (locale === "ar" ? p.name_ar : p.name_en);
  const cityAreas = areas.filter((a) => a.city_id === form.city_id);

  const save = async () => {
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update(patch).eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast.error(pp.saveFailed);
      return;
    }
    toast.success(pp.saved);
    onSaved();
  };

  return (
    <SettingsSection id="location" title={pp.locationTitle} description={pp.locationDesc}>
      <fieldset disabled={!canEdit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pp-city" className="field-label">
              {pp.city}
            </label>
            <select
              id="pp-city"
              className="field-input"
              value={form.city_id}
              onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value, area_id: "" }))}
            >
              <option value="">{pp.choose}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pp-area" className="field-label">
              {pp.area}
            </label>
            <select
              id="pp-area"
              className="field-input"
              value={form.area_id}
              disabled={!form.city_id || cityAreas.length === 0}
              aria-invalid={errors.area_id ? true : undefined}
              onChange={(e) => setForm((f) => ({ ...f, area_id: e.target.value }))}
            >
              <option value="">{cityAreas.length === 0 && form.city_id ? pp.noAreas : pp.choose}</option>
              {cityAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {name(a)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="field-label">{pp.pinTitle}</p>
          <PinPicker
            value={form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : null}
            onChange={(v) => setForm((f) => ({ ...f, lat: v?.lat ?? null, lng: v?.lng ?? null }))}
          />
          {errors.lat && (
            <p className="field-error" role="alert">
              {fieldError(errors.lat)}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label={pp.landmarkEn}
            hint={pp.landmarkHint}
            value={form.landmark_en}
            onChange={(v) => setForm((f) => ({ ...f, landmark_en: v }))}
            dir="ltr"
            maxLength={LIMITS.landmark}
            error={fieldError(errors.landmark_en, LIMITS.landmark)}
          />
          <TextField
            label={pp.landmarkAr}
            value={form.landmark_ar}
            onChange={(v) => setForm((f) => ({ ...f, landmark_ar: v }))}
            dir="rtl"
            maxLength={LIMITS.landmark}
            error={fieldError(errors.landmark_ar, LIMITS.landmark)}
          />
        </div>
        {shop.address && (
          <p className="text-xs text-ink-muted">
            {pp.addressFromGeneral} <span className="font-semibold text-ink">{shop.address}</span>
          </p>
        )}
      </fieldset>
      {canEdit && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => setForm(initial)} />}
    </SettingsSection>
  );
}

// ─── Amenities ───

export function AmenitiesSection({
  supabase,
  shopId,
  amenities,
  selected,
  canEdit,
  onSelected,
  onChanged,
}: {
  supabase: AnyClient;
  shopId: string;
  amenities: Amenity[];
  selected: string[];
  canEdit: boolean;
  onSelected: (next: string[]) => void;
  onChanged: () => void;
}) {
  const { t, locale } = useTranslation();
  const pp = t.publicProfile;
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (id: string) => {
    const on = selected.includes(id);
    const prev = selected;
    onSelected(on ? selected.filter((x) => x !== id) : [...selected, id]);
    setPending(id);
    const { error } = on
      ? await supabase.from("shop_amenities").delete().eq("shop_id", shopId).eq("amenity_id", id)
      : await supabase.from("shop_amenities").insert({ shop_id: shopId, amenity_id: id });
    setPending(null);
    if (error) {
      onSelected(prev);
      toast.error(pp.saveFailed);
      return;
    }
    onChanged();
  };

  return (
    <SettingsSection id="amenities" title={pp.amenitiesTitle} description={pp.amenitiesDesc}>
      <ul className="flex flex-wrap gap-2" aria-label={pp.amenitiesTitle}>
        {amenities.map((a) => {
          const on = selected.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!canEdit || pending === a.id}
                onClick={() => void toggle(a.id)}
                className={cn(
                  "focus-ring inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60",
                  on
                    ? "border-inverse bg-inverse text-on-inverse"
                    : "border-line-strong text-ink hover:bg-sunken",
                )}
              >
                <AmenityIcon name={a.icon} size={16} />
                {locale === "ar" ? a.name_ar : a.name_en}
              </button>
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}
