"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Loader2, Moon } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  generatePrayerBlocks,
  getPrayerRules,
  getShopLocation,
  savePrayerRules,
} from "@/lib/queries/appointments";
import {
  AMMAN,
  RULE_LIMITS,
  computePrayerTimes,
  normalizePrayerRules,
  type LatLng,
  type PrayerBlockRule,
  type PrayerName,
} from "@/lib/prayer";
import { isoDay } from "./calendar-model";
import { errorText } from "./error-text";

interface PrayerSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the rules are saved and the blocks regenerated. */
  onApplied: () => void;
}

/**
 * Per-shop prayer rules: which prayers block the calendar, for how long,
 * starting how many minutes before/after the adhan, and how long Jumu'ah
 * lasts. Saving rewrites the next 14 days of prayer blocks immediately
 * (generate_prayer_blocks); the nightly job keeps the window rolling.
 */
export function PrayerSettingsDialog({ open, onClose, onApplied }: PrayerSettingsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t.calendar.prayerSettings} description={t.calendar.prayerSettingsDescription} closeOnBackdrop={false}>
      {open && <PrayerForm onClose={onClose} onApplied={onApplied} />}
    </Dialog>
  );
}

function PrayerForm({ onClose, onApplied }: Omit<PrayerSettingsDialogProps, "open">) {
  const { t, formatTime, formatNumber } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const id = useId();
  const [rules, setRules] = useState<PrayerBlockRule[] | null>(null);
  const [coords, setCoords] = useState<LatLng>(AMMAN);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, loc] = await Promise.all([getPrayerRules(supabase, shopId), getShopLocation(supabase, shopId)]);
      if (cancelled) return;
      if (r.error) setLoadError(true);
      setRules(normalizePrayerRules(r.data ?? []));
      const d = loc.data;
      const lat = d?.city?.lat ?? d?.lat;
      const lng = d?.city?.lng ?? d?.lng;
      if (typeof lat === "number" && typeof lng === "number") setCoords({ lat, lng });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, shopId]);

  const today = useMemo(() => computePrayerTimes(coords, isoDay(new Date())), [coords]);

  const patch = (prayer: PrayerName, p: Partial<PrayerBlockRule>) =>
    setRules((prev) => prev && prev.map((r) => (r.prayer === prayer ? { ...r, ...p } : r)));

  const names: Record<PrayerName, string> = {
    fajr: t.calendar.prayer.fajr,
    dhuhr: t.calendar.prayer.dhuhr,
    asr: t.calendar.prayer.asr,
    maghrib: t.calendar.prayer.maghrib,
    isha: t.calendar.prayer.isha,
  };

  const save = async () => {
    if (!rules) return;
    setBusy(true);
    setError(null);
    try {
      const clean = normalizePrayerRules(rules);
      const { error: saveErr } = await savePrayerRules(supabase, shopId, clean);
      if (saveErr) throw saveErr;
      const { data: count, error: genErr } = await generatePrayerBlocks(supabase, shopId, 14);
      if (genErr) throw genErr;
      toast.success(interpolate(t.calendar.prayerApplied, { count: formatNumber(count ?? 0) }));
      onApplied();
    } catch (err) {
      const code = (err as { message?: string })?.message;
      setError(errorText(t, code && /^[A-Z_]+$/.test(code) ? code : null));
    } finally {
      setBusy(false);
    }
  };

  const numberField = (
    rule: PrayerBlockRule,
    key: "minutes" | "start_offset_minutes" | "jumuah_minutes",
    label: string,
    limits: { min: number; max: number },
    disabled: boolean,
  ) => (
    <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
      {label}
      <input
        type="number"
        inputMode="numeric"
        step={5}
        min={limits.min}
        max={limits.max}
        disabled={disabled}
        value={rule[key]}
        onChange={(e) => patch(rule.prayer, { [key]: Number(e.target.value) } as Partial<PrayerBlockRule>)}
        className="field-input h-10 w-24 text-[14px]"
      />
    </label>
  );

  if (!rules) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <p role="alert" className="field-error">
          {t.calendar.prayerLoadError}
        </p>
      )}
      <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
        {rules.map((rule) => {
          const checkId = `${id}-${rule.prayer}`;
          return (
            <li key={rule.prayer} className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={checkId} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    id={checkId}
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--accent-brass)]"
                    checked={rule.enabled}
                    onChange={(e) => patch(rule.prayer, { enabled: e.target.checked })}
                  />
                  <span className="text-[15px] font-medium text-[var(--text-primary)]">{names[rule.prayer]}</span>
                </label>
                <span className="text-[13px] tabular-nums text-[var(--text-secondary)]">
                  {interpolate(t.calendar.prayerToday, { time: formatTime(today[rule.prayer]) })}
                </span>
              </div>
              <div className={cn("flex flex-wrap items-end gap-3", !rule.enabled && rule.prayer !== "dhuhr" && "opacity-60")}>
                {numberField(rule, "minutes", t.calendar.prayerMinutes, RULE_LIMITS.minutes, !rule.enabled)}
                {numberField(rule, "start_offset_minutes", t.calendar.prayerOffset, RULE_LIMITS.offset, !rule.enabled)}
                {rule.prayer === "dhuhr" &&
                  numberField(rule, "jumuah_minutes", t.calendar.jumuahMinutes, RULE_LIMITS.jumuah, false)}
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent-brass)]"
                    checked={rule.allow_online}
                    onChange={(e) => patch(rule.prayer, { allow_online: e.target.checked })}
                  />
                  {t.calendar.allowOnline}
                </label>
              </div>
              {rule.prayer === "dhuhr" && (
                <p className="text-[12px] text-[var(--text-muted)]">{t.calendar.jumuahHint}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-[12px] text-[var(--text-muted)]">
        <Moon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        {t.calendar.prayerMethodNote}
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <DialogFooter>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy} aria-busy={busy}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {t.calendar.prayerApply}
        </button>
      </DialogFooter>
    </div>
  );
}
