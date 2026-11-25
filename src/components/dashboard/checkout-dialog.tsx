"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  Minus,
  Package,
  PenLine,
  Percent,
  Plus,
  Scissors,
  Tag,
  Trash2,
} from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/pill";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { checkboxClasses, focusRing } from "@/components/ui/recipes";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { enqueueMessage, buildWaLink } from "@/lib/messaging-stub";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { TranslationKeys } from "@/i18n/en";
import {
  buildReceiptText,
  cartKey,
  clearStagedCart,
  newSaleId,
  parseMoneyInput,
  resolvePaymentDrafts,
  stageCheckoutCart,
  usePos,
  useCheckoutSettings,
  validateCart,
  type Cart,
  type CartItem,
  type CheckoutSettings,
  type DiscountSpec,
  type PaymentDraft,
  type PaymentMethod,
  type PosPaymentMethod,
  type PosResult,
  type ReceiptLabels,
  type SaleReceipt,
} from "@/hooks/use-pos";

export interface CheckoutTarget {
  id: string;
  clientName: string;
  serviceName: string;
  /** Booked price; the cart is prefilled from the appointment's services when available. */
  amount: number;
  currency: string;
  /** Pre-formatted time/date label for the summary line. */
  whenLabel: string;
  /** Optional: used to send the receipt on WhatsApp. */
  clientPhone?: string | null;
  /** Optional: default barber for the tip. */
  barberId?: string | null;
}

type Locale = "en" | "ar";
type DraftDiscount = { type: DiscountSpec["type"]; value: string; reason: string };
type AddMode = null | "service" | "product" | "custom";

const DICTS: Record<Locale, TranslationKeys> = { en, ar };
// Dense POS fields: the v2 input recipe at h-11 (§5.2).
const inputCls =
  "h-11 w-full min-w-0 rounded-lg border border-line-strong bg-card px-3 text-base text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-150 hover:border-ink-soft focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15 disabled:bg-sunken disabled:text-ink-disabled motion-reduce:transition-none sm:text-sm";
const iconBtn = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none",
  focusRing,
);
const sectionTitle = "m-0 text-sm font-semibold text-ink";
const fieldsetCls = "flex flex-col gap-2 rounded-xl border border-line bg-card p-3";
const legendCls = "px-1 text-sm font-semibold text-ink";
const quietAction = cn(
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-text transition-colors duration-150 hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none [&_svg]:size-4",
  focusRing,
);

function toSpec(d: DraftDiscount | null): (DiscountSpec & { reason?: string | null }) | null {
  if (!d) return null;
  const value = parseMoneyInput(d.value) ?? 0;
  if (!(value > 0)) return null;
  return { type: d.type, value: d.type === "percent" ? Math.min(value, 100) : value, reason: d.reason.trim() || null };
}

/** Receipt labels in the recipient's language (independent of the UI language). */
function receiptLabels(locale: Locale): ReceiptLabels {
  return DICTS[locale].pos.receipt as unknown as ReceiptLabels;
}

/**
 * Checkout cart for an appointment: prefilled from the booked services, with
 * extra services, products and custom lines, line or cart discounts (with a
 * reason), a tip for a barber, and split payments with the remaining balance
 * shown large. Tax follows the shop setting (prices include tax). On success
 * it shows the numbered receipt, ready to send on WhatsApp.
 *
 * Pages keep their existing contract: the cart is staged for the appointment
 * and `onConfirm(method)` → usePos().markPaid() charges it atomically.
 */
