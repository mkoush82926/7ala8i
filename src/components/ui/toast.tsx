"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

let toastListeners: (() => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((fn) => fn());
}

export function toast(type: ToastType, message: string) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, type, message }];
  notifyListeners();

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 4000);
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const iconColors = {
  success: "text-[var(--accent-mint)]",
  error: "text-[var(--accent-rose)]",
  info: "text-[var(--accent-blue)]",
};

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = icons[t.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]",
        "bg-[var(--glass-bg-elevated)] backdrop-blur-[20px]",
        "border border-[var(--border-primary)]",
        "shadow-[var(--shadow-lg)]",
        "min-w-[300px] max-w-[450px]",
      )}
    >
      {t.type === "success" ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          className={iconColors[t.type]}
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6 10 L9 13 L14 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="toast-checkmark"
          />
        </svg>
      ) : (
        <Icon size={18} className={iconColors[t.type]} />
      )}
      <span className="text-[13px] text-[var(--text-primary)] font-light flex-1">
        {t.message}
      </span>
      <button
        onClick={onDismiss}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const [, setRefresh] = useState(0);

  useEffect(() => {
    const refresh = () => setRefresh((n) => n + 1);
    toastListeners.push(refresh);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== refresh);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => handleDismiss(t.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
