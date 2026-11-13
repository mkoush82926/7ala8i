"use client";

import React, { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

/* ═══════════════════════════════════════════════════════════════════════════
   Accessible Dialog / Drawer primitive
   - role="dialog" | "alertdialog", aria-modal, aria-labelledby/-describedby
   - Escape closes (only the top-most dialog when nested)
   - Tab / Shift+Tab are trapped inside the panel
   - Initial focus: initialFocusRef → [data-autofocus] → first focusable → panel
   - Focus returns to the element that was focused before opening
   - Body scroll is locked while any dialog is open (ref-counted)
   - Rendered in a portal on document.body; RTL-aware drawer sides
   - Motion respects prefers-reduced-motion via <MotionConfig> in ThemeProvider
   ═══════════════════════════════════════════════════════════════════════════ */

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true" && el.tabIndex !== -1,
  );
}

// ── Module-level stacks so nested dialogs behave ─────────────────────────────
const dialogStack: symbol[] = [];
let scrollLockCount = 0;
let savedBodyStyle: { overflow: string; paddingInlineEnd: string } | null = null;

function lockScroll() {
  if (typeof document === "undefined") return;
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;
  const body = document.body;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  savedBodyStyle = { overflow: body.style.overflow, paddingInlineEnd: body.style.paddingInlineEnd };
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;
}

function unlockScroll() {
  if (typeof document === "undefined") return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0 || !savedBodyStyle) return;
  document.body.style.overflow = savedBodyStyle.overflow;
  document.body.style.paddingInlineEnd = savedBodyStyle.paddingInlineEnd;
  savedBodyStyle = null;
}

export interface ModalBehaviorOptions {
  open: boolean;
  onClose: () => void;
  /** The dialog panel — focus is trapped inside it. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Element to focus on open (defaults to [data-autofocus] or first focusable). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
  /** Lock body scroll while open (default true). */
  lockScroll?: boolean;
  /** Return focus to the previously-focused element on close (default true). */
  restoreFocus?: boolean;
}

/**
 * The behaviour half of <Dialog/>, for custom overlays that keep their own
 * markup (mobile nav drawer, bottom sheets, popovers that act as dialogs).
 * Pair it with role="dialog" aria-modal="true" aria-labelledby on the panel.
 */
export function useModalBehavior({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  closeOnEscape = true,
  lockScroll: shouldLock = true,
  restoreFocus = true,
}: ModalBehaviorOptions) {
  const onCloseRef = useRef(onClose);
  const escapeRef = useRef(closeOnEscape);
  useEffect(() => {
    onCloseRef.current = onClose;
    escapeRef.current = closeOnEscape;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    if (shouldLock) lockScroll();

    // Focus after the panel has mounted (portal + animation frame)
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target =
        initialFocusRef?.current ??
        container.querySelector<HTMLElement>("[data-autofocus]") ??
        getFocusable(container)[0] ??
        container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      const container = containerRef.current;
      if (e.key === "Escape") {
        if (!escapeRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !container) return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      const i = dialogStack.indexOf(token);
      if (i !== -1) dialogStack.splice(i, 1);
      if (shouldLock) unlockScroll();
      if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // containerRef/initialFocusRef are refs: stable by contract
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shouldLock, restoreFocus]);
}

// SSR-safe "are we on the client" without a setState-in-effect
const subscribeNoop = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";
export type DrawerSide = "start" | "end" | "bottom";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; wired to aria-labelledby. */
  title?: React.ReactNode;
  /** Supporting text under the title; wired to aria-describedby. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Action row, rendered sticky at the bottom of the panel. */
  footer?: React.ReactNode;
  /** Panel width. Modal: sm 400 · md 520 · lg 680 · xl 880. Drawer: sm 360 · md 440 · lg 560 · xl 720. */
  size?: DialogSize;
  /** "modal" (centered; bottom sheet under 640px) or "drawer" (edge panel). */
  variant?: "modal" | "drawer";
  /** Drawer edge. "end" = right in LTR / left in RTL. Default "end". */
  side?: DrawerSide;
  /** Use "alertdialog" for confirmations that interrupt the user. */
  role?: "dialog" | "alertdialog";
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
  /** Close on Escape (default true). */
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  /** Extra classes for the panel. */
  className?: string;
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
  /** Extra classes for the header (title + description). */
  headerClassName?: string;
}

