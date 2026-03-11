"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-0 flex items-center justify-center z-[101] p-4"
          >
            <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl p-6">
              {/* Icon */}
              {destructive && (
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-rose-muted)] flex items-center justify-center mb-4">
                  <AlertTriangle size={18} className="text-[var(--accent-rose)]" />
                </div>
              )}

              {/* Content */}
              <h3 className="text-[15px] text-[var(--text-primary)] font-medium mb-1">
                {title}
              </h3>
              {description && (
                <p className="text-[13px] text-[var(--text-tertiary)] font-light mb-6 leading-relaxed">
                  {description}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="h-9 px-4 rounded-[var(--radius-md)] text-[13px] text-[var(--text-secondary)] font-light border border-[var(--border-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`h-9 px-5 rounded-[var(--radius-md)] text-[13px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    destructive
                      ? "bg-[var(--accent-rose)] text-white hover:opacity-90"
                      : "bg-[var(--accent-mint)] text-[#0A0A0A] hover:opacity-90"
                  }`}
                >
                  {loading && (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