export function CheckoutDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: CheckoutTarget | null;
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => Promise<PosResult>;
}) {
  const { t, locale } = useTranslation();
  const tp = t.pos;
  const open = !!target;
  const settings = useCheckoutSettings(open);
  const { loadAppointmentCart } = usePos({ toastErrors: false });
  const barbers = useWorkspaceStore((s) => s.barbers);

  const [saleId, setSaleId] = useState("");
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [cartDiscount, setCartDiscount] = useState<DraftDiscount | null>(null);
  const [tipAmount, setTipAmount] = useState("");
  const [tipBarber, setTipBarber] = useState<string>("");
  const [drafts, setDrafts] = useState<PaymentDraft[]>([]);
  const [allowPartial, setAllowPartial] = useState(false);
  const [applyRounding, setApplyRounding] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  // Reset for each appointment and prefill its lines.
  const [prevId, setPrevId] = useState<string | null>(null);
  if ((target?.id ?? null) !== prevId) {
    setPrevId(target?.id ?? null);
    setSaleId(newSaleId());
    setItems(null);
    setCartDiscount(null);
    setTipAmount("");
    setTipBarber(target?.barberId ?? "");
    setDrafts([]);
    setAllowPartial(false);
    setApplyRounding(true);
    setShowIssues(false);
    setReceipt(null);
  }

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const fallback: CartItem[] = [
      { key: cartKey("l"), kind: "custom", name: target.serviceName, quantity: 1, unitPrice: Number(target.amount) || 0 },
    ];
    loadAppointmentCart(target.id)
      .then((lines) => {
        if (cancelled) return;
        const next = lines && lines.length ? lines : fallback;
        setItems(next);
        const firstBarber = next.find((l) => l.barberId)?.barberId;
        if (firstBarber) setTipBarber((cur) => cur || firstBarber);
      })
      .catch(() => !cancelled && setItems(fallback));
    return () => {
      cancelled = true;
    };
  }, [target, loadAppointmentCart]);

  // First payment row: the first active method, following the balance.
  const s = settings.data;
  const methods = useMemo(() => s?.methods ?? [], [s]);
  useEffect(() => {
    if (open && methods.length && drafts.length === 0) {
      setDrafts([{ key: cartKey("p"), methodCode: methods[0].code, amount: "", auto: true }]);
    }
  }, [open, methods, drafts.length]);

  const currency = s?.currency ?? target?.currency ?? "JOD";
  const money = (amount: number, loc: Locale = locale) =>
    currency === "JOD" ? formatJOD(amount, loc) : `${amount.toFixed(3)} ${currency}`;

  const tipValue = parseMoneyInput(tipAmount);
  const baseCart: Omit<Cart, "payments"> = useMemo(
    () => ({
      saleId,
      appointmentId: target?.id ?? null,
      clientName: target?.clientName ?? null,
      items: items ?? [],
      cartDiscount: toSpec(cartDiscount),
      tips: tipValue && tipValue > 0 ? [{ key: "tip", barberId: tipBarber || null, amount: tipValue }] : [],
      allowPartial,
      applyCashRounding: applyRounding && (s?.cashRounding ?? 0) > 0,
    }),
    [saleId, target, items, cartDiscount, tipValue, tipBarber, allowPartial, applyRounding, s?.cashRounding],
  );

  const resolved = useMemo(
    () => (s ? resolvePaymentDrafts(baseCart, drafts, s) : null),
    [baseCart, drafts, s],
  );
  const totals = resolved?.totals ?? null;
  const cart: Cart | null = resolved ? { ...baseCart, payments: resolved.payments } : null;
  const issue = cart && totals ? validateCart(cart, totals) : "EMPTY";
  const invalidTip = tipValue === null;
  const invalidAmounts = (resolved?.invalidKeys.length ?? 0) > 0 || invalidTip;
  const tipNeedsBarber = !!(tipValue && tipValue > 0) && !tipBarber;
  const blocked = !!issue || invalidAmounts || tipNeedsBarber;

  const ready = !!s && items !== null;
  const loadFailed = !!settings.error && !s;

  function close() {
    if (busy) return;
    onClose();
  }

  async function charge() {
    if (!target || !cart || busy) return;
    if (blocked) {
      setShowIssues(true);
      return;
    }
    setBusy(true);
    try {
      stageCheckoutCart(target.id, cart);
      const first = cart.payments.find((p) => p.amount > 0)?.methodCode;
      const res = await onConfirm(first === "card" ? "card" : "cash");
      if (!res.ok) {
        clearStagedCart(target.id);
        return;
      }
      if (res.receipt) setReceipt(res.receipt);
      else onClose();
    } finally {
      setBusy(false);
    }
  }

  const updateItem = (key: string, patch: Partial<CartItem>) =>
    setItems((prev) => (prev ?? []).map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const issueText =
    invalidAmounts
      ? tp.invalidAmount
      : tipNeedsBarber
        ? tp.tipNeedsBarber
        : issue === "EMPTY"
          ? tp.issueEmpty
          : issue === "INVALID_LINE"
            ? tp.issueInvalidLine
            : issue === "PAYMENT_EXCEEDS_TOTAL"
              ? tp.issueOverpaid
              : issue === "PAYMENT_MISMATCH"
                ? tp.issueMismatch
                : null;

  const footer = receipt ? (
    <DialogFooter>
      <Button size="lg" className="w-full sm:w-auto" onClick={onClose} data-autofocus="">
        {tp.done}
      </Button>
    </DialogFooter>
  ) : (
    <DialogFooter>
      <Button variant="secondary" size="lg" onClick={close} disabled={busy}>
        {t.common.cancel}
      </Button>
      <Button
        size="lg"
        onClick={() => void charge()}
        disabled={!ready}
        loading={busy}
        aria-describedby={showIssues && issueText ? "checkout-issue" : undefined}
        className="tabular-nums"
      >
        {busy ? t.common.processing : totals ? interpolate(tp.charge, { amount: money(Math.min(totals.paidTotal, totals.total)) }) : t.dashboard.markPaid}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog
      open={open}
      onClose={receipt ? onClose : close}
      closeOnEscape={!busy}
      closeOnBackdrop={!busy && !receipt}
      size="lg"
      title={receipt ? tp.receiptTitle : t.dashboard.checkoutTitle}
      description={target ? `${target.clientName} · ${target.serviceName} · ${target.whenLabel}` : undefined}
      footer={footer}
    >
      {!target ? null : receipt ? (
        <ReceiptView receipt={receipt} phone={target.clientPhone ?? null} money={money} />
      ) : loadFailed ? (
        <EmptyState
          size="sm"
          tone="error"
          icon={AlertCircle}
          title={tp.loadFailed}
          action={{ label: t.common.retry, onClick: settings.refetch }}
        />
      ) : !ready || !totals || !s ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── Lines ── */}
          <section aria-labelledby="co-items" className="flex flex-col gap-2">
            <h3 id="co-items" className={sectionTitle}>
              {tp.items}
            </h3>
            {items!.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-muted">
                {tp.issueEmpty}
              </p>
            ) : (
              <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
                {items!.map((item) => (
                  <CartLineRow
                    key={item.key}
                    item={item}
                    lineTotal={totals.lines.find((l) => l.key === item.key)?.lineTotal ?? 0}
                    money={money}
                    disabled={busy}
                    onChange={(patch) => updateItem(item.key, patch)}
                    onRemove={() => setItems((prev) => (prev ?? []).filter((i) => i.key !== item.key))}
                  />
                ))}
              </ul>
            )}
            <AddItem settings={s} disabled={busy} onAdd={(item) => setItems((prev) => [...(prev ?? []), item])} />
          </section>

          {/* ── Cart discount + tip ── */}
          <section className="grid gap-3 sm:grid-cols-2">
            <DiscountEditor
              label={tp.cartDiscount}
              value={cartDiscount}
              onChange={setCartDiscount}
              disabled={busy}
              currencyLabel={currency === "JOD" ? (locale === "ar" ? "د.أ" : "JD") : currency}
            />
            <fieldset className={fieldsetCls} disabled={busy}>
              <legend className={legendCls}>{tp.tip}</legend>
              <div className="flex flex-wrap gap-2">
                {[0.5, 1, 2].map((v) => (
                  <FilterChip
                    key={v}
                    onClick={() => setTipAmount(String(v))}
                    pressed={tipValue === v}
                    className="h-11 tabular-nums"
                  >
                    {money(v)}
                  </FilterChip>
                ))}
              </div>
              <input
                inputMode="decimal"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="0.000"
                aria-label={tp.tipAmount}
                aria-invalid={invalidTip || undefined}
                className={cn(inputCls, "tabular-nums")}
                dir="ltr"
              />
              <select
                value={tipBarber}
                onChange={(e) => setTipBarber(e.target.value)}
                aria-label={tp.tipBarber}
                aria-invalid={(showIssues && tipNeedsBarber) || undefined}
                className={inputCls}
              >
                <option value="">{tp.tipBarber}</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || t.team.unnamed}
                  </option>
                ))}
              </select>
            </fieldset>
          </section>

          {/* ── Totals ── */}
          <dl className="m-0 flex flex-col gap-2 rounded-xl bg-sunken px-4 py-3.5 text-sm">
            <Row label={tp.subtotal} value={money(totals.subtotal)} />
            {totals.discountTotal > 0 && <Row label={tp.discount} value={`−${money(totals.discountTotal)}`} />}
            {s.isTaxRegistered && (
              <Row label={interpolate(tp.taxIncluded, { rate: String(totals.taxRate) })} value={money(totals.taxTotal)} muted />
            )}
            {totals.tipTotal > 0 && <Row label={tp.tip} value={money(totals.tipTotal)} />}
            {totals.roundingAdjustment !== 0 && <Row label={tp.rounding} value={money(totals.roundingAdjustment)} muted />}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <dt className="text-[15px] font-semibold text-ink">{tp.total}</dt>
              <dd className="m-0 text-lg font-bold tabular-nums text-ink">{money(totals.total)}</dd>
            </div>
          </dl>

          {/* ── Payments ── */}
          <PaymentsEditor
            methods={methods}
            drafts={drafts}
            resolvedAmounts={resolved!.payments.map((p) => p.amount)}
            invalidKeys={resolved!.invalidKeys}
            onChange={setDrafts}
            disabled={busy}
            balance={totals.balance}
            money={money}
          />

          {s.cashRounding > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={applyRounding}
                onChange={(e) => setApplyRounding(e.target.checked)}
                disabled={busy}
                className={checkboxClasses}
              />
              {interpolate(tp.cashRounding, { step: money(s.cashRounding) })}
            </label>
          )}
          {totals.balance > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={allowPartial}
                onChange={(e) => setAllowPartial(e.target.checked)}
                disabled={busy}
                className={checkboxClasses}
              />
              {tp.allowPartial}
            </label>
          )}

          {showIssues && issueText && (
            <p id="checkout-issue" role="alert" className="field-error m-0">
              {issueText}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-ink-muted" : "text-ink-soft"}>{label}</dt>
      <dd className={cn("m-0 tabular-nums", muted ? "text-ink-muted" : "text-ink")}>{value}</dd>
    </div>
  );
}