const MODAL_WIDTH: Record<DialogSize, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[680px]",
  xl: "sm:max-w-[880px]",
  full: "sm:max-w-[calc(100vw-2rem)]",
};

const DRAWER_WIDTH: Record<DialogSize, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[440px]",
  lg: "max-w-[560px]",
  xl: "max-w-[720px]",
  full: "max-w-full",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "modal",
  side = "end",
  role = "dialog",
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
  ariaLabel,
  className,
  bodyClassName,
  headerClassName,
}: DialogProps) {
  const { t, isRTL, dir } = useTranslation();
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useModalBehavior({ open, onClose, containerRef: panelRef, initialFocusRef, closeOnEscape });

  if (!isClient) return null;

  const isDrawer = variant === "drawer";
  // Physical edge for the drawer (logical "end" flips in RTL)
  const physical: "left" | "right" | "bottom" =
    side === "bottom" ? "bottom" : (side === "end") !== isRTL ? "right" : "left";
  const hidden =
    physical === "bottom" ? { y: "100%" } : physical === "right" ? { x: "100%" } : { x: "-100%" };

  const panelMotion = isDrawer
    ? { initial: hidden, animate: { x: 0, y: 0 }, exit: hidden }
    : {
        initial: { opacity: 0, y: 16, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.98 },
      };

  const hasHeader = Boolean(title || description);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]" dir={dir}>
          {/* Backdrop */}
          <motion.div
            aria-hidden="true"
            data-testid="dialog-backdrop"
            className="absolute inset-0 bg-[var(--overlay)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Positioner */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex",
              isDrawer
                ? physical === "bottom"
                  ? "items-end justify-center"
                  : physical === "right"
                    ? "justify-end"
                    : "justify-start"
                : "items-end justify-center sm:items-center sm:p-4",
            )}
          >
            <motion.div
              ref={panelRef}
              role={role}
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              aria-label={!title ? ariaLabel : undefined}
              tabIndex={-1}
              {...panelMotion}
              transition={
                isDrawer
                  ? { type: "tween", duration: 0.28, ease: [0.25, 1, 0.5, 1] }
                  : { duration: 0.2, ease: [0.25, 1, 0.5, 1] }
              }
              className={cn(
                "pointer-events-auto relative flex flex-col outline-none",
                "bg-[var(--bg-elevated)] text-[var(--text-primary)]",
                "border border-[var(--border-subtle)]",
                isDrawer
                  ? physical === "bottom"
                    ? "w-full max-h-[90dvh] rounded-t-[var(--radius-lg)] pb-[env(safe-area-inset-bottom)]"
                    : cn("h-full w-full", DRAWER_WIDTH[size])
                  : cn(
                      "w-full max-h-[92dvh] rounded-t-[var(--radius-lg)] pb-[env(safe-area-inset-bottom)]",
                      "sm:max-h-[calc(100dvh-2rem)] sm:rounded-[var(--radius-lg)] sm:pb-0",
                      MODAL_WIDTH[size],
                    ),
                className,
              )}
            >
              {hasHeader && (
                <div className={cn("shrink-0 px-6 pt-6 pb-2", !hideCloseButton && "pe-14", headerClassName)}>
                  {title && (
                    <h2 id={titleId} className="text-[17px] font-semibold leading-snug text-[var(--text-primary)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <div id={descId} className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                      {description}
                    </div>
                  )}
                </div>
              )}

              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.common.close}
                  className={cn(
                    "absolute top-3 end-3 inline-flex h-10 w-10 items-center justify-center",
                    "rounded-[var(--radius-buttons)] text-[var(--text-secondary)] cursor-pointer",
                    "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors",
                  )}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6",
                  hasHeader ? "pt-3" : "pt-6",
                  footer ? "pb-4" : "pb-6",
                  bodyClassName,
                )}
              >
                {children}
              </div>

              {footer && (
                <div className="shrink-0 border-t border-[var(--border-subtle)] px-6 py-4">{footer}</div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Edge panel (defaults: side "end", size "md"). Same props as <Dialog/>. */
export function Drawer(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="drawer" />;
}

/** Standard action row: stacked full-width on phones, end-aligned row from 640px. */
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
