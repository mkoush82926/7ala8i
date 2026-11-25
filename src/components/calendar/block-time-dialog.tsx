"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Loader2, Moon, Trash2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  deleteBlockedTimes,
  ensureDefaultBlockTypes,
  insertBlockedTimes,
  updateBlockedTime,
  type BlockTypeRow,
  type BlockedTimeRow,
} from "@/lib/queries/appointments";
import {
  BLOCK_REPEATS,
  MAX_BLOCK_ROWS,
  MIN_DURATION,
  buildBlockRows,
  isoDay,
  minutesOfDay,
  type BlockRepeat,
} from "./calendar-model";
import { combineDayAndTime } from "./calendar-utils";
import { errorText } from "./error-text";

export type BlockDialogState =
  | { mode: "create"; day: string; time: string; barberId: string | null }
  | { mode: "edit"; block: BlockedTimeRow };

interface BlockTimeDialogProps {
  state: BlockDialogState | null;
  team: { id: string; name: string }[];
  types: BlockTypeRow[];
  onTypesChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
  /** Opens the prayer rules (prayer blocks are generated, not edited by hand). */
  onOpenPrayerSettings?: () => void;
}

const SHOP_WIDE = "__shop__";
const pad = (n: number) => String(n).padStart(2, "0");
const hhmmOf = (iso: string) => {
  const m = minutesOfDay(new Date(iso));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Localised block-type / block label. */
export function useBlockLabel(types: BlockTypeRow[]) {
  const { t, locale } = useTranslation();
  return useMemo(() => {
    const byId = new Map(types.map((ty) => [ty.id, ty]));
    const prayerNames: Record<string, string> = {
      fajr: t.calendar.prayer.fajr,
      dhuhr: t.calendar.prayer.dhuhr,
      asr: t.calendar.prayer.asr,
      maghrib: t.calendar.prayer.maghrib,
      isha: t.calendar.prayer.isha,
      jumuah: t.calendar.prayer.jumuah,
    };
    const typeName = (ty: BlockTypeRow | undefined) => {
      if (!ty) return null;
      if (ty.system_key === "prayer") return t.calendar.blockTypes.prayer;
      if (ty.system_key === "jumuah") return t.calendar.blockTypes.jumuah;
      if (ty.system_key === "lunch") return t.calendar.blockTypes.lunch;
      if (ty.system_key === "admin") return t.calendar.blockTypes.admin;
      return locale === "ar" && ty.name_ar ? ty.name_ar : ty.name_en;
    };
    return {
      typeName,
      blockLabel: (b: BlockedTimeRow) => {
        if (b.source === "prayer" && b.title && prayerNames[b.title]) return prayerNames[b.title];
        return b.title || typeName(b.type_id ? byId.get(b.type_id) : undefined) || t.calendar.blocked;
      },
    };
  }, [types, t, locale]);
}

/**
 * Create, edit or delete blocked time (P0V blocked_times). Admins can block
 * the whole shop or any barber; a barber only their own time. Repeats write
 * one row per occurrence (series_id groups them) so availability reads them
 * directly. Blocks hide online slots unless "Allow online bookings" is on.
 */
export function BlockTimeDialog({ state, team, types, onTypesChanged, onClose, onSaved, onOpenPrayerSettings }: BlockTimeDialogProps) {
  const { t, formatDate, formatTime } = useTranslation();
  const isEdit = state?.mode === "edit";
  const block = state?.mode === "edit" ? state.block : null;
  const title = !state
    ? ""
    : isEdit
      ? block?.source === "prayer"
        ? t.calendar.prayerBlock
        : t.calendar.editBlock
      : t.calendar.blockTime;
  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      size="md"
      title={title}
      description={block ? `${formatDate(block.start_time, "weekdayDay")} · ${formatTime(block.start_time)} – ${formatTime(block.end_time)}` : t.calendar.blockDescription}
      closeOnBackdrop={false}
    >
      {state && (
        <BlockForm
          key={state.mode === "edit" ? state.block.id : `${state.day}-${state.time}-${state.barberId}`}
          state={state}
          team={team}
          types={types}
          onTypesChanged={onTypesChanged}
          onClose={onClose}
          onSaved={onSaved}
          onOpenPrayerSettings={onOpenPrayerSettings}
        />
      )}
    </Dialog>
  );
}

