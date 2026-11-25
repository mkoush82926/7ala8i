"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalendarPlus, Footprints, Lock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

export type CreateKind = "appointment" | "walk_in" | "block";

interface SlotPopoverProps {
  open: boolean;
  x: number;
  y: number;
  title: string;
  onPick: (kind: CreateKind) => void;
  onClose: () => void;
}

function useCreateItems() {
  const { t } = useTranslation();
  return [
    { kind: "appointment" as const, label: t.calendar.createAppointment, icon: CalendarPlus },
    { kind: "walk_in" as const, label: t.calendar.walkInNow, icon: Footprints },
    { kind: "block" as const, label: t.calendar.blockTime, icon: Lock },
  ];
}

/** Menu shown where an empty slot was clicked: Appointment / Walk-in now / Block time. */
export function SlotPopover({ open, x, y, title, onPick, onClose }: SlotPopoverProps) {
  const items = useCreateItems();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 160;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp to the viewport after measuring
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    });
    el?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = Array.from(el?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, x, y, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      className="fixed z-[60] w-[248px] rounded-2xl border border-line bg-card p-1.5 shadow-float"
      style={{ left: pos.left, top: pos.top }}
    >
      <p className="truncate px-3 pb-1.5 pt-2 text-xs font-semibold tabular-nums text-ink-muted">{title}</p>
      {items.map(({ kind, label, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          role="menuitem"
          onClick={() => onPick(kind)}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-start text-sm font-medium text-ink transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
            <Icon size={16} />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Floating action button (thumb reach on mobile) with the same three actions. */
export function CreateFab({ onPick }: { onPick: (kind: CreateKind) => void }) {
  const { t } = useTranslation();
  const items = useCreateItems();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] end-4 z-40 flex flex-col items-end gap-2 lg:hidden">
      {open && (
        <div role="menu" aria-label={t.calendar.create} className="flex flex-col items-end gap-2">
          {items.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(kind);
              }}
              className="flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-raised transition-colors duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
            >
              <Icon size={16} aria-hidden="true" className="text-brand-text" />
              {label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? t.common.close : t.calendar.create}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-float transition-[background-color,transform] duration-200 ease-standard hover:bg-brand-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none motion-reduce:active:scale-100",
          open && "bg-inverse text-on-inverse hover:bg-ink-soft",
        )}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}
      </button>
    </div>
  );
}
