"use client";

import React from "react";
import { Banknote, CreditCard, Loader2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { PaymentMethod, PosResult } from "@/hooks/use-pos";

export interface CheckoutTarget {
  id: string;
  clientName: string;
  serviceName: string;
  amount: number;
  currency: string;
  /** Pre-formatted time/date label for the summary line. */
  whenLabel: string;
}

/**
 * Payment method picker shown before an appointment is marked paid. The
 * dialog closes only when `onConfirm` resolves `{ ok: true }`; on failure the
 * hook has already toasted the error and the dialog stays open for a retry.
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
  const { t, formatCurrency } = useTranslation();
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [busy, setBusy] = React.useState(false);

  // Reset to cash each time a new appointment is opened.
  const [prevId, setPrevId] = React.useState<string | null>(null);
  if ((target?.id ?? null) !== prevId) {
    setPrevId(target?.id ?? null);
    setMethod("cash");
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await onConfirm(method);
      if (res.ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  const options: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
    { id: "cash", label: t.dashboard.cash, icon: Banknote },
    { id: "card", label: t.dashboard.card, icon: CreditCard },
  ];

  return (
    <Dialog
      open={!!target}
      onClose={() => {
        if (!busy) onClose();
      }}
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      size="sm"
      title={t.dashboard.checkoutTitle}
      description={target ? `${target.clientName} · ${target.serviceName} · ${target.whenLabel}` : undefined}
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {busy ? t.common.processing : t.dashboard.markPaid}
          </button>
        </DialogFooter>
      }
    >
      {target && (
        <div className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between gap-3 rounded-xl bg-[var(--bg-secondary)] px-4 py-3">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{t.dashboard.amountDue}</span>
            <span className="text-[20px] font-extrabold tabular-nums text-[var(--text-primary)]">
              {formatCurrency(target.amount, target.currency)}
            </span>
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-[var(--text-secondary)]">
              {t.dashboard.paymentMethod}
            </legend>
            <div role="radiogroup" aria-label={t.dashboard.paymentMethod} className="grid grid-cols-2 gap-3">
              {options.map((opt) => {
                const selected = method === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-autofocus={selected ? "" : undefined}
                    disabled={busy}
                    onClick={() => setMethod(opt.id)}
                    onKeyDown={(e) => {
                      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                        e.preventDefault();
                        const next: PaymentMethod = opt.id === "cash" ? "card" : "cash";
                        setMethod(next);
                        e.currentTarget.parentElement
                          ?.querySelector<HTMLElement>(`[data-method="${next}"]`)
                          ?.focus();
                      }
                    }}
                    data-method={opt.id}
                    tabIndex={selected ? 0 : -1}
                    className={cn(
                      "flex min-h-14 items-center justify-center gap-2 rounded-xl border text-[14px] font-bold transition-colors",
                      selected
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]",
                    )}
                  >
                    <opt.icon size={18} aria-hidden="true" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
    </Dialog>
  );
}