// ─── One cart line ───────────────────────────────────────────────────────────

function CartLineRow({
  item,
  lineTotal,
  money,
  disabled,
  onChange,
  onRemove,
}: {
  item: CartItem;
  lineTotal: number;
  money: (n: number) => string;
  disabled: boolean;
  onChange: (patch: Partial<CartItem>) => void;
  onRemove: () => void;
}) {
  const { t, locale } = useTranslation();
  const tp = t.pos;
  const [priceText, setPriceText] = useState(String(item.unitPrice));
  const [showDiscount, setShowDiscount] = useState(!!item.discount);
  const priceInvalid = parseMoneyInput(priceText) === null;
  const name = (locale === "ar" && item.nameAr) || item.name;
  const Icon = item.kind === "product" ? Package : item.kind === "custom" ? PenLine : Scissors;
  const discountDraft: DraftDiscount | null = item.discount
    ? { type: item.discount.type, value: String(item.discount.value), reason: item.discountReason ?? "" }
    : null;

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{name}</span>
        <span className="text-[15px] font-semibold tabular-nums text-ink">{money(lineTotal)}</span>
        <button type="button" className={iconBtn} onClick={onRemove} disabled={disabled} aria-label={interpolate(tp.removeItem, { name })}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-line-strong bg-card" role="group" aria-label={interpolate(tp.quantityFor, { name })}>
          <button
            type="button"
            className={iconBtn}
            disabled={disabled || item.quantity <= 1}
            onClick={() => onChange({ quantity: Math.max(1, item.quantity - 1) })}
            aria-label={tp.decrease}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="min-w-6 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            className={iconBtn}
            disabled={disabled || item.quantity >= 99}
            onClick={() => onChange({ quantity: Math.min(99, item.quantity + 1) })}
            aria-label={tp.increase}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <input
          inputMode="decimal"
          value={priceText}
          disabled={disabled}
          onChange={(e) => {
            setPriceText(e.target.value);
            const n = parseMoneyInput(e.target.value);
            if (n !== null) onChange({ unitPrice: n });
          }}
          aria-label={interpolate(tp.unitPriceFor, { name })}
          aria-invalid={priceInvalid || undefined}
          className={cn(inputCls, "w-28 tabular-nums")}
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => {
            if (showDiscount) onChange({ discount: null, discountReason: null });
            setShowDiscount((v) => !v);
          }}
          aria-expanded={showDiscount}
          disabled={disabled}
          className={quietAction}
        >
          <Tag aria-hidden="true" />
          {showDiscount ? tp.removeDiscount : tp.addDiscount}
        </button>
      </div>
      {showDiscount && (
        <DiscountEditor
          label={tp.lineDiscount}
          value={discountDraft ?? { type: "amount", value: "", reason: "" }}
          disabled={disabled}
          onChange={(d) => {
            const spec = toSpec(d);
            onChange({ discount: spec ? { type: spec.type, value: spec.value } : d ? { type: d.type, value: 0 } : null, discountReason: d?.reason || null });
          }}
          currencyLabel={locale === "ar" ? "د.أ" : "JD"}
          bare
        />
      )}
    </li>
  );
}

