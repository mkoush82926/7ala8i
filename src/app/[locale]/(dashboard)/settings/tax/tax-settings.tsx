"use client";

import React, { useState } from "react";
import { AlertCircle, Loader2, Receipt } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/components/team/shifts";
import {
  CASH_ROUNDING_STEPS,
  inclusiveTax,
  normalizePrefix,
  normalizeTaxNumber,
  parseRate,
  receiptNumberPreview,
  validateTax,
  type TaxDraft,
} from "./tax-logic";

const card = "flex flex-col gap-5 rounded-xl border border-line bg-card p-4 sm:p-6";
const h2 = "text-h3 m-0 text-ink";

/** Tax registration, cash rounding and receipt numbering/footer. */
export function TaxSettings() {
  const { t, locale } = useTranslation();
  const tt = t.taxSettings;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const [draft, setDraft] = useState<TaxDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useSupabaseQuery<TaxDraft>(
    async () => {
      const [shop, tax] = await Promise.all([
        supabase
          .from("shops")
          .select("is_tax_registered, tax_rate, cash_rounding, receipt_prefix, receipt_footer_en, receipt_footer_ar")
          .eq("id", shopId)
          .maybeSingle(),
        // tax_number is private: read through the staff-only definer RPC.
        supabase.rpc("get_my_shop_tax"),
      ]);
      if (shop.error) return { data: null, error: { message: shop.error.message } };
      const s = (shop.data ?? {}) as Record<string, unknown>;
      const taxRow = (Array.isArray(tax.data) ? tax.data[0] : tax.data) as { tax_number?: string | null } | null;
      return {
        data: {
          isTaxRegistered: !!s.is_tax_registered,
          taxNumber: taxRow?.tax_number ?? "",
          taxRate: String(Number(s.tax_rate ?? 16)),
          cashRounding: Number(s.cash_rounding ?? 0),
          receiptPrefix: String(s.receipt_prefix ?? ""),
          footerEn: String(s.receipt_footer_en ?? ""),
          footerAr: String(s.receipt_footer_ar ?? ""),
        },
        error: null,
      };
    },
    [supabase, shopId],
    { enabled: !!shopId, retryCount: 0 },
  );

  const d = draft ?? query.data;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(query.data);
  const set = (patch: Partial<TaxDraft>) => d && setDraft({ ...d, ...patch });

  async function save() {
    if (!d || saving) return;
    const issue = validateTax(d);
    if (issue) {
      setError(
        issue === "TAX_NUMBER"
          ? tt.taxNumberInvalid
          : issue === "TAX_RATE"
            ? tt.taxRateInvalid
            : issue === "PREFIX"
              ? tt.prefixInvalid
              : issue === "FOOTER"
                ? tt.footerTooLong
                : tt.roundingInvalid,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: e } = await supabase
        .from("shops")
        .update({
          is_tax_registered: d.isTaxRegistered,
          tax_number: normalizeTaxNumber(d.taxNumber) || null,
          tax_rate: parseRate(d.taxRate) ?? 16,
          cash_rounding: d.cashRounding,
          receipt_prefix: d.receiptPrefix || null,
          receipt_footer_en: d.footerEn.trim() || null,
          receipt_footer_ar: d.footerAr.trim() || null,
        })
        .eq("id", shopId);
      if (e) throw e;
      toast.success(tt.saved);
      setDraft(null);
      query.refetch();
    } catch (err) {
      setError(dbErrorMessage(t, err, tt.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  if (query.initialLoading) return <ListSkeleton rows={4} />;
  if (query.error || !d) {
    return <EmptyState tone="error" icon={AlertCircle} title={tt.loadFailed} action={{ label: t.common.retry, onClick: query.refetch }} />;
  }

  const rate = parseRate(d.taxRate) ?? 0;
  const example = 10;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Tax ── */}
      <section aria-labelledby="tx-title" className={card}>
        <h2 id="tx-title" className={h2}>
          {tt.taxTitle}
        </h2>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={d.isTaxRegistered}
            onChange={(e) => set({ isTaxRegistered: e.target.checked })}
            disabled={saving}
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{tt.registered}</span>
            <span className="block text-[13px] text-ink-soft">{tt.registeredHint}</span>
          </span>
        </label>
        <div className={cn("grid gap-3 sm:grid-cols-2", !d.isTaxRegistered && "opacity-60")}>
          <div className="flex flex-col gap-1">
            <label htmlFor="tx-number" className="field-label">
              {tt.taxNumber}
            </label>
            <input
              id="tx-number"
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              value={d.taxNumber}
              onChange={(e) => set({ taxNumber: e.target.value })}
              disabled={saving}
              className="field-input tabular-nums"
              aria-describedby="tx-number-hint"
            />
            <span id="tx-number-hint" className="text-[12px] text-ink-muted">
              {tt.taxNumberHint}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tx-rate" className="field-label">
              {tt.taxRate}
            </label>
            <input
              id="tx-rate"
              dir="ltr"
              inputMode="decimal"
              value={d.taxRate}
              onChange={(e) => set({ taxRate: e.target.value })}
              disabled={saving || !d.isTaxRegistered}
              className="field-input tabular-nums"
            />
          </div>
        </div>
        <p className="m-0 rounded-xl bg-sunken p-3 text-[13px] text-ink-soft">
          {d.isTaxRegistered && rate > 0
            ? interpolate(tt.inclusiveExample, {
                price: formatJOD(example, locale),
                rate: String(rate),
                tax: formatJOD(inclusiveTax(example, rate), locale),
              })
            : tt.notRegisteredNote}
        </p>
      </section>

      {/* ── Cash rounding ── */}
      <section aria-labelledby="tr-title" className={card}>
        <div>
          <h2 id="tr-title" className={h2}>
            {tt.roundingTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-soft">{tt.roundingHelp}</p>
        </div>
        <div role="radiogroup" aria-labelledby="tr-title" className="flex flex-wrap gap-2">
          {CASH_ROUNDING_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={d.cashRounding === step}
              onClick={() => set({ cashRounding: step })}
              disabled={saving}
              className={cn(
                "focus-ring min-h-11 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors",
                d.cashRounding === step
                  ? "border-ink bg-sunken text-ink"
                  : "border-line text-ink-soft hover:border-line-strong",
              )}
            >
              {step === 0 ? tt.roundingOff : formatJOD(step, locale)}
            </button>
          ))}
        </div>
      </section>

      {/* ── Receipts ── */}
      <section aria-labelledby="rc-title" className={card}>
        <div className="flex items-start gap-3">
          <Receipt size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-soft" />
          <div>
            <h2 id="rc-title" className={h2}>
              {tt.receiptsTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{tt.receiptsHelp}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rc-prefix" className="field-label">
            {tt.prefix}
          </label>
          <input
            id="rc-prefix"
            dir="ltr"
            maxLength={8}
            value={d.receiptPrefix}
            onChange={(e) => set({ receiptPrefix: normalizePrefix(e.target.value) })}
            disabled={saving}
            className="field-input uppercase sm:w-48"
            aria-describedby="rc-prefix-hint"
          />
          <span id="rc-prefix-hint" className="text-[12px] text-ink-muted">
            {interpolate(tt.prefixHint, { example: receiptNumberPreview(d.receiptPrefix, 1) })}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="rc-footer-ar" className="field-label">
              {tt.footerAr}
            </label>
            <textarea
              id="rc-footer-ar"
              dir="rtl"
              lang="ar"
              maxLength={300}
              rows={3}
              value={d.footerAr}
              onChange={(e) => set({ footerAr: e.target.value })}
              disabled={saving}
              className="field-input min-h-[88px] resize-y"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rc-footer-en" className="field-label">
              {tt.footerEn}
            </label>
            <textarea
              id="rc-footer-en"
              dir="ltr"
              lang="en"
              maxLength={300}
              rows={3}
              value={d.footerEn}
              onChange={(e) => set({ footerEn: e.target.value })}
              disabled={saving}
              className="field-input min-h-[88px] resize-y"
            />
          </div>
        </div>
        <p className="m-0 text-[12px] text-ink-muted">{tt.sequenceNote}</p>
      </section>

      {error && (
        <p role="alert" className="field-error m-0">
          {error}
        </p>
      )}

      {/* Sticky save within thumb reach on mobile. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-line bg-card px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <button type="button" className="btn btn-secondary min-h-11 flex-1 sm:flex-none" onClick={() => setDraft(null)} disabled={saving || !dirty}>
          {tt.discard}
        </button>
        <button type="button" className="btn btn-primary min-h-11 flex-1 sm:flex-none" onClick={() => void save()} disabled={saving || !dirty} aria-busy={saving || undefined}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {saving ? t.common.processing : t.common.save}
        </button>
      </div>
    </div>
  );
}
