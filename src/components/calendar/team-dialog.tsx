"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { checkboxClasses } from "@/components/ui/recipes";
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
      <SegmentedControl
        ariaLabel={t.calendar.teamShow}
        value={teamMode}
        onChange={setTeamMode}
        options={MODES.map((m) => ({ value: m, label: modeLabel[m] }))}
        fullWidth
      />
      <p className="text-meta text-ink-muted">{t.calendar.teamOrderHint}</p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ul className="overflow-hidden rounded-xl border border-line">
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
              "flex items-center gap-2.5 border-b border-line bg-card px-3 py-2 transition-colors duration-150 last:border-b-0 hover:bg-sunken/60 motion-reduce:transition-none",
              dragId === m.id && "bg-brand-soft/50 opacity-60",
            )}
          >
            <GripVertical size={16} aria-hidden="true" className="shrink-0 cursor-grab text-ink-disabled" />
            {teamMode === "custom" && (
              <input
                type="checkbox"
                aria-label={m.name}
                className={cn(checkboxClasses, "shrink-0")}
                checked={picked.includes(m.id)}
                onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)))}
              />
            )}
            <LaneAvatar lane={{ key: m.id, barberId: m.id, name: m.name, avatar: m.avatar, color: colors[m.id] ?? m.color }} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.name}</span>
            {isAdmin && (
              <details className="relative">
                <summary
                  className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden"
                  aria-label={t.calendar.teamColor}
                >
                  <span className="size-5 rounded-full ring-2 ring-card" style={{ background: colors[m.id] ?? m.color, boxShadow: `0 0 0 3px ${colors[m.id] ?? m.color}` }} />
                </summary>
                <div className="absolute end-0 z-10 mt-2 grid grid-cols-4 gap-2 rounded-2xl border border-line bg-card p-2.5 shadow-float">
                  {BARBER_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={(colors[m.id] ?? m.color) === c}
                      onClick={() => setColors((prev) => ({ ...prev, [m.id]: c }))}
                      className="flex size-9 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:ring-2 aria-pressed:ring-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-card motion-reduce:transition-none motion-reduce:hover:scale-100"
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