// ─── Discount editor (line or cart) ──────────────────────────────────────────

function DiscountEditor({
  label,
  value,
  onChange,
  disabled,
  currencyLabel,
  bare,
}: {
  label: string;
  value: DraftDiscount | null;
  onChange: (d: DraftDiscount | null) => void;
  disabled: boolean;
  currencyLabel: string;
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const tp = t.pos;
  const id = useId();
  const d = value ?? { type: "amount" as const, value: "", reason: "" };
  const [text, setText] = useState(d.value === "0" ? "" : d.value);
  const invalid = parseMoneyInput(text) === null || (d.type === "percent" && Number(parseMoneyInput(text)) > 100);
  const set = (patch: Partial<DraftDiscount>) => onChange({ ...d, value: text, ...patch });

  return (
    <fieldset className={cn("flex flex-col gap-2", !bare && fieldsetCls)} disabled={disabled}>
      <legend className={cn(legendCls, bare && "sr-only")}>{label}</legend>
      <div className="flex items-center gap-2">
        <SegmentedControl
          ariaLabel={tp.discountType}
          value={d.type}
          onChange={(type) => set({ type })}
          className="shrink-0"
          options={[
            { value: "amount", label: currencyLabel },
            { value: "percent", label: <Percent size={14} aria-hidden="true" />, ariaLabel: tp.percent },
          ]}
        />
        <input
          id={`${id}-v`}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ ...d, value: e.target.value });
          }}
          placeholder="0"
          aria-label={interpolate(tp.discountValueFor, { label })}
          aria-invalid={invalid || undefined}
          className={cn(inputCls, "tabular-nums")}
          dir="ltr"
        />
      </div>
      <input
        value={d.reason}
        maxLength={120}
        onChange={(e) => set({ reason: e.target.value })}
        placeholder={tp.discountReason}
        aria-label={tp.discountReason}
        className={inputCls}
      />
    </fieldset>
  );
}

