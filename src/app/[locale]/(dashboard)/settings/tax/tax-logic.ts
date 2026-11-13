// Pure helpers for the tax & receipts settings (WS-1F).
// Tax model (roadmap §3): displayed prices include tax; tax is computed per
// line and rounded to the fils; tax lines appear only when the shop is
// tax-registered.

export const CASH_ROUNDING_STEPS = [0, 0.05, 0.1, 0.25, 0.5] as const;
export type CashRoundingStep = (typeof CASH_ROUNDING_STEPS)[number];

export interface TaxDraft {
  isTaxRegistered: boolean;
  taxNumber: string;
  taxRate: string;
  cashRounding: number;
  receiptPrefix: string;
  footerEn: string;
  footerAr: string;
}

export type TaxIssue = "TAX_NUMBER" | "TAX_RATE" | "ROUNDING" | "PREFIX" | "FOOTER";

const toLatin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace("٫", ".");

/** Digits only (Arabic-Indic accepted), spaces and dashes ignored. */
export function normalizeTaxNumber(raw: string): string {
  return toLatin(raw).replace(/[\s-]/g, "");
}

/** "ab12" → "AB12"; strips anything outside A-Z0-9. */
export function normalizePrefix(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function parseRate(raw: string): number | null {
  const v = toLatin(raw).trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 100 ? n : null;
}

export function validateTax(d: TaxDraft): TaxIssue | null {
  if (d.isTaxRegistered) {
    const n = normalizeTaxNumber(d.taxNumber);
    if (!/^\d{6,15}$/.test(n)) return "TAX_NUMBER";
    const r = parseRate(d.taxRate);
    if (r === null || r <= 0) return "TAX_RATE";
  } else if (d.taxNumber.trim() && !/^\d{6,15}$/.test(normalizeTaxNumber(d.taxNumber))) {
    return "TAX_NUMBER";
  }
  if (!(CASH_ROUNDING_STEPS as readonly number[]).includes(d.cashRounding)) return "ROUNDING";
  if (d.receiptPrefix && !/^[A-Z0-9]{1,8}$/.test(d.receiptPrefix)) return "PREFIX";
  if (d.footerEn.length > 300 || d.footerAr.length > 300) return "FOOTER";
  return null;
}

/** Tax inside a tax-inclusive price, rounded to the fils (same as pos_checkout). */
export function inclusiveTax(price: number, ratePercent: number): number {
  if (!(ratePercent > 0) || !(price > 0)) return 0;
  const fils = Math.round(price * 1000);
  return Math.round((fils * ratePercent) / (100 + ratePercent)) / 1000;
}

/** The receipt number as printed: prefix + 6-digit sequence. */
export function receiptNumberPreview(prefix: string, n = 1): string {
  const seq = String(n).padStart(6, "0");
  return prefix ? `${prefix}-${seq}` : seq;
}
