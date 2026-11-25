"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { saveCalendarTeam } from "@/lib/queries/appointments";
import { BARBER_PALETTE, moveItem, type TeamMode } from "./calendar-model";
import { LaneAvatar } from "./time-grid";
import { errorText } from "./error-text";

export interface TeamDialogMember {
  id: string;
  name: string;
  avatar?: string | null;
  color: string;
}

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  /** Members in the current display order. */
  members: TeamDialogMember[];
  mode: TeamMode;
  custom: string[];
  isAdmin: boolean;
  /** Applies locally (and is remembered on this device). */
  onApply: (next: { mode: TeamMode; custom: string[]; order: string[]; colors: Record<string, string> }) => void;
  /** After "Save for everyone" succeeded. */
  onSavedShared: () => void;
}

const MODES: TeamMode[] = ["scheduled", "all", "custom"];

/**
 * Team selector (Scheduled / All / custom pick) and column order. Order is
 * changed by dragging a row (mouse/touch) or with the arrow buttons
 * (keyboard). Admins can save the order and colours for the whole team.
 */
export function TeamDialog(props: TeamDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onClose={props.onClose} size="md" title={t.calendar.teamTitle} description={t.calendar.teamDescription}>
      {props.open && <TeamForm {...props} />}
    </Dialog>
  );
}

function TeamForm({ onClose, members, mode, custom, isAdmin, onApply, onSavedShared }: TeamDialogProps) {
  const { t } = useTranslation();
  const supabase = useSupabase();
  const [list, setList] = useState(members);
  const [teamMode, setTeamMode] = useState<TeamMode>(mode);
  const [picked, setPicked] = useState<string[]>(custom.length ? custom : members.map((m) => m.id));
  const [colors, setColors] = useState<Record<string, string>>(() => Object.fromEntries(members.map((m) => [m.id, m.color])));
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  const modeLabel: Record<TeamMode, string> = {
    scheduled: t.calendar.teamScheduled,
    all: t.calendar.teamAll,
    custom: t.calendar.teamCustom,
  };

  const move = (from: number, to: number) => {
    setList((prev) => {
      const next = moveItem(prev, from, to);
      const item = next[Math.max(0, Math.min(next.length - 1, to))];
      if (item) setAnnounce(`${item.name}: ${Math.max(0, Math.min(next.length - 1, to)) + 1} / ${next.length}`);
      return next;
    });
  };

  const apply = () => {
    onApply({ mode: teamMode, custom: picked, order: list.map((m) => m.id), colors });
    onClose();
  };

  const saveShared = async () => {
    setBusy(true);
    const { error } = await saveCalendarTeam(
      supabase,
      list.map((m, i) => ({ id: m.id, order: i, color: colors[m.id] ?? null })),
    );
    setBusy(false);
    if (error) {
      toast.error(errorText(t, /^[A-Z_]+$/.test(error.message) ? error.message : null));
      return;
    }
    toast.success(t.calendar.teamSaved);
    onApply({ mode: teamMode, custom: picked, order: list.map((m) => m.id), colors });
    onSavedShared();
    onClose();
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t.calendar.teamShow} className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={teamMode === m}
            onClick={() => setTeamMode(m)}
            className={cn(
              "min-h-[40px] rounded-[6px] px-2 text-[13px] transition-colors",
              teamMode === m ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {modeLabel[m]}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-muted)]">{t.calendar.teamOrderHint}</p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ul className="space-y-1.5">
        {list.map((m, i) => (
          <li
            key={m.id}
            draggable
            onDragStart={(e) => {
              setDragId(m.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === m.id) return;
              e.preventDefault();
              const from = list.findIndex((x) => x.id === dragId);
              if (from >= 0 && from !== i) move(from, i);
            }}
            onDragEnd={() => setDragId(null)}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2",
              dragId === m.id && "opacity-50",
            )}
          >
            <GripVertical size={16} aria-hidden="true" className="shrink-0 cursor-grab text-[var(--text-muted)]" />
            {teamMode === "custom" && (
              <input
                type="checkbox"
                aria-label={m.name}
                className="h-5 w-5 shrink-0 accent-[var(--accent-brass)]"
                checked={picked.includes(m.id)}
                onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)))}
              />
            )}
            <LaneAvatar lane={{ key: m.id, barberId: m.id, name: m.name, avatar: m.avatar, color: colors[m.id] ?? m.color }} size={28} />
            <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-primary)]">{m.name}</span>
            {isAdmin && (
              <details className="relative">
                <summary
                  className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full"
                  aria-label={t.calendar.teamColor}
                >
                  <span className="h-5 w-5 rounded-full border border-[var(--border-primary)]" style={{ background: colors[m.id] ?? m.color }} />
                </summary>
                <div className="absolute end-0 z-10 mt-1 grid grid-cols-4 gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 shadow-lg">
                  {BARBER_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={(colors[m.id] ?? m.color) === c}
                      onClick={() => setColors((prev) => ({ ...prev, [m.id]: c }))}
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: c }}
                    >
                      {(colors[m.id] ?? m.color) === c && <Check size={14} className="text-white" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <button type="button" className="btn btn-ghost h-9 min-h-0 w-9 p-0" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${t.calendar.moveUp}: ${m.name}`}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost h-9 min-h-0 w-9 p-0"
              disabled={i === list.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label={`${t.calendar.moveDown}: ${m.name}`}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <DialogFooter>
        {isAdmin && (
          <button type="button" className="btn btn-secondary me-auto" onClick={saveShared} disabled={busy} aria-busy={busy}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {t.calendar.teamSaveShared}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={busy || (teamMode === "custom" && picked.length === 0)}>
          {t.calendar.teamApply}
        </button>
      </DialogFooter>
    </div>
  );
}
