"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { Dialog, DialogFooter } from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Runs on confirm. The dialog closes only when it resolves; if it throws
   * (or rejects) the dialog stays open and shows `errorMessage` (or the
   * thrown Error's message, or a generic translated message).
   */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  /** Defaults to t.common.confirm */
  confirmLabel?: string;
  /** Defaults to t.common.cancel */
  cancelLabel?: string;
  /** Red confirm button + warning icon; Cancel gets initial focus. */
  destructive?: boolean;
  /** Alias of `destructive` for variant-style call sites. */
  variant?: "default" | "destructive";
  /** Externally-controlled busy state (in addition to the internal one). */
  loading?: boolean;
  /** Shown when onConfirm throws; defaults to the thrown message / t.error.message. */
  errorMessage?: string;
  /** Optional extra content between the description and the actions. */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  variant,
  loading: externalLoading = false,
  errorMessage,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isDestructive = destructive || variant === "destructive";
  const busy = pending || externalLoading;

  const handleClose = () => {
    if (busy) return; // don't drop an in-flight action
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (busy) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setPending(false);
      onClose();
    } catch (err) {
      setPending(false);
      setError(
        errorMessage ??
          (err instanceof Error && err.message ? err.message : t.error.message),
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      role="alertdialog"
      size="sm"
      title={
        <span className="flex items-start gap-3">
          {isDestructive && (
            <span
              aria-hidden="true"
              className="mt-[-2px] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-cards)] bg-[var(--accent-rose-muted)]"
            >
              <AlertTriangle size={18} className="text-[var(--accent-rose)]" />
            </span>
          )}
          <span className="pt-1">{title}</span>
        </span>
      }
      description={description}
      initialFocusRef={isDestructive ? cancelRef : confirmRef}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      hideCloseButton
      bodyClassName={!children && !error ? "hidden" : undefined}
      footer={
        <DialogFooter>
          <button
            ref={cancelRef}
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="btn btn-secondary text-[14px]"
          >
            {cancelLabel ?? t.common.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className={cn("btn text-[14px]", isDestructive ? "btn-destructive" : "btn-primary")}
          >
            {busy && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
              />
            )}
            <span>{busy ? t.common.processing : (confirmLabel ?? t.common.confirm)}</span>
          </button>
        </DialogFooter>
      }
    >
      {children}
      {error && (
        <p
          role="alert"
          className="mt-1 rounded-[var(--radius-inputs)] bg-[var(--accent-rose-muted)] px-3 py-2 text-[13px] text-[var(--accent-rose)]"
        >
          {error}
        </p>
      )}
    </Dialog>
  );
}
