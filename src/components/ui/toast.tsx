"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertCircle, Info, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

/* ═══════════════════════════════════════════════════════════════════════════
   Toasts
   - toast("success" | "error" | "info", message, { duration?, action?, id? })
     or toast.success(msg) / toast.error(msg) / toast.info(msg); returns the id
   - Screen readers: two always-mounted live regions (polite for success/info,
     assertive for errors) announce each message once; the visual stack is a
     labelled region with no live role, so nothing is read twice.
   - Auto-dismiss pauses while hovered or focused; errors stay longer.
   - Only one <ToastContainer/> renders at a time, so it is safe to mount it
     in both the root ThemeProvider and a layout.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** ms before auto-dismiss. Default 4000 (6000 for errors or with an action). 0 = sticky. */
  duration?: number;
  /** Optional inline action, e.g. { label: t.common.undo, onClick: restore } */
  action?: ToastAction;
  /** Re-use an id to replace an existing toast instead of stacking a new one. */
  id?: string;
}

export interface ToastRecord {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

const MAX_VISIBLE = 4;

let toastListeners: (() => void)[] = [];
let toasts: ToastRecord[] = [];
let announcement = { polite: "", assertive: "", seq: 0 };

function notifyListeners() {
  toastListeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  toastListeners.push(fn);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== fn);
  };
}

export function dismissToast(id: string) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) notifyListeners();
}

/** Remove every toast (e.g. on sign-out). */
export function clearToasts() {
  toasts = [];
  notifyListeners();
}

function showToast(type: ToastType, message: string, options: ToastOptions = {}): string {
  const id = options.id ?? Math.random().toString(36).slice(2);
  const duration =
    options.duration ?? (type === "error" || options.action ? 6000 : 4000);
  const record: ToastRecord = { id, type, message, duration, action: options.action };
  const existing = toasts.findIndex((t) => t.id === id);
  if (existing !== -1) {
    toasts = toasts.map((t, i) => (i === existing ? record : t));
  } else {
    toasts = [...toasts, record].slice(-MAX_VISIBLE);
  }
  announcement = {
    polite: type === "error" ? "" : message,
    assertive: type === "error" ? message : "",
    seq: announcement.seq + 1,
  };
  notifyListeners();
  return id;
}

type ToastFn = ((type: ToastType, message: string, options?: ToastOptions) => string) & {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
};

export const toast: ToastFn = Object.assign(
  (type: ToastType, message: string, options?: ToastOptions) => showToast(type, message, options),
  {
    success: (message: string, options?: ToastOptions) => showToast("success", message, options),
    error: (message: string, options?: ToastOptions) => showToast("error", message, options),
    info: (message: string, options?: ToastOptions) => showToast("info", message, options),
    dismiss: dismissToast,
  },
);

/** Test helper / debugging: current toasts. */
export function getToasts(): readonly ToastRecord[] {
  return toasts;
}

// v2 (§5.15): toasts sit on the inverse (ink) surface; icon colours use the
// on-inverse tokens so they stay AA in both themes.
const iconColors: Record<ToastType, string> = {
  success: "text-on-inverse-brand",
  error: "text-on-inverse-danger",
  info: "text-on-inverse/80",
};

function ToastItem({ toast: item, closeLabel }: { toast: ToastRecord; closeLabel: string }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    remaining.current = item.duration;
  }, [item]);

  useEffect(() => {
    if (paused || item.duration <= 0) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item]);

  const Icon = item.type === "error" ? AlertCircle : Info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.18, ease: [0.3, 0, 0.8, 0.15] } }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      data-type={item.type}
      className={cn(
        "pointer-events-auto flex w-[min(420px,calc(100vw-32px))] items-start gap-3 rounded-xl px-4 py-3",
        "bg-inverse text-on-inverse text-sm shadow-float",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {item.type === "success" ? (
          <svg width="20" height="20" viewBox="0 0 20 20" className={iconColors.success}>
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
          <Icon size={20} className={iconColors[item.type]} />
        )}
      </span>
      <p className="min-w-0 flex-1 pt-px leading-5 break-words">
        {item.message}
      </p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismissToast(item.id);
          }}
          className="-my-1 h-8 shrink-0 cursor-pointer rounded-full px-2.5 text-sm font-semibold text-on-inverse-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-inverse-brand"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label={closeLabel}
        className="-my-1 -me-2 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-inverse/70 transition-colors hover:bg-on-inverse/10 hover:text-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-inverse-brand motion-reduce:transition-none"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ── Single active container ───────────────────────────────────────────────
let containers: symbol[] = [];
let containerListeners: (() => void)[] = [];
function notifyContainers() {
  containerListeners.forEach((fn) => fn());
}

function useIsActiveContainer() {
  const [token] = useState(() => Symbol("toast-container"));
  useEffect(() => {
    containers = [...containers, token];
    notifyContainers();
    return () => {
      containers = containers.filter((c) => c !== token);
      notifyContainers();
    };
  }, [token]);
  return useSyncExternalStore(
    (fn) => {
      containerListeners.push(fn);
      return () => {
        containerListeners = containerListeners.filter((l) => l !== fn);
      };
    },
    () => containers[0] === token,
    () => false,
  );
}

export function ToastContainer() {
  const { t } = useTranslation();
  const isActive = useIsActiveContainer();
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
  const live = useSyncExternalStore(
    subscribe,
    () => announcement,
    () => announcement,
  );

  // Clear the live regions shortly after announcing so the same message can
  // be announced again later.
  const clear = useCallback(() => {
    announcement = { polite: "", assertive: "", seq: announcement.seq };
    notifyListeners();
  }, []);
  useEffect(() => {
    if (!live.polite && !live.assertive) return;
    const timer = setTimeout(clear, 1500);
    return () => clearTimeout(timer);
  }, [live, clear]);

  if (!isActive) return null;

  return (
    <>
      {/* Screen-reader announcements — always mounted */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {live.polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {live.assertive}
      </div>

      {/* Visual stack */}
      <section
        aria-label={t.common.notifications}
        className={cn(
          "pointer-events-none fixed z-[120] flex flex-col items-center gap-2",
          // Bottom-centre on phones, lifted above a sticky bottom bar
          // (--toast-offset, set via :has([data-sticky-bar])); bottom-end on desktop.
          "inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--toast-offset,0px))]",
          "sm:inset-x-0 sm:mx-auto sm:w-fit",
          "lg:inset-x-auto lg:end-6 lg:bottom-6 lg:mx-0 lg:items-end",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((item) => (
            <ToastItem key={item.id} toast={item} closeLabel={t.common.dismiss} />
          ))}
        </AnimatePresence>
      </section>
    </>
  );
}
