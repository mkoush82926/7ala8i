"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { DialogFooter } from "@/components/ui/dialog";

/** The subset of a team member the shift panels need. */
export interface ShiftMember {
  id: string;
  full_name: string | null;
}

type T = ReturnType<typeof useTranslation>["t"];

/** t.error.codes[code] ?? fallback. */
export function codeMessage(t: T, code: string | undefined | null, fallback: string): string {
  const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
  return (code && codes?.[code]) || fallback;
}

/** Supabase/PostgREST error → user text (P0001 codes, RLS 42501, unique 23505). */
export function dbErrorMessage(t: T, err: unknown, fallback: string): string {
  const e = (err ?? {}) as { code?: string; message?: string };
  if (e.message && /^[A-Z][A-Z_]+$/.test(e.message)) return codeMessage(t, e.message, fallback);
  if (e.code === "42501") return codeMessage(t, "FORBIDDEN", fallback);
  if (e.code === "23505") return codeMessage(t, "CONFLICT", fallback);
  return fallback;
}

/** Cancel + primary save row used at the bottom of every shift panel. */
export function PanelActions({
  onCancel,
  onSave,
  saving,
  saveLabel,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DialogFooter className="mt-6 border-t border-[var(--border-subtle)] pt-4">
      <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
        {t.common.cancel}
      </button>
      <button type="button" onClick={onSave} disabled={saving || disabled} aria-busy={saving || undefined} className="btn btn-primary">
        {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {saving ? t.common.processing : saveLabel}
      </button>
    </DialogFooter>
  );
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA-u-nu-latn", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Local "YYYY-MM-DD" + "HH:MM" in `tz` → ISO instant. Uses the zone offset at
 * that wall time (correct for Asia/Amman, which has no DST since 2022).
 */
export function zonedToIso(date: string, time: string, tz: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}
