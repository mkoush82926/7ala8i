"use client";

// Shop-wide online booking rules: minimum notice, how far ahead, the time
// grid, and the "important info" shown on the review step (AR/EN).

import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { DEFAULT_BOOKING_RULES, type BookingRules } from "@/lib/queries/services";
import { NOTICE_PRESETS, SLOT_INTERVALS, formFromRules, parseRulesForm, type RulesErrorKey, type RulesForm } from "./service-form";

export function BookingRulesDialog({
  open, rules, onClose, onSave,
}: {
  open: boolean;
  rules: BookingRules | null;
  onClose: () => void;
  onSave: (next: BookingRules) => Promise<boolean>;
}) {
  return <RulesBody key={String(open)} open={open} rules={rules} onClose={onClose} onSave={onSave} />;
}

function RulesBody({ open, rules, onClose, onSave }: Parameters<typeof BookingRulesDialog>[0]) {
  const { t, formatDuration } = useTranslation();
  const svc = t.services;
  const formId = useId();
  const [form, setForm] = useState<RulesForm>(() => formFromRules(rules ?? DEFAULT_BOOKING_RULES));
  const [errors, setErrors] = useState<Partial<Record<keyof RulesForm, RulesErrorKey>>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof RulesForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const close = () => { if (!saving) onClose(); };

  const noticeOptions = Array.from(new Set<number>([...NOTICE_PRESETS, Number(form.min_notice_minutes) || 0])).sort((a, b) => a - b);
  const intervalOptions = Array.from(new Set<number>([...SLOT_INTERVALS, Number(form.slot_interval_minutes) || 15])).sort((a, b) => a - b);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const parsed = parseRulesForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      if (first) document.getElementById(`${formId}-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    const ok = await onSave(parsed.value);
    setSaving(false);
    if (ok) onClose();
  }

  const err = (k: keyof RulesForm) =>
    errors[k] ? <p id={`${formId}-${k}-error`} className="field-error" role="alert">{(svc as unknown as Record<string, string>)[errors[k]!]}</p> : null;
  const a11y = (k: keyof RulesForm) => ({
    id: `${formId}-${k}`,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${formId}-${k}-error` : `${formId}-${k}-hint`,
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={svc.bookingRules}
      description={svc.bookingRulesDesc}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={
        <DialogFooter>
          <Button variant="secondary" onClick={close} disabled={saving}>{t.common.cancel}</Button>
          <Button type="submit" form={formId} loading={saving}>
            {svc.saveChanges}
          </Button>
        </DialogFooter>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${formId}-min_notice_minutes`} className="field-label">{svc.minNotice}</label>
          <select {...a11y("min_notice_minutes")} className="field-input" value={form.min_notice_minutes} onChange={(e) => set("min_notice_minutes", e.target.value)}>
            {noticeOptions.map((m) => (
              <option key={m} value={m}>{m === 0 ? svc.noNotice : formatDuration(m)}</option>
            ))}
          </select>
          <p id={`${formId}-min_notice_minutes-hint`} className="field-helper">{svc.minNoticeHint}</p>
          {err("min_notice_minutes")}
        </div>
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-booking_window_days`} className="field-label">{svc.bookingWindow}</label>
            <input
              {...a11y("booking_window_days")} type="number" inputMode="numeric" min={1} max={365} className="field-input"
              value={form.booking_window_days} onChange={(e) => set("booking_window_days", e.target.value)}
            />
            <p id={`${formId}-booking_window_days-hint`} className="field-helper">
              {interpolate(svc.bookingWindowHint, { days: form.booking_window_days || "—" })}
            </p>
            {err("booking_window_days")}
          </div>
          <div>
            <label htmlFor={`${formId}-slot_interval_minutes`} className="field-label">{svc.slotInterval}</label>
            <select {...a11y("slot_interval_minutes")} className="field-input" value={form.slot_interval_minutes} onChange={(e) => set("slot_interval_minutes", e.target.value)}>
              {intervalOptions.map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
            </select>
            <p id={`${formId}-slot_interval_minutes-hint`} className="field-helper">{svc.slotIntervalHint}</p>
            {err("slot_interval_minutes")}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["important_info_ar", "important_info_en"] as const).map((k) => (
            <div key={k}>
              <label htmlFor={`${formId}-${k}`} className="field-label">{k === "important_info_ar" ? svc.importantInfoAr : svc.importantInfoEn}</label>
              <textarea
                {...a11y(k)} rows={3} maxLength={1000} className="field-input" style={{ resize: "vertical" }}
                dir={k === "important_info_ar" ? "rtl" : "ltr"} lang={k === "important_info_ar" ? "ar" : "en"}
                value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={svc.importantInfoPlaceholder}
              />
              <p id={`${formId}-${k}-hint`} className="sr-only">{svc.importantInfoHint}</p>
              {err(k)}
            </div>
          ))}
        </div>
        <p className="-mt-2 text-[13px] text-ink-muted">{svc.importantInfoHint}</p>
      </form>
    </Dialog>
  );
}
