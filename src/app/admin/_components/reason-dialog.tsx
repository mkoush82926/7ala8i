"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { REASON_MAX, REASON_MIN, checkReason } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Reason required (default) or optional. */
  required?: boolean;
  minLength?: number;
  successMessage: string;
  /** Runs the audited action; the dialog handles pending, errors and toasts. */
  onSubmit: (reason: string) => Promise<ActionResult>;
  onDone?: () => void;
  /** Extra fields rendered above the reason (e.g. a decision picker). */
  children?: React.ReactNode;
  /** Disables submit when extra fields are invalid. */
  canSubmit?: boolean;
}

/**
 * Confirmation dialog for every back-office write: asks for the reason that
 * goes into admin_audit_log, shows inline errors and toasts the outcome.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive = false,
  required = true,
  minLength = REASON_MIN,
  successMessage,
  onSubmit,
  onDone,
  children,
  canSubmit = true,
}: ReasonDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const c = ADMIN_COPY.common;

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const close = () => {
    if (!pending) onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !canSubmit) return;
    const check = checkReason(reason, { required, min: minLength });
    if (!check.ok) {
      setError(check.error === "required" ? c.reasonHint(minLength) : ADMIN_COPY.errors.INVALID_INPUT);
      textareaRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await onSubmit(check.value);
      if (res.ok) {
        toast.success(successMessage);
        onClose();
        onDone?.();
        router.refresh();
      } else {
        setError(res.message);
        toast.error(res.message);
      }
    } catch {
      setError(ADMIN_COPY.errors.NETWORK);
      toast.error(ADMIN_COPY.errors.NETWORK);
    } finally {
      setPending(false);
    }
  };

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const left = REASON_MAX - reason.length;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      role={destructive ? "alertdialog" : "dialog"}
      initialFocusRef={textareaRef}
      closeOnBackdrop={!pending}
      size="md"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {children}
        <div>
          <label htmlFor={`${id}-reason`} className="mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]">
            {c.reason}
          </label>
          <textarea
            id={`${id}-reason`}
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REASON_MAX}
            rows={3}
            required={required}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={cn(hintId, error && errorId)}
            placeholder={c.reasonPlaceholder}
            className="w-full resize-y rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] aria-[invalid=true]:border-[var(--accent-rose)]"
          />
          <div className="mt-1 flex justify-between gap-3 text-[12px] text-[var(--text-muted)]">
            <span id={hintId}>{required ? c.reasonHint(minLength) : c.reasonOptionalHint}</span>
            {left < 100 && <span aria-live="polite">{c.charsLeft(left)}</span>}
          </div>
          {error && (
            <p id={errorId} role="alert" className="mt-2 text-[13px] font-medium text-[var(--accent-rose)]">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <button type="button" onClick={close} disabled={pending} className="btn btn-secondary">
            {c.cancel}
          </button>
          <button
            type="submit"
            disabled={pending || !canSubmit}
            aria-busy={pending}
            className={cn("btn", destructive ? "btn-destructive" : "btn-primary")}
          >
            {pending ? c.saving : confirmLabel}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