function BlockForm({
  state,
  team,
  types,
  onTypesChanged,
  onClose,
  onSaved,
  onOpenPrayerSettings,
}: Omit<BlockTimeDialogProps, "state"> & { state: BlockDialogState }) {
  const { t } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const selfId = useWorkspaceStore((s) => s.userId);
  const isAdmin = role === "shop_admin";
  const id = useId();
  const { typeName } = useBlockLabel(types);

  const block = state.mode === "edit" ? state.block : null;
  const isPrayer = block?.source === "prayer";
  const activeTypes = types.filter((ty) => ty.is_active !== false);

  const initialWho = block
    ? block.barber_id ?? SHOP_WIDE
    : !isAdmin
      ? selfId ?? SHOP_WIDE
      : state.mode === "create" && state.barberId
        ? state.barberId
        : SHOP_WIDE;
  const [who, setWho] = useState<string>(initialWho);
  const [typeId, setTypeId] = useState<string>(block?.type_id ?? activeTypes.find((ty) => ty.system_key === "admin")?.id ?? activeTypes[0]?.id ?? "");
  const [titleText, setTitleText] = useState(block && !isPrayer ? block.title ?? "" : "");
  const [day, setDay] = useState(block ? isoDay(new Date(block.start_time)) : state.mode === "create" ? state.day : isoDay(new Date()));
  const [time, setTime] = useState(block ? hhmmOf(block.start_time) : state.mode === "create" ? state.time : "12:00");
  const [minutes, setMinutes] = useState<number>(() => {
    if (block) return Math.max(MIN_DURATION, Math.round((new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000));
    return activeTypes.find((ty) => ty.id === typeId)?.default_minutes ?? 30;
  });
  const [repeat, setRepeat] = useState<BlockRepeat>("none");
  const [until, setUntil] = useState<string>("");
  const [allowOnline, setAllowOnline] = useState(block?.allow_online ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | "one" | "series">(null);

  // First use: admins get the default types (Prayer, Jumu'ah, Lunch, Admin).
  useEffect(() => {
    if (!isAdmin || types.length > 0) return;
    let cancelled = false;
    ensureDefaultBlockTypes(supabase).then(({ error: e }) => {
      if (!cancelled && !e) onTypesChanged();
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, types.length, supabase, onTypesChanged]);

  // Pick a sensible default type once types arrive.
  useEffect(() => {
    if (!typeId && activeTypes.length) setTypeId(activeTypes.find((ty) => ty.system_key === "admin")?.id ?? activeTypes[0].id);
  }, [typeId, activeTypes]);

  const whoOptions = isAdmin ? team : team.filter((m) => m.id === selfId);
  const canEdit = !isPrayer && (isAdmin || (block ? block.barber_id === selfId : true));
  const minutesValid = Number.isFinite(minutes) && minutes >= MIN_DURATION && minutes <= 24 * 60;
  const untilValid = repeat === "none" || !until || until >= day;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !minutesValid || !untilValid || !day || !time) return;
    setBusy(true);
    setError(null);
    try {
      if (block) {
        const start = combineDayAndTime(day, time);
        const { error: upErr } = await updateBlockedTime(supabase, block.id, {
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + minutes * 60000).toISOString(),
          type_id: typeId || null,
          title: titleText.trim() || null,
          allow_online: allowOnline,
          barber_id: who === SHOP_WIDE ? null : who,
        });
        if (upErr) throw upErr;
        toast.success(t.calendar.blockSaved);
      } else {
        const rows = buildBlockRows(
          shopId,
          {
            barberIds: [who === SHOP_WIDE ? null : who],
            day,
            time,
            minutes,
            repeat,
            until: until || null,
            typeId: typeId || null,
            title: titleText,
            allowOnline,
          },
          () => crypto.randomUUID(),
        );
        const { error: insErr } = await insertBlockedTimes(supabase, rows);
        if (insErr) throw insErr;
        toast.success(
          rows.length > 1 ? interpolate(t.calendar.blocksCreated, { count: rows.length }) : t.calendar.blockSaved,
        );
      }
      onSaved();
    } catch (err) {
      const code = (err as { message?: string })?.message;
      setError(errorText(t, code && /^[A-Z_]+$/.test(code) ? code : null));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!block) return;
    const { error: delErr } = await deleteBlockedTimes(
      supabase,
      confirmDelete === "series" && block.series_id ? { seriesId: block.series_id, fromIso: block.start_time } : { id: block.id },
    );
    if (delErr) throw new Error(errorText(t, null));
    toast.success(t.calendar.blockDeleted);
    onSaved();
  };

  if (isPrayer) {
    return (
      <div className="space-y-4 text-[14px]">
        <p className="flex items-start gap-2 text-[var(--text-secondary)]">
          <Moon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-brass)]" />
          {t.calendar.prayerBlockManaged}
        </p>
        <p className="text-[13px] text-[var(--text-muted)]">
          {block?.allow_online ? t.calendar.blockAllowsOnline : t.calendar.blockHidesOnline}
        </p>
        <DialogFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.close}
          </button>
          {isAdmin && onOpenPrayerSettings && (
            <button type="button" className="btn btn-primary" onClick={onOpenPrayerSettings} data-autofocus>
              {t.calendar.prayerSettings}
            </button>
          )}
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-type`} className="field-label">
            {t.calendar.blockType}
          </label>
          <select
            id={`${id}-type`}
            className="field-input"
            value={typeId}
            disabled={!canEdit}
            onChange={(e) => {
              setTypeId(e.target.value);
              const ty = activeTypes.find((x) => x.id === e.target.value);
              if (!block && ty?.default_minutes) setMinutes(ty.default_minutes);
            }}
          >
            {activeTypes.length === 0 && <option value="">{t.calendar.blocked}</option>}
            {activeTypes.map((ty) => (
              <option key={ty.id} value={ty.id}>
                {ty.emoji ? `${ty.emoji} ` : ""}
                {typeName(ty)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-who`} className="field-label">
            {t.calendar.blockWho}
          </label>
          <select id={`${id}-who`} className="field-input" value={who} disabled={!canEdit} onChange={(e) => setWho(e.target.value)}>
            {isAdmin && <option value={SHOP_WIDE}>{t.calendar.wholeShop}</option>}
            {whoOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-title`} className="field-label">
          {t.calendar.blockTitle}
        </label>
        <input
          id={`${id}-title`}
          className="field-input"
          value={titleText}
          maxLength={80}
          disabled={!canEdit}
          onChange={(e) => setTitleText(e.target.value)}
          placeholder={t.calendar.blockTitlePlaceholder}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${id}-day`} className="field-label">
            {t.calendar.date}
          </label>
          <input id={`${id}-day`} type="date" className="field-input" value={day} disabled={!canEdit} onChange={(e) => setDay(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={`${id}-time`} className="field-label">
            {t.calendar.startTime}
          </label>
          <input id={`${id}-time`} type="time" step={300} className="field-input" value={time} disabled={!canEdit} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={`${id}-min`} className="field-label">
            {t.calendar.blockMinutes}
          </label>
          <input
            id={`${id}-min`}
            type="number"
            inputMode="numeric"
            min={MIN_DURATION}
            max={1440}
            step={5}
            className="field-input"
            value={Number.isFinite(minutes) ? minutes : ""}
            disabled={!canEdit}
            aria-invalid={!minutesValid}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      {!block && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-repeat`} className="field-label">
              {t.calendar.repeat}
            </label>
            <select id={`${id}-repeat`} className="field-input" value={repeat} onChange={(e) => setRepeat(e.target.value as BlockRepeat)}>
              {BLOCK_REPEATS.map((r) => (
                <option key={r} value={r}>
                  {t.calendar.repeats[r]}
                </option>
              ))}
            </select>
          </div>
          {repeat !== "none" && (
            <div>
              <label htmlFor={`${id}-until`} className="field-label">
                {t.calendar.repeatUntil}
              </label>
              <input
                id={`${id}-until`}
                type="date"
                className="field-input"
                min={day}
                value={until}
                aria-invalid={!untilValid}
                aria-describedby={`${id}-until-hint`}
                onChange={(e) => setUntil(e.target.value)}
              />
              <p id={`${id}-until-hint`} className="mt-1 text-[12px] text-[var(--text-muted)]">
                {interpolate(t.calendar.repeatHint, { max: MAX_BLOCK_ROWS })}
              </p>
            </div>
          )}
        </div>
      )}

      <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-[var(--accent-brass)]"
          checked={allowOnline}
          disabled={!canEdit}
          onChange={(e) => setAllowOnline(e.target.checked)}
        />
        <span className="text-[14px]">
          {t.calendar.allowOnline}
          <span className="block text-[12px] text-[var(--text-muted)]">{t.calendar.allowOnlineHint}</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <DialogFooter>
        {block && canEdit && (
          <span className="me-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-[var(--accent-rose)]" onClick={() => setConfirmDelete("one")} disabled={busy}>
              <Trash2 size={16} aria-hidden="true" />
              {block.series_id ? t.calendar.deleteOccurrence : t.common.delete}
            </button>
            {block.series_id && (
              <button type="button" className="btn btn-ghost text-[var(--accent-rose)]" onClick={() => setConfirmDelete("series")} disabled={busy}>
                {t.calendar.deleteFollowing}
              </button>
            )}
          </span>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </button>
        {canEdit && (
          <button type="submit" className="btn btn-primary" disabled={busy || !minutesValid || !untilValid} aria-busy={busy}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {block ? t.common.save : t.calendar.blockTime}
          </button>
        )}
      </DialogFooter>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        title={confirmDelete === "series" ? t.calendar.deleteFollowingTitle : t.calendar.deleteBlockTitle}
        description={t.calendar.irreversible}
        confirmLabel={t.common.delete}
        destructive
      />
    </form>
  );
}