// ─── Add a service, product or custom line ──────────────────────────────────

function AddItem({ settings, disabled, onAdd }: { settings: CheckoutSettings; disabled: boolean; onAdd: (item: CartItem) => void }) {
  const { t, locale } = useTranslation();
  const tp = t.pos;
  const [mode, setMode] = useState<AddMode>(null);
  const [pick, setPick] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const id = useId();

  const reset = () => {
    setMode(null);
    setPick("");
    setCustomName("");
    setCustomPrice("");
  };

  function add() {
    if (mode === "service") {
      const sv = settings.services.find((x) => x.id === pick);
      if (!sv) return;
      onAdd({ key: cartKey("l"), kind: "service", serviceId: sv.id, name: sv.name, nameAr: sv.nameAr, quantity: 1, unitPrice: sv.price });
    } else if (mode === "product") {
      const p = settings.products.find((x) => x.id === pick);
      if (!p) return;
      onAdd({ key: cartKey("l"), kind: "product", productId: p.id, name: p.nameEn, nameAr: p.nameAr, quantity: 1, unitPrice: p.price });
    } else if (mode === "custom") {
      const price = parseMoneyInput(customPrice);
      if (!customName.trim() || price === null) return;
      onAdd({ key: cartKey("l"), kind: "custom", name: customName.trim(), quantity: 1, unitPrice: price });
    }
    reset();
  }

  const options: { id: Exclude<AddMode, null>; label: string; icon: typeof Plus }[] = [
    { id: "service", label: tp.addService, icon: Scissors },
    { id: "product", label: tp.addProduct, icon: Package },
    { id: "custom", label: tp.addCustom, icon: PenLine },
  ];

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => setMode(o.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-card px-4 text-sm font-semibold text-ink-soft transition-colors duration-150 hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none",
              focusRing,
            )}
          >
            <Plus size={16} aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  const list =
    mode === "service"
      ? settings.services.map((x) => ({ id: x.id, label: (locale === "ar" && x.nameAr) || x.name, price: x.price }))
      : mode === "product"
        ? settings.products.map((x) => ({ id: x.id, label: (locale === "ar" && x.nameAr) || x.nameEn, price: x.price }))
        : [];
  const canAdd = mode === "custom" ? !!customName.trim() && parseMoneyInput(customPrice) !== null && customPrice !== "" : !!pick;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-sunken p-3">
      {mode === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <input
            id={`${id}-name`}
            value={customName}
            maxLength={80}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={tp.customName}
            aria-label={tp.customName}
            className={inputCls}
            data-autofocus=""
          />
          <input
            inputMode="decimal"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder="0.000"
            aria-label={tp.price}
            aria-invalid={parseMoneyInput(customPrice) === null || undefined}
            className={cn(inputCls, "tabular-nums")}
            dir="ltr"
          />
        </div>
      ) : list.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">{mode === "product" ? tp.noProducts : tp.noServices}</p>
      ) : (
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label={mode === "service" ? tp.chooseService : tp.chooseProduct}
          className={inputCls}
        >
          <option value="">{mode === "service" ? tp.chooseService : tp.chooseProduct}</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} · {formatJOD(o.price, locale)}
            </option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={reset}>
          {t.common.cancel}
        </Button>
        <Button variant="secondary" onClick={add} disabled={!canAdd} icon={<Plus aria-hidden="true" />}>
          {tp.add}
        </Button>
      </div>
    </div>
  );
}

