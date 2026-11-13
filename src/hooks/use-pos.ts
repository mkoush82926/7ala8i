"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import type { TranslationKeys } from "@/i18n/en";

// ═══════════════════════════════════════════════════════════════════════════
// POS (WS-1F): the checkout cart model, its money maths (identical to the
// SQL in migration 20250101002500 so the preview matches the receipt to the
// fils), receipt text, and the hook that talks to the RPCs.
//
// Money is computed in integer fils (1 JD = 1000 fils) to avoid float drift.
// Tax model (§3): prices include tax, tax per line rounded to the fils, sale
// total = sum of lines. Tax only when the shop is tax-registered.
// ═══════════════════════════════════════════════════════════════════════════

/** Legacy one-tap methods (kept for existing call sites). */
export type PaymentMethod = "cash" | "card";

export interface CheckoutOptions {
  appointmentId: string;
  method: PaymentMethod;
  /** Defaults to the appointment price on the server. */
  amount?: number | null;
  // Legacy fields kept so existing call sites still type-check; the server
  // derives client, service and barber from the appointment row.
  clientName?: string;
  barberName?: string;
  serviceLabel?: string;
  scheduledTime?: string;
}

export type PosResult = { ok: true; receipt?: SaleReceipt | null } | { ok: false; code: string };

// ─── Cart model ──────────────────────────────────────────────────────────────

export type CartItemKind = "service" | "product" | "custom";

export interface DiscountSpec {
  type: "amount" | "percent";
  /** JD for "amount", 0–100 for "percent". */
  value: number;
}

export interface CartItem {
  /** Stable client key for React lists. */
  key: string;
  kind: CartItemKind;
  serviceId?: string | null;
  variantId?: string | null;
  productId?: string | null;
  barberId?: string | null;
  name: string;
  nameAr?: string | null;
  quantity: number;
  /** Tax-inclusive unit price in JD. */
  unitPrice: number;
  discount?: DiscountSpec | null;
  discountReason?: string | null;
}

export interface CartTip {
  key: string;
  barberId: string | null;
  amount: number;
}

export interface CartPayment {
  key: string;
  methodCode: string;
  amount: number;
  reference?: string | null;
}

export interface Cart {
  /** Client-generated id; doubles as the idempotency key. */
  saleId: string;
  appointmentId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  items: CartItem[];
  cartDiscount?: (DiscountSpec & { reason?: string | null }) | null;
  tips: CartTip[];
  payments: CartPayment[];
  allowPartial?: boolean;
  applyCashRounding?: boolean;
  note?: string | null;
}

export interface CartSettings {
  isTaxRegistered: boolean;
  /** Percent, e.g. 16. */
  taxRate: number;
  /** 0 (off) or 0.05 / 0.1 / 0.25 / 0.5 JD. */
  cashRounding: number;
  /** Codes of payment methods whose kind is "cash". */
  cashMethodCodes: readonly string[];
}

export interface CartLineTotals {
  key: string;
  gross: number;
  lineDiscount: number;
  cartShare: number;
  lineTotal: number;
  taxAmount: number;
}

