"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/components/team/shifts";
import {
  MAX_OFFSETS,
  OFFSET_PRESETS,
  offsetParts,
  parseMessagingSettings,
  toSettingsPayload,
  toggleOffset,
  validateMessagingSettings,
  type MessagingSettings,
  type SettingsError,
} from "@/lib/messaging/dashboard";

const card = "flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-5";
const h2 = "m-0 text-base font-bold text-[var(--text-primary)]";
const input =
  "focus-ring min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-50";

const REVIEW_DELAYS = [0, 30, 60, 120, 240, 1440] as const;

function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="focus-ring relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
    >
      <span
        aria-hidden="true"
        className={cn("relative inline-block h-6 w-10 rounded-full transition-colors", checked ? "bg-[var(--accent-brass)]" : "bg-[var(--border-primary)]")}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-[var(--bg-primary)] shadow transition-[inset-inline-start]",
            checked ? "start-[1.125rem]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

function ToggleRow({ title, help, checked, onChange }: { title: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        {help && <p className="m-0 mt-0.5 text-sm text-[var(--text-secondary)]">{help}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** Reminder offsets, channel, SMS fallback, quiet hours and the review request delay. */
export function MessagingSettingsForm() {
  const { t, formatNumber } = useTranslation();
  const tm = t.messaging;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const [form, setForm] = useState<MessagingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState<SettingsError | null>(null);

  const query = useSupabaseQuery<MessagingSettings>(
    async () => {
      const res = await supabase
        .from("shops")
        .select("reminder_offsets, quiet_hours, messaging_enabled, messaging_channel, sms_fallback, review_request_delay_minutes" as never)
        .eq("id", shopId)
        .maybeSingle();
      return {
        data: parseMessagingSettings(res.data as Record<string, unknown> | null),
        error: res.error ? { message: res.error.message } : null,
      };
    },
    [supabase, shopId],
    { enabled: !!shopId, retryCount: 0 },
  );

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const patch = (p: Partial<MessagingSettings>) => {
    setInvalid(null);
    setForm((f) => (f ? { ...f, ...p } : f));
  };
  const patchQuiet = (p: Partial<MessagingSettings["quietHours"]>) => {
    setInvalid(null);
    setForm((f) => (f ? { ...f, quietHours: { ...f.quietHours, ...p } } : f));
  };

  const offsetLabel = (minutes: number) => {
    const { value, unit } = offsetParts(minutes);
    return interpolate(tm.offsetUnits[unit], { n: formatNumber(value) });
  };
  const delayLabel = (minutes: number) => (minutes === 0 ? tm.reviewDelayNow : interpolate(tm.reviewDelayAfter, { time: offsetLabel(minutes) }));

  async function save() {
    if (!form) return;
    const err = validateMessagingSettings(form);
    if (err) {
      setInvalid(err);
      toast.error(tm.errors[err]);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("update_messaging_settings" as never, { p_settings: toSettingsPayload(form) } as never);
      if (error) throw error;
      setForm(parseMessagingSettings(data as Record<string, unknown> | null));
      query.refetch();
      toast.success(tm.saved);
    } catch (e) {
      toast.error(dbErrorMessage(t, e, tm.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  if (query.initialLoading || (!form && !query.error)) {
    return (
      <section className={card} aria-busy="true" aria-label={t.common.loading}>
        <ListSkeleton rows={4} />
      </section>
    );
  }
  if (query.error || !form) {
    return (
      <section className={card}>
        <EmptyState size="sm" tone="error" icon={AlertCircle} title={tm.loadFailed} action={{ label: t.common.retry, onClick: query.refetch, icon: RefreshCw }} />
      </section>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(query.data);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {/* ── Channel ── */}
      <section aria-labelledby="msg-channel" className={card}>
        <h2 id="msg-channel" className={h2}>
          {tm.channelTitle}
        </h2>
        <ToggleRow title={tm.enabledTitle} help={tm.enabledHelp} checked={form.messagingEnabled} onChange={(v) => patch({ messagingEnabled: v })} />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={!form.messagingEnabled}>
          <legend className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{tm.channelLabel}</legend>
          <div role="radiogroup" aria-label={tm.channelLabel} className="flex gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
            {(["whatsapp", "sms"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                role="radio"
                aria-checked={form.channel === ch}
                onClick={() => patch({ channel: ch })}
                className={cn(
                  "focus-ring min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50",
                  form.channel === ch ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)]",
                )}
              >
                {ch === "whatsapp" ? tm.channelWhatsapp : tm.channelSms}
              </button>
            ))}
          </div>
        </fieldset>
        {form.channel === "whatsapp" && (
          <ToggleRow title={tm.smsFallbackTitle} help={tm.smsFallbackHelp} checked={form.smsFallback} onChange={(v) => patch({ smsFallback: v })} />
        )}
      </section>

      {/* ── Reminders ── */}
      <section aria-labelledby="msg-reminders" className={cn(card, invalid === "reminder_offsets" && "border-[var(--color-error)]")}>
        <div>
          <h2 id="msg-reminders" className={h2}>
            {tm.remindersTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">{interpolate(tm.remindersHelp, { max: MAX_OFFSETS })}</p>
        </div>
        <div role="group" aria-label={tm.remindersTitle} className="flex flex-wrap gap-2">
          {OFFSET_PRESETS.map((m) => {
            const on = form.reminderOffsets.includes(m);
            const full = !on && form.reminderOffsets.length >= MAX_OFFSETS;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => patch({ reminderOffsets: toggleOffset(form.reminderOffsets, m) })}
                className={cn(
                  "focus-ring min-h-11 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-40",
                  on
                    ? "border-[var(--accent-brass)] bg-[var(--accent-brass)] text-[var(--on-accent)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {interpolate(tm.offsetBefore, { time: offsetLabel(m) })}
              </button>
            );
          })}
        </div>
        {form.reminderOffsets.length === 0 && <p className="m-0 text-sm text-[var(--text-muted)]">{tm.noReminders}</p>}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{tm.reviewDelayTitle}</span>
          <span className="text-sm text-[var(--text-secondary)]">{tm.reviewDelayHelp}</span>
          <select
            className={cn(input, "sm:max-w-xs")}
            value={form.reviewDelayMinutes}
            onChange={(e) => patch({ reviewDelayMinutes: Number(e.target.value) })}
          >
            {[...new Set([...REVIEW_DELAYS, form.reviewDelayMinutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {delayLabel(m)}
                </option>
              ))}
          </select>
        </label>
      </section>

      {/* ── Quiet hours ── */}
      <section
        aria-labelledby="msg-quiet"
        className={cn(card, (invalid === "quiet_hours" || invalid === "jumuah") && "border-[var(--color-error)]")}
      >
        <div>
          <h2 id="msg-quiet" className={h2}>
            {tm.quietTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">{tm.quietHelp}</p>
        </div>
        <ToggleRow title={tm.quietNightTitle} checked={form.quietHours.enabled} onChange={(v) => patchQuiet({ enabled: v })} />
        {form.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-secondary)]">{tm.from}</span>
              <input type="time" className={input} value={form.quietHours.start} onChange={(e) => patchQuiet({ start: e.target.value })} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-secondary)]">{tm.until}</span>
              <input type="time" className={input} value={form.quietHours.end} onChange={(e) => patchQuiet({ end: e.target.value })} required />
            </label>
          </div>
        )}
        <ToggleRow title={tm.jumuahTitle} help={tm.jumuahHelp} checked={form.quietHours.jumuah} onChange={(v) => patchQuiet({ jumuah: v })} />
        {form.quietHours.jumuah && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-secondary)]">{tm.from}</span>
              <input
                type="time"
                className={input}
                value={form.quietHours.jumuahStart}
                onChange={(e) => patchQuiet({ jumuahStart: e.target.value })}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-secondary)]">{tm.until}</span>
              <input type="time" className={input} value={form.quietHours.jumuahEnd} onChange={(e) => patchQuiet({ jumuahEnd: e.target.value })} required />
            </label>
          </div>
        )}
        {invalid && (invalid === "quiet_hours" || invalid === "jumuah") && (
          <p role="alert" className="m-0 text-sm text-[var(--color-error)]">
            {tm.errors[invalid]}
          </p>
        )}
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button type="submit" className="btn btn-primary min-h-12 shadow-lg" disabled={saving || !dirty}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
