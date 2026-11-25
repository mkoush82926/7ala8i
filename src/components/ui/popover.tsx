"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small anchored disclosure panel (view options, row kebab menus).
 *
 *   <Popover
 *     label="View options"
 *     trigger={(p) => <Button {...p} variant="secondary" size="sm" icon={<SlidersHorizontal />}>View</Button>}
 *   >
 *     {(close) => <div>…</div>}
 *   </Popover>
 *
 * The trigger receives aria-expanded / aria-controls / onClick / ref. The
 * panel closes on Escape (focus returns to the trigger) and on an outside
 * pointer-down. `align="end"` anchors the panel to the trigger's inline end.
 */
export interface PopoverTriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog" | "menu";
  onClick: () => void;
}

export interface PopoverProps {
  /** Accessible name for the panel. */
  label: string;
  trigger: (props: PopoverTriggerProps) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  /** "menu" for action lists (kebab), "dialog" for option panels. */
  kind?: "dialog" | "menu";
  className?: string;
  panelClassName?: string;
}

export function Popover({ label, trigger, children, align = "end", kind = "dialog", className, panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({
        ref: triggerRef,
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": kind,
        onClick: () => setOpen((o) => !o),
      })}
      {open && (
        <div
          id={id}
          role={kind === "menu" ? "menu" : "dialog"}
          aria-label={label}
          className={cn(
            "absolute top-full z-40 mt-2 min-w-56 rounded-xl border border-line bg-card p-2 shadow-float",
            align === "end" ? "end-0" : "start-0",
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Row inside a `kind="menu"` Popover. */
export function PopoverMenuItem({
  icon,
  children,
  onClick,
  tone = "default",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-medium transition-colors duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "danger" ? "text-danger-text" : "text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
