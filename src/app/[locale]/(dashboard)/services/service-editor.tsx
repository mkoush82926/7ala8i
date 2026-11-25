"use client";

// Catalogue editor: basics, price type, options (variants), details shown to
// clients, online booking and timing (buffer / processing). Mobile-first.

import React, { useId, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { checkboxClasses, focusRing } from "@/components/ui/recipes";
import type { ServiceItem } from "@/hooks/use-services";
import { AUDIENCES, LOCATION_TYPES, PRICE_TYPES, type CategoryRow, type VariantDraft, type ServiceWrite } from "@/lib/queries/services";
import {
  MAX_VARIANTS,
  emptyVariant,
  firstErrorField,
  formFromService,
  parseServiceForm,
  type ServiceErrors,
  type ServiceForm,
  type VariantForm,
} from "./service-form";

const ICONS = ["✂️", "💈", "🧔", "💇", "🪒", "🧴", "💆", "🎨", "✨", "👑", "🧖", "💅"];

/** Segmented control segment (§5.6): sits inside `segTrack`; selected = white chip. */
const segTrack = "flex gap-1 rounded-full bg-sunken p-1";
const segBtn = (on: boolean) =>
  cn(
    "min-h-10 flex-1 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors duration-150",
    focusRing,
    on ? "bg-card text-ink shadow-xs" : "text-ink-muted hover:text-ink",
  );

/** Section heading inside the editor form. */
const sectionLegend = "mb-3 text-title text-ink";

export function ServiceEditor({
  open, service, categories, currency, legacy, onClose, onSave,
}: {
  open: boolean;
  service: ServiceItem | null;
  categories: CategoryRow[];
  currency: string;
  /** Database without the v2 catalogue: only the basic fields are shown. */
  legacy: boolean;
  onClose: () => void;
  onSave: (write: ServiceWrite, variants: VariantDraft[]) => Promise<boolean>;
}) {
  // Remount the body per opened service so the form state starts fresh.
  return (
    <ServiceEditorBody
      key={`${open}-${service?.id ?? "new"}`}
      open={open} service={service} categories={categories} currency={currency} legacy={legacy}
      onClose={onClose} onSave={onSave}
    />
  );
}

function ServiceEditorBody({
  open, service, categories, currency, legacy, onClose, onSave,
}: Parameters<typeof ServiceEditor>[0]) {
  const { t, isRTL } = useTranslation();
  const svc = t.services;
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ServiceForm>(() => formFromService(service));
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [saving, setSaving] = useState(false);
  const [showTiming, setShowTiming] = useState(
    () => !!service && (service.buffer_minutes > 0 || service.processing_minutes > 0),
  );

  const set = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (key: string, patch: Partial<VariantForm>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  const addVariant = () =>
    setForm((f) =>
      f.variants.length >= MAX_VARIANTS
        ? f
        : { ...f, variants: [...f.variants, emptyVariant({ price: Number(f.price) || 0, duration: Number(f.duration) || 30 })] },
    );
  const removeVariant = (key: string) => setForm((f) => ({ ...f, variants: f.variants.filter((v) => v.key !== key) }));

  const close = () => { if (!saving) onClose(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const parsed = parseServiceForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      if (parsed.errors.processing || parsed.errors.buffer_minutes) setShowTiming(true);
      const first = firstErrorField(parsed.errors);
      if (first) requestAnimationFrame(() => document.getElementById(`${formId}-${first}`)?.focus());
      return;
    }
    setErrors({});
    setSaving(true);
    const ok = await onSave(parsed.value.write, legacy ? [] : parsed.value.variants);
    setSaving(false);
    if (ok) onClose();
  }

  const errText = (key?: string) => (key ? (svc as unknown as Record<string, string>)[key] : null);
  const fieldError = (field: string, key?: string) =>
    key ? (
      <p id={`${formId}-${field}-error`} className="field-error" role="alert">{errText(key)}</p>
    ) : null;
  const a11y = (field: string, key?: string) => ({
    id: `${formId}-${field}`,
    "aria-invalid": key ? true : undefined,
    "aria-describedby": key ? `${formId}-${field}-error` : undefined,
  });

  const free = form.price_type === "free";
  const priceTypeLabel: Record<string, string> = { fixed: svc.priceFixed, from: svc.priceFrom, free: svc.priceFree };
  const audienceLabel: Record<string, string> = {
    everyone: svc.audienceEveryone, men: svc.audienceMen, women: svc.audienceWomen, kids: svc.audienceKids,
  };
  const locationLabel: Record<string, string> = { in_shop: svc.locationInShop, home: svc.locationHome };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={service ? svc.editService : svc.addService}
      initialFocusRef={nameRef}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      size="lg"
      footer={
        <DialogFooter>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {service ? svc.saveChanges : svc.addService}
          </Button>
        </DialogFooter>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-7">
        {/* ── Basics ── */}
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{svc.sectionBasics}</legend>
          <div>
            <span className="field-label" id={`${formId}-icon-label`}>{svc.icon}</span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${formId}-icon-label`}>
              {ICONS.map((ic, i) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => set("icon", ic)}
                  aria-pressed={form.icon === ic}
                  className={cn(
                    "flex size-11 cursor-pointer items-center justify-center rounded-lg border text-lg transition-colors duration-150",
                    focusRing,
                    form.icon === ic
                      ? "border-brand bg-brand-soft ring-1 ring-brand"
                      : "border-line bg-sunken/60 hover:border-ink-soft",
                  )}
                >
                  <span aria-hidden>{ic}</span>
                  <span className="sr-only">{`${svc.icon} ${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-name`} className="field-label">
                {svc.serviceName} <span aria-hidden>*</span>
              </label>
              <input
                ref={nameRef} {...a11y("name", errors.name)} type="text" value={form.name}
                onChange={(e) => set("name", e.target.value)} required maxLength={100} autoComplete="off"
                className="field-input" placeholder={svc.namePlaceholder} dir="ltr" lang="en"
              />
              {fieldError("name", errors.name)}
            </div>
            <div>
              <label htmlFor={`${formId}-name_ar`} className="field-label">{svc.serviceNameAr}</label>
              <input
                {...a11y("name_ar", errors.name_ar)} type="text" value={form.name_ar}
                onChange={(e) => set("name_ar", e.target.value)} dir="rtl" lang="ar" maxLength={100}
                autoComplete="off" className="field-input" placeholder={svc.nameArPlaceholder}
              />
              {fieldError("name_ar", errors.name_ar)}
            </div>
          </div>

          {!legacy && categories.length > 0 && (
            <div>
              <label htmlFor={`${formId}-category`} className="field-label">{svc.category}</label>
              <select
                id={`${formId}-category`} className="field-input" value={form.category_id}
                onChange={(e) => set("category_id", e.target.value)}
              >
                <option value="">{svc.categoryAuto}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        {/* ── Price & duration ── */}
        <fieldset className="flex flex-col gap-4">
          <legend className={sectionLegend}>{svc.sectionPricing}</legend>
          {!legacy && (
            <div className={segTrack} role="radiogroup" aria-label={svc.priceType}>
              {PRICE_TYPES.map((pt) => (
                <button
                  key={pt} type="button" role="radio" aria-checked={form.price_type === pt}
                  onClick={() => set("price_type", pt)} className={segBtn(form.price_type === pt)}
                >
                  {priceTypeLabel[pt]}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            {!free && (
              <div>
                <label htmlFor={`${formId}-price`} className="field-label">
                  {form.price_type === "from" ? svc.priceFromLabel : svc.price} ({currency}) <span aria-hidden>*</span>
                </label>
                <input
                  {...a11y("price", errors.price)} type="number" inputMode="decimal" value={form.price}
                  onChange={(e) => set("price", e.target.value)} required min={0} step="0.25" className="field-input"
                />
                {fieldError("price", errors.price)}
              </div>
            )}
            <div>
              <label htmlFor={`${formId}-duration`} className="field-label">
                {svc.duration} ({svc.minutes})
              </label>
              <input
                {...a11y("duration", errors.duration)} type="number" inputMode="numeric" value={form.duration}
                onChange={(e) => set("duration", e.target.value)} min={5} max={480} step={5} className="field-input"
              />
              {fieldError("duration", errors.duration)}
            </div>
          </div>
        </fieldset>

        {/* ── Options (variants) ── */}
        {!legacy && (
          <fieldset className="flex flex-col gap-3">
            <legend className={sectionLegend}>{svc.sectionVariants}</legend>
            <p className="-mt-2 text-[13px] text-ink-muted">{svc.variantsHint}</p>
            {form.variants.length > 0 && (
              <ul className="flex flex-col gap-3" role="list">
                {form.variants.map((v, i) => {
                  const vErr = errors.variants?.[v.key] ?? {};
                  const base = `variant-${v.key}`;
                  return (
                    <li key={v.key} className="rounded-xl border border-line bg-sunken/60 p-3 sm:p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-muted">{`${svc.variant} ${i + 1}`}</span>
                        <button
                          type="button" onClick={() => removeVariant(v.key)}
                          aria-label={`${svc.removeVariant} ${i + 1}`}
                          className={cn("-me-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger-text", focusRing)}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`${formId}-${base}`} className="field-label">{svc.variantName}</label>
                          <input
                            {...a11y(base, vErr.name_en)} type="text" value={v.name_en} maxLength={100} dir="ltr" lang="en"
                            onChange={(e) => setVariant(v.key, { name_en: e.target.value })} className="field-input"
                            placeholder={svc.variantNamePlaceholder}
                          />
                          {fieldError(base, vErr.name_en)}
                        </div>
                        <div>
                          <label htmlFor={`${formId}-${base}-ar`} className="field-label">{svc.variantNameAr}</label>
                          <input
                            id={`${formId}-${base}-ar`} type="text" value={v.name_ar} maxLength={100} dir="rtl" lang="ar"
                            onChange={(e) => setVariant(v.key, { name_ar: e.target.value })} className="field-input"
                            placeholder={svc.variantNameArPlaceholder}
                          />
                        </div>
                        {!free && (
                          <div>
                            <label htmlFor={`${formId}-${base}-price`} className="field-label">{svc.price} ({currency})</label>
                            <input
                              {...a11y(`${base}-price`, vErr.price)} type="number" inputMode="decimal" min={0} step="0.25"
                              value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} className="field-input"
                            />
                            {fieldError(`${base}-price`, vErr.price)}
                          </div>
                        )}
                        <div>
                          <label htmlFor={`${formId}-${base}-duration`} className="field-label">{svc.duration} ({svc.minutes})</label>
                          <input
                            {...a11y(`${base}-duration`, vErr.duration)} type="number" inputMode="numeric" min={5} max={480} step={5}
                            value={v.duration} onChange={(e) => setVariant(v.key, { duration: e.target.value })} className="field-input"
                          />
                          {fieldError(`${base}-duration`, vErr.duration)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {form.variants.length < MAX_VARIANTS && (
              <Button variant="soft" size="sm" onClick={addVariant} icon={<Plus aria-hidden />} className="self-start">
                {svc.addVariant}
              </Button>
            )}
          </fieldset>
        )}

        {/* ── Shown to clients ── */}
        {!legacy && (
          <fieldset className="flex flex-col gap-4">
            <legend className={sectionLegend}>{svc.sectionDetails}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["description_en", "description_ar"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`${formId}-${k}`} className="field-label">{k === "description_en" ? svc.descriptionEn : svc.descriptionAr}</label>
                  <textarea
                    {...a11y(k, errors[k])} rows={3} maxLength={1000} value={form[k]}
                    dir={k === "description_ar" ? "rtl" : "ltr"} lang={k === "description_ar" ? "ar" : "en"}
                    onChange={(e) => set(k, e.target.value)} className="field-input" style={{ resize: "vertical" }}
                  />
                  {fieldError(k, errors[k])}
                </div>
              ))}
              {(["client_note_en", "client_note_ar"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`${formId}-${k}`} className="field-label">{k === "client_note_en" ? svc.clientNoteEn : svc.clientNoteAr}</label>
                  <textarea
                    {...a11y(k, errors[k])} rows={2} maxLength={500} value={form[k]}
                    dir={k === "client_note_ar" ? "rtl" : "ltr"} lang={k === "client_note_ar" ? "ar" : "en"}
                    onChange={(e) => set(k, e.target.value)} className="field-input" style={{ resize: "vertical" }}
                    placeholder={svc.clientNotePlaceholder}
                  />
                  {fieldError(k, errors[k])}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${formId}-audience`} className="field-label">{svc.audience}</label>
                <select id={`${formId}-audience`} className="field-input" value={form.audience} onChange={(e) => set("audience", e.target.value as ServiceForm["audience"])}>
                  {AUDIENCES.map((a) => <option key={a} value={a}>{audienceLabel[a]}</option>)}
                </select>
              </div>
              <div>
                <span className="field-label" id={`${formId}-location-label`}>{svc.location}</span>
                <div className={segTrack} role="radiogroup" aria-labelledby={`${formId}-location-label`}>
                  {LOCATION_TYPES.map((l) => (
                    <button
                      key={l} type="button" role="radio" aria-checked={form.location_type === l}
                      onClick={() => set("location_type", l)} className={segBtn(form.location_type === l)}
                    >
                      {locationLabel[l]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {/* ── Online booking ── */}
        {!legacy && (
          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition-colors hover:border-ink-soft has-[:checked]:border-brand-soft-line has-[:checked]:bg-brand-soft/50">
              <input
                type="checkbox" className={cn(checkboxClasses, "mt-0.5 shrink-0 accent-brand")} checked={form.online_bookable}
                onChange={(e) => set("online_bookable", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{svc.onlineBookable}</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">{svc.onlineBookableHint}</span>
              </span>
            </label>
          </div>
        )}

        {/* ── Timing (advanced) ── */}
        {!legacy && (
          <div>
          <div className="overflow-hidden rounded-xl border border-line">
            <button
              type="button" onClick={() => setShowTiming((v) => !v)} aria-expanded={showTiming}
              aria-controls={`${formId}-timing`}
              className={cn("flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-sunken/60", focusRing, "focus-visible:-outline-offset-2")}
            >
              <span>
                <span className="block text-sm font-semibold text-ink">{svc.sectionTiming}</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">{svc.timingHint}</span>
              </span>
              <ChevronDown size={18} aria-hidden className={cn("shrink-0 text-ink-muted transition-transform duration-200 motion-reduce:transition-none", showTiming && "rotate-180")} />
            </button>
            {showTiming && (
              <div id={`${formId}-timing`} className="grid grid-cols-1 gap-4 border-t border-line p-4 min-[400px]:grid-cols-3">
                <div>
                  <label htmlFor={`${formId}-buffer_minutes`} className="field-label">{svc.bufferMinutes}</label>
                  <input
                    {...a11y("buffer_minutes", errors.buffer_minutes)} type="number" inputMode="numeric" min={0} max={120} step={5}
                    value={form.buffer_minutes} onChange={(e) => set("buffer_minutes", e.target.value)} className="field-input"
                  />
                  {fieldError("buffer_minutes", errors.buffer_minutes)}
                </div>
                <div>
                  <label htmlFor={`${formId}-processing`} className="field-label">{svc.processingOffset}</label>
                  <input
                    {...a11y("processing", errors.processing)} type="number" inputMode="numeric" min={0} max={480} step={5}
                    value={form.processing_offset_minutes} onChange={(e) => set("processing_offset_minutes", e.target.value)} className="field-input"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-processing-minutes`} className="field-label">{svc.processingMinutes}</label>
                  <input
                    id={`${formId}-processing-minutes`} type="number" inputMode="numeric" min={0} max={480} step={5}
                    aria-invalid={errors.processing ? true : undefined}
                    aria-describedby={errors.processing ? `${formId}-processing-error` : undefined}
                    value={form.processing_minutes} onChange={(e) => set("processing_minutes", e.target.value)} className="field-input"
                  />
                </div>
                <div className="min-[400px]:col-span-3">
                  {fieldError("processing", errors.processing)}
                  <p className="text-[13px] text-ink-muted">{svc.processingHint}</p>
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}