// ─── Split payments ──────────────────────────────────────────────────────────

function PaymentsEditor({
  methods,
  drafts,
  resolvedAmounts,
  invalidKeys,
  onChange,
  disabled,
  balance,
  money,
}: {
  methods: PosPaymentMethod[];
  drafts: PaymentDraft[];
  resolvedAmounts: number[];
  invalidKeys: string[];
  onChange: (d: PaymentDraft[]) => void;
  disabled: boolean;
  balance: number;
  money: (n: number) => string;
}) {
  const { t, locale } = useTranslation();
  const tp = t.pos;
  const methodName = (m: PosPaymentMethod) =>
    (locale === "ar" ? m.nameAr : m.nameEn) || (m.code === "cash" ? t.dashboard.cash : m.code === "card" ? t.dashboard.card : m.code);
  const update = (key: string, patch: Partial<PaymentDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  function addSplit() {
    // Freeze the current rows at their shown amounts; the new row takes the rest.
    const frozen = drafts.map((d, i) => (d.auto ? { ...d, auto: false, amount: String(resolvedAmounts[i] ?? 0) } : d));
    const used = new Set(drafts.map((d) => d.methodCode));
    const next = methods.find((m) => !used.has(m.code)) ?? methods[0];
    onChange([...frozen, { key: cartKey("p"), methodCode: next.code, amount: "", auto: true }]);
  }

  const settled = Math.round(balance * 1000) === 0;
  const over = balance < 0;

  return (
    <section aria-labelledby="co-pay" className="flex flex-col gap-3">
      <h3 id="co-pay" className={sectionTitle}>
        {tp.payments}
      </h3>
      <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
        {drafts.map((d, i) => {
          const m = methods.find((x) => x.code === d.methodCode);
          return (
            <li key={d.key} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
              <div className="flex items-center gap-2">
                <select
                  value={d.methodCode}
                  onChange={(e) => update(d.key, { methodCode: e.target.value })}
                  disabled={disabled}
                  aria-label={interpolate(tp.methodFor, { n: String(i + 1) })}
                  className={inputCls}
                >
                  {methods.map((x) => (
                    <option key={x.code} value={x.code}>
                      {methodName(x)}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  value={d.auto ? String(resolvedAmounts[i] ?? "") : d.amount}
                  onChange={(e) => update(d.key, { amount: e.target.value, auto: false })}
                  disabled={disabled}
                  aria-label={interpolate(tp.amountFor, { n: String(i + 1) })}
                  aria-invalid={invalidKeys.includes(d.key) || undefined}
                  className={cn(inputCls, "w-32 shrink-0 tabular-nums")}
                  dir="ltr"
                />
                {drafts.length > 1 && (
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={disabled}
                    onClick={() => {
                      const rest = drafts.filter((x) => x.key !== d.key);
                      // Keep one row following the balance.
                      if (!rest.some((x) => x.auto)) rest[rest.length - 1] = { ...rest[rest.length - 1], auto: true, amount: "" };
                      onChange(rest);
                    }}
                    aria-label={interpolate(tp.removePayment, { n: String(i + 1) })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              {m?.kind === "cliq" && m.cliqAlias && (
                <p className="m-0 text-[13px] text-ink-muted">
                  {tp.cliqAlias}: <span dir="ltr" className="font-semibold text-ink">{m.cliqAlias}</span>
                </p>
              )}
              {m && m.kind !== "cash" && (
                <input
                  value={d.reference ?? ""}
                  maxLength={80}
                  onChange={(e) => update(d.key, { reference: e.target.value || null })}
                  disabled={disabled}
                  placeholder={tp.reference}
                  aria-label={interpolate(tp.referenceFor, { n: String(i + 1) })}
                  className={inputCls}
                  dir="ltr"
                />
              )}
            </li>
          );
        })}
      </ul>
      {methods.length > 0 && drafts.length < 6 && (
        <button
          type="button"
          onClick={addSplit}
          disabled={disabled}
          className={cn(quietAction, "-ms-3 w-fit")}
        >
          <Plus aria-hidden="true" />
          {tp.splitPayment}
        </button>
      )}

      <div
        aria-live="polite"
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors duration-200 motion-reduce:transition-none",
          settled ? "bg-success-soft text-success-text" : over ? "bg-danger-soft text-danger-text" : "bg-sunken text-ink-soft",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {settled ? <CheckCircle2 size={18} aria-hidden="true" /> : over ? <AlertCircle size={18} aria-hidden="true" /> : null}
          {settled ? tp.fullyPaid : over ? tp.overpaid : tp.remaining}
        </span>
        <span className="text-stat tabular-nums">{money(Math.abs(balance))}</span>
      </div>
    </section>
  );
}

// ─── Receipt (after a successful sale) ───────────────────────────────────────

function ReceiptView({ receipt, phone, money }: { receipt: SaleReceipt; phone: string | null; money: (n: number, loc?: Locale) => string }) {
  const { t, locale, formatDate } = useTranslation();
  const tp = t.pos;
  const [lang, setLang] = useState<Locale>(locale);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const shopId = useWorkspaceStore((s) => s.shopId);

  const text = useMemo(
    () =>
      buildReceiptText(receipt, {
        locale: lang,
        labels: receiptLabels(lang),
        money: (n) => money(n, lang),
        date: (iso) =>
          new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: receipt.shop.timezone || "Asia/Amman",
          }).format(new Date(iso)),
      }),
    [receipt, lang, money],
  );

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const res = await enqueueMessage({ shopId, to: phone, template: "receipt", body: text, locale: lang, saleId: receipt.saleId });
      if (res.status === "queued") toast.success(tp.receiptQueued);
      else {
        const link = res.status === "fallback" ? res.waLink : buildWaLink(null, text);
        window.open(link, "_blank", "noopener,noreferrer");
      }
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(tp.receiptCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tp.copyFailed);
    }
  }

  const when = receipt.completedAt ?? receipt.createdAt;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-sunken px-4 py-6 text-center">
        <span aria-hidden="true" className="mb-1 grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 size={28} />
        </span>
        <p className="m-0 text-sm font-semibold text-ink-soft">
          {receipt.status === "part_paid" ? tp.partPaid : tp.paid}
        </p>
        <p className="text-stat m-0 text-ink">{money(receipt.total)}</p>
        {receipt.receiptNumber && (
          <p className="m-0 text-sm text-ink-soft">
            {tp.receiptNo} <span dir="ltr" className="font-semibold text-ink">{receipt.receiptNumber}</span>
          </p>
        )}
        {when && <p className="text-meta m-0 text-ink-muted">{formatDate(when, { dateStyle: "medium", timeStyle: "short" })}</p>}
        {receipt.balance > 0 && (
          <p className="m-0 text-sm font-semibold text-danger-text">
            {tp.remaining}: {money(receipt.balance)}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{tp.receiptLanguage}</span>
        <SegmentedControl
          ariaLabel={tp.receiptLanguage}
          value={lang}
          onChange={setLang}
          options={(["ar", "en"] as const).map((l) => ({
            value: l,
            label: <span lang={l}>{l === "ar" ? "العربية" : "English"}</span>,
          }))}
        />
      </div>

      <pre
        dir={lang === "ar" ? "rtl" : "ltr"}
        lang={lang}
        className="m-0 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-card p-4 text-[13px] leading-relaxed text-ink"
        style={{ fontFamily: "inherit" }}
      >
        {text}
      </pre>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => void send()} loading={sending} icon={<MessageCircle aria-hidden="true" />}>
          {phone ? tp.sendWhatsapp : tp.shareWhatsapp}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void copy()}
          icon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        >
          {copied ? tp.copied : tp.copyReceipt}
        </Button>
      </div>
    </div>
  );
}
