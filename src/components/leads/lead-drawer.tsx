"use client";

import React, { useId, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Drawer, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useLeadsStore, type LeadDraft, type LeadRecord, type LeadStage } from "@/store/leads-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { errorText } from "@/components/calendar/error-text";
import { initialsOf } from "@/components/calendar/calendar-utils";
import { useStages } from "./stages";

interface LeadForm {
  name: string;
  phone: string;
  email: string;
  value: string;
  stage: LeadStage;
  notes: string;
}

function formFor(lead: LeadRecord | null, stage: LeadStage): LeadForm {
  return {
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    value: lead?.value != null ? String(lead.value) : "",
    stage: lead?.stage ?? stage,
    notes: lead?.notes ?? "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lead create / edit drawer (end side; bottom-sheet-free full panel on phones).
 * "New lead" opens an empty form and inserts only on Save — no placeholder rows.
 */
export function LeadDrawer() {
  const selectedLead = useLeadsStore((s) => s.selectedLead);
  const drawerOpen = useLeadsStore((s) => s.drawerOpen);
  const drawerMode = useLeadsStore((s) => s.drawerMode);
  const createStage = useLeadsStore((s) => s.createStage);
  const closeDrawer = useLeadsStore((s) => s.closeDrawer);
  const createLead = useLeadsStore((s) => s.createLead);
  const updateLead = useLeadsStore((s) => s.updateLead);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const canEdit = useWorkspaceStore((s) => s.role) === "shop_admin";

  const { t, formatDate } = useTranslation();
  const stages = useStages();
  const formId = useId();
  const ids = {
    name: `${formId}-name`,
    phone: `${formId}-phone`,
    email: `${formId}-email`,
    value: `${formId}-value`,
    notes: `${formId}-notes`,
    stage: `${formId}-stage`,
  };

  const isCreate = drawerMode === "create";
  const open = drawerOpen && (isCreate || !!selectedLead);
  const baseline = isCreate ? null : selectedLead;

  // Reset the form whenever a different lead (or a fresh create) opens —
  // derived during render, so there is no stale-form flash and no effect.
  const formKey = open ? (isCreate ? `create:${createStage}` : `lead:${selectedLead?.id}`) : "closed";
  const [loadedKey, setLoadedKey] = useState(formKey);
  const [form, setForm] = useState<LeadForm>(() => formFor(baseline, createStage));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (formKey !== loadedKey) {
    setLoadedKey(formKey);
    if (open) {
      setForm(formFor(baseline, createStage));
      setSubmitted(false);
      setFormError(null);
    }
  }

  const initial = formFor(baseline, createStage);
  const dirty = (Object.keys(initial) as (keyof LeadForm)[]).some((k) => String(form[k]).trim() !== String(initial[k]).trim());

  const nameMissing = form.name.trim().length === 0;
  const valueNum = form.value.trim() === "" ? null : Number(form.value);
  const valueInvalid = valueNum !== null && (!Number.isFinite(valueNum) || valueNum < 0);
  const emailInvalid = form.email.trim() !== "" && !EMAIL_RE.test(form.email.trim());
  const invalid = nameMissing || valueInvalid || emailInvalid;

  const set = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const requestClose = () => {
    if (saving) return;
    if (canEdit && dirty) setConfirmDiscard(true);
    else closeDrawer();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSubmitted(true);
    setFormError(null);
    if (invalid) {
      document.getElementById(nameMissing ? ids.name : emailInvalid ? ids.email : ids.value)?.focus();
      return;
    }

    const draft: LeadDraft = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      value: valueNum,
      notes: form.notes.trim() || null,
      stage: form.stage,
    };

    setSaving(true);
    try {
      if (isCreate) {
        const result = await createLead(draft);
        if (!result.ok) {
          setFormError(errorText(t, result.code));
          return;
        }
        toast.success(t.leads.leadCreated);
        closeDrawer();
      } else if (selectedLead) {
        if (!dirty) {
          closeDrawer();
          return;
        }
        const result = await updateLead(selectedLead.id, draft);
        if (!result.ok) {
          setFormError(errorText(t, result.code));
          return;
        }
        toast.success(t.leads.leadUpdated);
        closeDrawer();
      }
    } finally {
      setSaving(false);
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteLead(confirmDelete.id);
    if (!result.ok) throw new Error(errorText(t, result.code));
    toast.success(t.leads.leadDeleted);
  };

  const fieldError = (show: boolean, id: string, text: string) =>
    show ? (
      <p id={`${id}-err`} className="field-error">
        {text}
      </p>
    ) : null;

  const footer = canEdit ? (
    <DialogFooter className="sm:justify-between">
      {!isCreate && selectedLead ? (
        <button
          type="button"
          className="btn btn-ghost text-[var(--accent-rose)]"
          disabled={saving}
          onClick={() => setConfirmDelete({ id: selectedLead.id, name: selectedLead.name })}
        >
          <Trash2 size={15} aria-hidden="true" />
          {t.common.delete}
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" className="btn btn-secondary" onClick={requestClose} disabled={saving}>
          {t.common.cancel}
        </button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          {saving ? t.common.processing : isCreate ? t.leads.addLead : t.common.save}
        </button>
      </div>
    </DialogFooter>
  ) : undefined;

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        size="md"
        title={isCreate ? t.leads.newLeadTitle : t.leads.leadProfile}
        description={isCreate ? t.leads.newLeadDescription : canEdit ? undefined : t.leads.readOnly}
        footer={footer}
      >
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[14px] font-medium text-[var(--text-primary)]"
            >
              {initialsOf(form.name)}
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor={ids.name} className="field-label">
                {t.leads.name}
              </label>
              <input
                id={ids.name}
                data-autofocus={isCreate ? true : undefined}
                className="field-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                disabled={!canEdit}
                required
                maxLength={120}
                autoComplete="off"
                aria-invalid={submitted && nameMissing}
                aria-describedby={submitted && nameMissing ? `${ids.name}-err` : undefined}
              />
              {fieldError(submitted && nameMissing, ids.name, t.leads.nameRequired)}
            </div>
          </div>
          {!isCreate && selectedLead && (
            <p className="text-[12px] text-[var(--text-muted)]">
              {interpolate(t.leads.createdOn, { date: formatDate(selectedLead.createdAt, "medium") })}
            </p>
          )}

          {/* Stage (radio group; the non-drag way to move a lead) */}
          <fieldset>
            <legend className="field-label">{t.leads.stage}</legend>
            <div className="flex flex-wrap gap-2">
              {stages.map((opt) => {
                const checked = form.stage === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      "focus-ring-within inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-colors",
                      checked
                        ? "border-current"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                      !canEdit && "cursor-default opacity-80",
                    )}
                    style={
                      checked
                        ? { color: opt.color, backgroundColor: `color-mix(in srgb, ${opt.color} 14%, transparent)` }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name={ids.stage}
                      value={opt.id}
                      checked={checked}
                      disabled={!canEdit}
                      onChange={() => set("stage", opt.id)}
                      className="sr-only"
                    />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: opt.color }} aria-hidden="true" />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.phone} className="field-label">
                {t.leads.phone}
              </label>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="off"
                className="field-input text-start"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                disabled={!canEdit}
                maxLength={30}
              />
            </div>
            <div>
              <label htmlFor={ids.email} className="field-label">
                {t.leads.email}
              </label>
              <input
                id={ids.email}
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="off"
                className="field-input text-start"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={!canEdit}
                maxLength={160}
                aria-invalid={submitted && emailInvalid}
                aria-describedby={submitted && emailInvalid ? `${ids.email}-err` : undefined}
              />
              {fieldError(submitted && emailInvalid, ids.email, t.leads.invalidEmail)}
            </div>
          </div>

          <div>
            <label htmlFor={ids.value} className="field-label">
              {t.leads.dealValue}
            </label>
            <input
              id={ids.value}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              dir="ltr"
              className="field-input text-start tabular-nums"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              disabled={!canEdit}
              aria-invalid={submitted && valueInvalid}
              aria-describedby={submitted && valueInvalid ? `${ids.value}-err` : undefined}
            />
            {fieldError(submitted && valueInvalid, ids.value, t.leads.invalidValue)}
          </div>

          <div>
            <label htmlFor={ids.notes} className="field-label">
              {t.leads.notes}
            </label>
            <textarea
              id={ids.notes}
              className="field-input min-h-[96px] resize-y py-2"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={!canEdit}
              maxLength={1000}
              placeholder={canEdit ? t.leads.notesPlaceholder : undefined}
            />
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] border border-[var(--accent-rose)]/40 bg-[var(--accent-rose-muted)] px-4 py-3 text-[13px] text-[var(--accent-rose)]"
            >
              {formError}
            </p>
          )}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        title={interpolate(t.leads.deleteTitle, { name: confirmDelete?.name ?? "" })}
        description={t.leads.deleteDescription}
        confirmLabel={t.common.delete}
        destructive
      />

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => closeDrawer()}
        title={t.leads.discardTitle}
        description={t.leads.discardDescription}
        confirmLabel={t.leads.discard}
        cancelLabel={t.leads.keepEditing}
        destructive
      />
    </>
  );
}