export interface CartTotals {
  lines: CartLineTotals[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipTotal: number;
  roundingAdjustment: number;
  /** Amount the client pays: lines + tips + rounding. */
  total: number;
  paidTotal: number;
  /** total − paid (negative when over-tendered). */
  balance: number;
  taxRate: number;
}

export const toFils = (jd: number): number => Math.round((Number(jd) || 0) * 1000);
export const fromFils = (fils: number): number => fils / 1000;

/** Discount in fils for a base in fils; mirrors public.pos_discount_amount. */
export function discountFils(baseFils: number, spec: DiscountSpec | null | undefined): number {
  if (!spec || !(spec.value > 0) || baseFils <= 0) return 0;
  if (spec.type === "percent") return Math.min(Math.round((baseFils * Math.min(spec.value, 100)) / 100), baseFils);
  return Math.min(toFils(spec.value), baseFils);
}

/** Cart totals; identical algorithm to public.pos_checkout. */
export function computeCartTotals(cart: Pick<Cart, "items" | "cartDiscount" | "tips" | "payments" | "applyCashRounding">, settings: CartSettings): CartTotals {
  const rate = settings.isTaxRegistered ? Math.max(0, settings.taxRate || 0) : 0;
  const gross = cart.items.map((i) => toFils(i.unitPrice) * Math.max(1, Math.floor(i.quantity || 1)));
  const lineDisc = cart.items.map((i, n) => discountFils(gross[n], i.discount));
  const net = gross.map((g, n) => g - lineDisc[n]);
  const sumNet = net.reduce((a, b) => a + b, 0);
  let big = 0;
  net.forEach((v, n) => {
    if (v > net[big]) big = n;
  });

  const cartDisc = discountFils(sumNet, cart.cartDiscount ?? null);
  const share = net.map((v) => (sumNet > 0 ? Math.min(Math.floor((cartDisc * v) / sumNet), v) : 0));
  const alloc = share.reduce((a, b) => a + b, 0);
  if (net.length && cartDisc - alloc > 0) share[big] = Math.min(share[big] + (cartDisc - alloc), net[big]);

  const lines: CartLineTotals[] = cart.items.map((item, n) => {
    const lineTotal = net[n] - share[n];
    const tax = rate > 0 ? Math.round((lineTotal * rate) / (100 + rate)) : 0;
    return {
      key: item.key,
      gross: fromFils(gross[n]),
      lineDiscount: fromFils(lineDisc[n]),
      cartShare: fromFils(share[n]),
      lineTotal: fromFils(lineTotal),
      taxAmount: fromFils(tax),
    };
  });

  const netTotal = lines.reduce((a, l) => a + toFils(l.lineTotal), 0);
  const taxTotal = lines.reduce((a, l) => a + toFils(l.taxAmount), 0);
  const tipTotal = cart.tips.reduce((a, tp) => a + Math.max(0, toFils(tp.amount)), 0);
  const paid = cart.payments.reduce((a, p) => a + Math.max(0, toFils(p.amount)), 0);

  const allCash =
    cart.payments.length > 0 && cart.payments.every((p) => settings.cashMethodCodes.includes(p.methodCode));
  let adj = 0;
  const inc = toFils(settings.cashRounding);
  if (cart.applyCashRounding && inc > 0 && allCash) {
    const due = netTotal + tipTotal;
    adj = Math.round(due / inc) * inc - due;
  }
  const total = netTotal + tipTotal + adj;

  return {
    lines,
    subtotal: fromFils(gross.reduce((a, b) => a + b, 0)),
    discountTotal: fromFils(lineDisc.reduce((a, b) => a + b, 0) + cartDisc),
    taxTotal: fromFils(taxTotal),
    tipTotal: fromFils(tipTotal),
    roundingAdjustment: fromFils(adj),
    total: fromFils(total),
    paidTotal: fromFils(paid),
    balance: fromFils(total - paid),
    taxRate: rate,
  };
}

/** Why a cart cannot be charged yet (null = ready). */
export type CartIssue = "EMPTY" | "INVALID_LINE" | "PAYMENT_MISMATCH" | "PAYMENT_EXCEEDS_TOTAL";

export function validateCart(cart: Cart, totals: CartTotals): CartIssue | null {
  if (cart.items.length === 0) return "EMPTY";
  if (cart.items.some((i) => !i.name.trim() || !(i.unitPrice >= 0) || i.unitPrice > 100000 || !(i.quantity >= 1 && i.quantity <= 99))) {
    return "INVALID_LINE";
  }
  const balance = toFils(totals.balance);
  if (balance < 0) return "PAYMENT_EXCEEDS_TOTAL";
  if (balance > 0 && !(cart.allowPartial && toFils(totals.paidTotal) > 0)) return "PAYMENT_MISMATCH";
  return null;
}

/** JSON payload for public.checkout_sale(p_payload). */
export function toCheckoutPayload(cart: Cart): Record<string, unknown> {
  return {
    sale_id: cart.saleId,
    appointment_id: cart.appointmentId ?? null,
    client_id: cart.clientId ?? null,
    client_name: cart.clientName ?? null,
    items: cart.items.map((i) => ({
      kind: i.kind,
      service_id: i.serviceId ?? null,
      variant_id: i.variantId ?? null,
      product_id: i.productId ?? null,
      barber_id: i.barberId ?? null,
      name: i.name.trim(),
      name_ar: i.nameAr ?? null,
      quantity: Math.max(1, Math.floor(i.quantity || 1)),
      unit_price: fromFils(toFils(i.unitPrice)),
      discount: i.discount && i.discount.value > 0 ? { type: i.discount.type, value: i.discount.value } : null,
      discount_reason: i.discountReason ?? null,
    })),
    cart_discount:
      cart.cartDiscount && cart.cartDiscount.value > 0
        ? { type: cart.cartDiscount.type, value: cart.cartDiscount.value, reason: cart.cartDiscount.reason ?? null }
        : null,
    tips: cart.tips.filter((tp) => toFils(tp.amount) > 0).map((tp) => ({ barber_id: tp.barberId, amount: fromFils(toFils(tp.amount)) })),
    payments: cart.payments
      .filter((p) => toFils(p.amount) > 0)
      .map((p) => ({ method_code: p.methodCode, amount: fromFils(toFils(p.amount)), reference: p.reference ?? null })),
    allow_partial: !!cart.allowPartial,
    apply_cash_rounding: !!cart.applyCashRounding,
    note: cart.note ?? null,
  };
}

/** Random UUID v4 (crypto when available). */
export function newSaleId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let keySeq = 0;
export const cartKey = (prefix = "k"): string => `${prefix}${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** Appointment cart lines (RPC appointment_cart_lines rows) → CartItem[]. */
export function cartItemsFromLines(rows: unknown): CartItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    const kind = row.kind === "product" || row.kind === "custom" ? row.kind : "service";
    return {
      key: cartKey("l"),
      kind,
      serviceId: (row.service_id as string | null) ?? null,
      variantId: (row.variant_id as string | null) ?? null,
      productId: (row.product_id as string | null) ?? null,
      barberId: (row.barber_id as string | null) ?? null,
      name: String(row.name ?? ""),
      nameAr: (row.name_ar as string | null) ?? null,
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price ?? row.price) || 0,
      discount: null,
    };
  });
}

// ─── Payment drafts (checkout dialog) ────────────────────────────────────────

/** A payment row as typed in the dialog. `auto` rows take whatever is left. */
export interface PaymentDraft {
  key: string;
  methodCode: string;
  /** Raw input (may hold Arabic-Indic digits or a decimal comma). */
  amount: string;
  /** True until the user types an amount: follows the remaining balance. */
  auto: boolean;
  reference?: string | null;
}

const MONEY_RE = /^\d{1,6}(\.\d{0,3})?$/;

/** "12.5", "١٢٫٥", "12,5" → 12.5; "" → 0; invalid → null. */
export function parseMoneyInput(raw: string): number | null {
  const v = toLatinDigitsLoose(raw).trim().replace(",", ".");
  if (v === "") return 0;
  if (!MONEY_RE.test(v)) return null;
  return fromFils(toFils(Number(v)));
}

function toLatinDigitsLoose(input: string): string {
  return input.replace(/[٠-٩۰-۹٫]/g, (ch) => {
    if (ch === "٫") return ".";
    const ar = "٠١٢٣٤٥٦٧٨٩".indexOf(ch);
    return String(ar >= 0 ? ar : "۰۱۲۳۴۵۶۷۸۹".indexOf(ch));
  });
}

/**
 * Cart payments from the dialog's drafts plus the resulting totals. The first
 * `auto` draft takes the remaining balance (never negative); other auto drafts
 * take 0. Cash rounding depends only on the methods, so totals are computed
 * once without amounts and again with them.
 */
export function resolvePaymentDrafts(
  cart: Omit<Cart, "payments">,
  drafts: PaymentDraft[],
  settings: CartSettings,
): { payments: CartPayment[]; totals: CartTotals; invalidKeys: string[] } {
  const invalidKeys: string[] = [];
  const shape = drafts.map((d) => ({ key: d.key, methodCode: d.methodCode, amount: 0 }));
  const pre = computeCartTotals({ ...cart, payments: shape }, settings);
  let explicitFils = 0;
  for (const d of drafts) {
    if (d.auto) continue;
    const n = parseMoneyInput(d.amount);
    if (n === null) invalidKeys.push(d.key);
    else explicitFils += toFils(n);
  }
  let autoUsed = false;
  const payments: CartPayment[] = drafts.map((d) => {
    let amount = 0;
    if (d.auto) {
      if (!autoUsed) amount = fromFils(Math.max(0, toFils(pre.total) - explicitFils));
      autoUsed = true;
    } else {
      amount = parseMoneyInput(d.amount) ?? 0;
    }
    return { key: d.key, methodCode: d.methodCode, amount, reference: d.reference ?? null };
  });
  return { payments, totals: computeCartTotals({ ...cart, payments }, settings), invalidKeys };
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface SaleReceiptLine {
  kind: CartItemKind;
  name: string;
  nameAr: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  cartDiscount: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
}

export interface SaleReceiptPayment {
  methodCode: string;
  nameEn: string | null;
  nameAr: string | null;
  amount: number;
}

export interface SaleReceipt {
  saleId: string;
  appointmentId: string | null;
  clientId: string | null;
  clientName: string;
  status: "draft" | "part_paid" | "paid" | "voided" | "refunded";
  currency: string;
  receiptNo: number | null;
  receiptNumber: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipTotal: number;
  roundingAdjustment: number;
  total: number;
  paidTotal: number;
  balance: number;
  taxRegistered: boolean;
  taxNumber: string | null;
  completedAt: string | null;
  createdAt: string | null;
  shop: { name: string; nameAr: string | null; phone: string | null; footerEn: string | null; footerAr: string | null; timezone: string };
  items: SaleReceiptLine[];
  payments: SaleReceiptPayment[];
  tips: { barberId: string | null; barberName: string | null; amount: number }[];
}

const num = (v: unknown) => Number(v) || 0;
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** RPC jsonb (sale_receipt_json) → SaleReceipt. Returns null for bad input. */
export function parseSaleReceipt(json: unknown): SaleReceipt | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (typeof j.sale_id !== "string") return null;
  const shop = (j.shop ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    saleId: j.sale_id,
    appointmentId: strOrNull(j.appointment_id),
    clientId: strOrNull(j.client_id),
    clientName: String(j.client_name ?? ""),
    status: (j.status as SaleReceipt["status"]) ?? "paid",
    currency: String(j.currency ?? "JOD"),
    receiptNo: j.receipt_no == null ? null : num(j.receipt_no),
    receiptNumber: strOrNull(j.receipt_number),
    subtotal: num(j.subtotal),
    discountTotal: num(j.discount_total),
    taxTotal: num(j.tax_total),
    tipTotal: num(j.tip_total),
    roundingAdjustment: num(j.rounding_adjustment),
    total: num(j.total),
    paidTotal: num(j.paid_total),
    balance: num(j.balance),
    taxRegistered: !!j.tax_registered,
    taxNumber: strOrNull(j.tax_number),
    completedAt: strOrNull(j.completed_at),
    createdAt: strOrNull(j.created_at),
    shop: {
      name: String(shop.name ?? ""),
      nameAr: strOrNull(shop.name_ar),
      phone: strOrNull(shop.phone),
      footerEn: strOrNull(shop.footer_en),
      footerAr: strOrNull(shop.footer_ar),
      timezone: String(shop.timezone ?? "Asia/Amman"),
    },
    items: arr(j.items).map((i) => ({
      kind: (i.kind as CartItemKind) ?? "custom",
      name: String(i.name ?? ""),
      nameAr: strOrNull(i.name_ar),
      quantity: num(i.quantity) || 1,
      unitPrice: num(i.unit_price),
      discountAmount: num(i.discount_amount),
      cartDiscount: num(i.cart_discount),
      lineTotal: num(i.line_total),
      taxRate: num(i.tax_rate),
      taxAmount: num(i.tax_amount),
    })),
    payments: arr(j.payments).map((p) => ({
      methodCode: String(p.method_code ?? ""),
      nameEn: strOrNull(p.name_en),
      nameAr: strOrNull(p.name_ar),
      amount: num(p.amount),
    })),
    tips: arr(j.tips).map((tp) => ({
      barberId: strOrNull(tp.barber_id),
      barberName: strOrNull(tp.barber_name),
      amount: num(tp.amount),
    })),
  };
}

/** Labels for the plain-text receipt (from t.pos.receipt.*). */
export interface ReceiptLabels {
  receipt: string;
  date: string;
  client: string;
  subtotal: string;
  discount: string;
  tax: string;
  taxNumber: string;
  tip: string;
  rounding: string;
  total: string;
  paid: string;
  balance: string;
  pricesIncludeTax: string;
  thanks: string;
}

/**
 * Plain-text receipt for WhatsApp, in the recipient's language. Every money
 * amount goes through `money`, every date through `date`; tax lines appear
 * only for a tax-registered sale.
 */
export function buildReceiptText(
  r: SaleReceipt,
  opts: { locale: "en" | "ar"; labels: ReceiptLabels; money: (amount: number) => string; date: (iso: string) => string },
): string {
  const { locale, labels: L, money } = opts;
  const shopName = (locale === "ar" && r.shop.nameAr) || r.shop.name;
  const out: string[] = [];
  out.push(`*${shopName}*`);
  if (r.receiptNumber) out.push(`${L.receipt}: ${r.receiptNumber}`);
  const when = r.completedAt ?? r.createdAt;
  if (when) out.push(`${L.date}: ${opts.date(when)}`);
  if (r.clientName) out.push(`${L.client}: ${r.clientName}`);
  if (r.taxRegistered && r.taxNumber) out.push(`${L.taxNumber}: ${r.taxNumber}`);
  out.push("");
  for (const i of r.items) {
    const name = (locale === "ar" && i.nameAr) || i.name;
    const qty = i.quantity > 1 ? ` × ${i.quantity}` : "";
    out.push(`${name}${qty} — ${money(i.lineTotal)}`);
  }
  out.push("");
  if (r.discountTotal > 0) {
    out.push(`${L.subtotal}: ${money(r.subtotal)}`);
    out.push(`${L.discount}: −${money(r.discountTotal)}`);
  }
  if (r.tipTotal > 0) out.push(`${L.tip}: ${money(r.tipTotal)}`);
  if (r.roundingAdjustment !== 0) out.push(`${L.rounding}: ${money(r.roundingAdjustment)}`);
  out.push(`*${L.total}: ${money(r.total)}*`);
  if (r.taxRegistered && r.taxTotal > 0) {
    const rates = Array.from(new Set(r.items.map((i) => i.taxRate).filter((x) => x > 0)));
    out.push(`${L.tax}${rates.length === 1 ? ` (${rates[0]}%)` : ""}: ${money(r.taxTotal)} · ${L.pricesIncludeTax}`);
  }
  for (const p of r.payments) {
    const pname = (locale === "ar" ? p.nameAr : p.nameEn) || p.methodCode;
    out.push(`${L.paid} (${pname}): ${money(p.amount)}`);
  }
  if (r.balance > 0) out.push(`${L.balance}: ${money(r.balance)}`);
  const footer = locale === "ar" ? r.shop.footerAr : r.shop.footerEn;
  out.push("");
  out.push(footer || L.thanks);
  return out.join("\n");
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Localised text for a DB/API error code: t.error.codes[code] ?? t.error.message. */
export function errorMessageFor(t: TranslationKeys, code?: string | null): string {
  const codes = (t.error as { codes?: Record<string, string | undefined> }).codes;
  return (code && codes?.[code]) || t.error.message;
}

/** The P0001 RPC errors carry the code in `message`; PostgREST errors in `code`. */
export function codeOf(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "INTERNAL";
  if (error.message && /^[A-Z][A-Z_]+$/.test(error.message)) return error.message;
  if (error.code === "23P01") return "SLOT_TAKEN";
  if (error.code === "23505") return "CONFLICT";
  if (error.code === "42501") return "NOT_AUTHORIZED";
  return "INTERNAL";
}

/** True when the RPC does not exist yet (migration not applied). */
function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? ""));
}

// ─── Dashboard invalidation ──────────────────────────────────────────────────

/**
 * Tiny invalidation counter: every successful POS mutation bumps it, and the
 * overview widgets (metric cards, daily receipt, sales chart, upcoming list)
 * include it in their query deps so they refresh together.
 */
interface DashboardVersionState {
  version: number;
  bump: () => void;
}

export const useDashboardVersionStore = create<DashboardVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function useDashboardVersion(): number {
  return useDashboardVersionStore((s) => s.version);
}

export function invalidateDashboard() {
  useDashboardVersionStore.getState().bump();
}

// ─── Staged carts ────────────────────────────────────────────────────────────
// The checkout dialog stages the full cart for an appointment, then calls the
// page's legacy onConfirm(method) → markPaid(). markPaid finds the staged cart
// and charges it through checkout_sale, so existing pages get split payments,
// discounts, tips and receipts without changing their code.

const stagedCarts = new Map<string, Cart>();

export function stageCheckoutCart(appointmentId: string, cart: Cart): void {
  stagedCarts.set(appointmentId, cart);
}

export function clearStagedCart(appointmentId: string): void {
  stagedCarts.delete(appointmentId);
}

export function getStagedCart(appointmentId: string): Cart | undefined {
  return stagedCarts.get(appointmentId);
}

// ─── Checkout settings ───────────────────────────────────────────────────────

export interface PosPaymentMethod {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  kind: "cash" | "card" | "cliq" | "wallet" | "bank_transfer" | "online" | "other";
  cliqAlias: string | null;
  qrUrl: string | null;
  isActive: boolean;
  isSystem: boolean;
  sort: number;
}

export interface PosProduct {
  id: string;
  nameEn: string;
  nameAr: string | null;
  price: number;
  sku: string | null;
}

export interface PosServiceOption {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
}

export interface CheckoutSettings extends CartSettings {
  currency: string;
  methods: PosPaymentMethod[];
  products: PosProduct[];
  services: PosServiceOption[];
}

/** Used when the 1F tables are not there yet: cash and card only. */
export const FALLBACK_METHODS: PosPaymentMethod[] = [
  { id: "cash", code: "cash", nameEn: "", nameAr: "", kind: "cash", cliqAlias: null, qrUrl: null, isActive: true, isSystem: true, sort: 10 },
  { id: "card", code: "card", nameEn: "", nameAr: "", kind: "card", cliqAlias: null, qrUrl: null, isActive: true, isSystem: true, sort: 20 },
];

export function mapPaymentMethodRow(r: Record<string, unknown>): PosPaymentMethod {
  return {
    id: String(r.id),
    code: String(r.code),
    nameEn: String(r.name_en ?? ""),
    nameAr: String(r.name_ar ?? ""),
    kind: (r.kind as PosPaymentMethod["kind"]) ?? "other",
    cliqAlias: strOrNull(r.cliq_alias),
    qrUrl: strOrNull(r.qr_url),
    isActive: r.is_active !== false,
    isSystem: !!r.is_system,
    sort: Number(r.sort) || 0,
  };
}

/** Loads tax, rounding, active payment methods, products and services. */
export function useCheckoutSettings(enabled = true) {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const workspaceCurrency = useWorkspaceStore((s) => s.currency);
  const [supabase] = useState(() => createClient());
  const [state, setState] = useState<{ data: CheckoutSettings | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled || !shopId) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const [shopRes, methodsRes, productsRes, servicesRes] = await Promise.all([
        supabase.from("shops").select("currency, is_tax_registered, tax_rate, cash_rounding").eq("id", shopId).maybeSingle(),
        supabase.from("payment_methods").select("*").eq("shop_id", shopId).eq("is_active", true).order("sort"),
        supabase.from("products").select("id, name_en, name_ar, price, sku").eq("shop_id", shopId).eq("is_active", true).order("sort"),
        supabase.from("services").select("id, name, name_ar, price").eq("shop_id", shopId).eq("is_active", true).order("sort_order"),
      ]);
      if (cancelled) return;
      // Older schema (1F columns missing): retry with the base columns.
      let shop = shopRes.data as Record<string, unknown> | null;
      if (shopRes.error) {
        const retry = await supabase.from("shops").select("currency, is_tax_registered").eq("id", shopId).maybeSingle();
        shop = (retry.data as Record<string, unknown> | null) ?? null;
      }
      const methods =
        !methodsRes.error && Array.isArray(methodsRes.data) && methodsRes.data.length
          ? (methodsRes.data as Record<string, unknown>[]).map(mapPaymentMethodRow)
          : FALLBACK_METHODS;
      const data: CheckoutSettings = {
        currency: String(shop?.currency ?? workspaceCurrency ?? "JOD"),
        isTaxRegistered: !!shop?.is_tax_registered,
        taxRate: Number(shop?.tax_rate ?? 16),
        cashRounding: Number(shop?.cash_rounding ?? 0),
        cashMethodCodes: methods.filter((m) => m.kind === "cash").map((m) => m.code),
        methods,
        products: productsRes.error
          ? []
          : ((productsRes.data ?? []) as Record<string, unknown>[]).map((p) => ({
              id: String(p.id),
              nameEn: String(p.name_en ?? ""),
              nameAr: strOrNull(p.name_ar),
              price: Number(p.price) || 0,
              sku: strOrNull(p.sku),
            })),
        services: servicesRes.error
          ? []
          : ((servicesRes.data ?? []) as Record<string, unknown>[]).map((s) => ({
              id: String(s.id),
              name: String(s.name ?? ""),
              nameAr: strOrNull(s.name_ar),
              price: Number(s.price) || 0,
            })),
      };
      setState({ data, loading: false, error: null });
    })().catch(() => {
      if (!cancelled) setState({ data: null, loading: false, error: "INTERNAL" });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, shopId, supabase, workspaceCurrency, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refetch };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UsePosOptions {
  /** Toast the localised error automatically (default true). */
  toastErrors?: boolean;
}

export type CheckoutResult = { ok: true; receipt: SaleReceipt | null } | { ok: false; code: string };

/**
 * Appointment checkout actions. Every method resolves to `{ ok }` instead of
 * throwing; on failure it has already shown an error toast (unless
 * `toastErrors: false`), so callers only toast success when `ok` is true.
 */
export function usePos({ toastErrors = true }: UsePosOptions = {}) {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const { t } = useTranslation();
  const [supabase] = useState(() => createClient());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // Guards against double submits (double-click, two tabs of the same row).
  const inFlight = useRef(new Set<string>());

  const run = useCallback(
    async <R extends PosResult | CheckoutResult>(key: string, action: () => Promise<R>): Promise<R | { ok: false; code: string }> => {
      if (!shopId) {
        const res = { ok: false as const, code: "NO_SHOP" };
        if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      }
      if (inFlight.current.has(key)) return { ok: false, code: "IN_FLIGHT" };
      inFlight.current.add(key);
      setLoadingId(key);
      try {
        const res = await action();
        if (res.ok) invalidateDashboard();
        else if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      } catch {
        const res = { ok: false as const, code: "INTERNAL" };
        if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      } finally {
        inFlight.current.delete(key);
        setLoadingId((cur) => (cur === key ? null : cur));
      }
    },
    [shopId, t, toastErrors],
  );

  /** Legacy one-tap path: complete_appointment_sale(appointment, method). */
  const legacyMarkPaid = useCallback(
    async (appointmentId: string, method: string, amount: number | null): Promise<PosResult> => {
      const { error } = await supabase.rpc("complete_appointment_sale", {
        p_appointment_id: appointmentId,
        p_payment_method: method,
        p_amount: amount,
      });
      return error ? { ok: false, code: codeOf(error) } : { ok: true, receipt: null };
    },
    [supabase],
  );

  /** Charges a full cart through checkout_sale (falls back to the legacy RPC). */
  const chargeCart = useCallback(
    async (cart: Cart): Promise<CheckoutResult> => {
      const { data, error } = await supabase.rpc("checkout_sale", { p_payload: toCheckoutPayload(cart) });
      if (error && isMissingRpc(error) && cart.appointmentId) {
        // Migration not applied yet: settle the appointment the old way.
        const first = cart.payments[0]?.methodCode;
        const res = await legacyMarkPaid(cart.appointmentId, first === "card" ? "card" : "cash", null);
        return res.ok ? { ok: true, receipt: null } : res;
      }
      if (error) return { ok: false, code: codeOf(error) };
      if (data == null && cart.appointmentId) {
        // Mock client / unknown RPC: legacy path keeps the demo working.
        const res = await legacyMarkPaid(cart.appointmentId, cart.payments[0]?.methodCode === "card" ? "card" : "cash", null);
        return res.ok ? { ok: true, receipt: null } : res;
      }
      return { ok: true, receipt: parseSaleReceipt(data) };
    },
    [legacyMarkPaid, supabase],
  );

  /**
   * Completes the appointment and records the sale atomically (idempotent).
   * When the checkout dialog staged a cart for this appointment, that cart is
   * charged (split payments, discounts, tips, products); otherwise the whole
   * booked amount is taken with `method`.
   */
  const markPaid = useCallback(
    (opts: CheckoutOptions) =>
      run(opts.appointmentId, async (): Promise<PosResult> => {
        const staged = stagedCarts.get(opts.appointmentId);
        if (staged) {
          const res = await chargeCart(staged);
          if (res.ok) stagedCarts.delete(opts.appointmentId);
          return res;
        }
        return legacyMarkPaid(opts.appointmentId, opts.method, opts.amount ?? null);
      }),
    [chargeCart, legacyMarkPaid, run],
  );

  /** Walk-in / standalone sale (no appointment). */
  const checkoutSale = useCallback((cart: Cart) => run(cart.saleId, () => chargeCart(cart)), [chargeCart, run]);

  /** Lines to prefill the cart for an appointment (1D appointment_services when present). */
  const loadAppointmentCart = useCallback(
    async (appointmentId: string): Promise<CartItem[] | null> => {
      const { data, error } = await supabase.rpc("appointment_cart_lines", { p_appointment_id: appointmentId });
      if (!error && Array.isArray(data)) return cartItemsFromLines(data);
      return null;
    },
    [supabase],
  );

  /** Settle the balance of a part-paid sale. */
  const addPayments = useCallback(
    (saleId: string, payments: CartPayment[]) =>
      run(saleId, async (): Promise<CheckoutResult> => {
        const { data, error } = await supabase.rpc("add_sale_payments", {
          p_sale_id: saleId,
          p_payments: payments.map((p) => ({ method_code: p.methodCode, amount: fromFils(toFils(p.amount)), reference: p.reference ?? null })),
        });
        if (error) return { ok: false, code: codeOf(error) };
        return { ok: true, receipt: parseSaleReceipt(data) };
      }),
    [run, supabase],
  );

  /** Void (or refund) a sale; shop admins only. */
  const voidSale = useCallback(
    (saleId: string, reason: string, refund = false) =>
      run(saleId, async (): Promise<CheckoutResult> => {
        const { data, error } = await supabase.rpc("void_sale", { p_sale_id: saleId, p_reason: reason, p_refund: refund });
        if (error) return { ok: false, code: codeOf(error) };
        return { ok: true, receipt: parseSaleReceipt(data) };
      }),
    [run, supabase],
  );

  /** Status-only update; DB triggers set no_show/cancelled_at/updated_at. */
  const updateStatus = useCallback(
    (appointmentId: string, patch: Record<string, unknown>) =>
      run(appointmentId, async (): Promise<PosResult> => {
        const { data, error } = await supabase
          .from("appointments")
          .update(patch)
          .eq("id", appointmentId)
          .eq("shop_id", shopId)
          .select("id");
        if (error) return { ok: false, code: codeOf(error) };
        // RLS filters rows silently: zero updated rows means "not yours".
        if (Array.isArray(data) && data.length === 0) return { ok: false, code: "NOT_AUTHORIZED" };
        return { ok: true };
      }),
    [run, shopId, supabase],
  );

  const markNoShow = useCallback(
    (appointmentId: string) => updateStatus(appointmentId, { status: "no_show" }),
    [updateStatus],
  );

  const cancelAppointment = useCallback(
    (appointmentId: string, reason?: string | null) =>
      updateStatus(appointmentId, {
        status: "cancelled",
        ...(reason ? { cancellation_reason: reason } : {}),
      }),
    [updateStatus],
  );

  return {
    markPaid,
    markNoShow,
    cancelAppointment,
    checkoutSale,
    loadAppointmentCart,
    addPayments,
    voidSale,
    loadingId,
  };
}
