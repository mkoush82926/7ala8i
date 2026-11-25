"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Laptop,
  MessageCircle,
  Send,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsSubpageHeader } from "@/components/settings/settings-subpage-header";
import { buttonClasses } from "@/components/ui/recipes";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { MetaLine } from "@/components/ui/meta-line";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { cn } from "@/lib/utils";
import {
  STAFF_PUSH_EVENTS,
  resolvePrefs,
  setPref,
  type PrefMatrix,
  type PushChannel,
  type StaffPushEvent,
} from "@/lib/push/events";
import {
  PushClientError,
  currentPermission,
  currentPlatform,
  fetchPushConfig,
  getDeviceSubscription,
  isPushSupported,
  isStandalone,
  pushAvailability,
  registerServiceWorker,
  sendTestPush,
  subscribeDevice,
  syncDeviceLocale,
  unsubscribeDevice,
  type PushAvailability,
} from "@/lib/push/client";
import type { PublicPushConfig } from "@/lib/push/config";
import { describeUserAgent, isDeviceUnhealthy, sortDevices, type DeviceKind, type DeviceRow } from "@/lib/push/devices";

// ─── Small pieces ──────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-ring relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-6 w-11 rounded-full transition-colors duration-150 motion-reduce:transition-none",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-[inset-inline-start] duration-150 motion-reduce:transition-none",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Card({ title, hint, children, id }: { title: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-line bg-card p-4 sm:p-6"
    >
      <h2 id={id} className="text-h3 m-0 text-ink">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const DEVICE_ICON: Record<DeviceKind, typeof Smartphone> = {
  iphone: Smartphone,
  android: Smartphone,
  ipad: Tablet,
  mac: Laptop,
  windows: Laptop,
  linux: Laptop,
  other: Laptop,
};

const btnSecondary = buttonClasses({ variant: "secondary", className: "text-sm" });
const btnPrimary = buttonClasses({ variant: "primary", className: "text-sm" });

// ─── Page ──────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

/** Settings › Notifications (WS-1K): this device, per-event push/WhatsApp toggles, devices. */
export function NotificationSettings() {
  const { t, locale, href, formatRelative } = useTranslation();
  const tn = t.notificationSettings;
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const userId = useWorkspaceStore((s) => s.userId);
  const role = useWorkspaceStore((s) => s.role);
  const isStaff = role === "shop_admin" || role === "barber";
  const supabase = useMemo(() => createClient(), []);

  const [load, setLoad] = useState<LoadState>("loading");
  const [config, setConfig] = useState<PublicPushConfig | null>(null);
  const [availability, setAvailability] = useState<PushAvailability>("unconfigured");
  const [matrix, setMatrix] = useState<PrefMatrix>(() => resolvePrefs([]));
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [hasPhone, setHasPhone] = useState(true);
  const [busy, setBusy] = useState<null | "enable" | "disable" | "test">(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<DeviceRow | null>(null);

  const refreshAvailability = useCallback((cfg: PublicPushConfig | null) => {
    setAvailability(
      pushAvailability({
        configured: !!cfg?.configured,
        supported: isPushSupported(),
        platform: currentPlatform(),
        standalone: isStandalone(),
        permission: currentPermission(),
      }),
    );
  }, []);

  const loadDevices = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, locale, last_success_at, last_failure_at, failure_count, created_at")
      .eq("profile_id", userId);
    if (error) throw error;
    setDevices((data ?? []) as DeviceRow[]);
  }, [supabase, userId]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoad("loading");
    try {
      const [cfg, prefsRes, phonesRes, sub] = await Promise.all([
        fetchPushConfig(),
        supabase.from("notification_prefs").select("event, channel, enabled").eq("profile_id", userId),
        supabase.rpc("get_profile_phones"),
        getDeviceSubscription().catch(() => null),
      ]);
      if (prefsRes.error) throw prefsRes.error;
      await loadDevices();
      setConfig(cfg);
      refreshAvailability(cfg);
      setMatrix(resolvePrefs(prefsRes.data as { event: string; channel: string; enabled: boolean }[]));
      const own = ((phonesRes.data ?? []) as { id: string; phone: string | null }[]).find((r) => r.id === userId);
      setHasPhone(!!own?.phone?.trim());
      setCurrentEndpoint(sub?.endpoint ?? null);
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, [supabase, userId, loadDevices, refreshAvailability]);

  useEffect(() => {
    if (hydrated && userId && isStaff) {
      void registerServiceWorker();
      void loadAll();
    }
  }, [hydrated, userId, isStaff, loadAll]);

  // Keep this device's alert language in step with the UI language.
  useEffect(() => {
    if (currentEndpoint) void syncDeviceLocale(locale);
  }, [currentEndpoint, locale]);

  const deviceIsOn = !!currentEndpoint && devices.some((d) => d.endpoint === currentEndpoint);

  const errorText = (err: unknown): string => {
    const code = err instanceof PushClientError ? err.code : null;
    switch (code) {
      case "DENIED":
        return tn.errors.denied;
      case "UNSUPPORTED":
        return tn.errors.unsupported;
      case "NOT_CONFIGURED":
        return tn.notConfiguredTitle;
      case "RATE_LIMITED":
        return tn.errors.rateLimited;
      case "SUBSCRIBE_FAILED":
        return tn.errors.subscribeFailed;
      default:
        return tn.errors.generic;
    }
  };

  const enable = async () => {
    setBusy("enable");
    try {
      const sub = await subscribeDevice(config?.publicKey ?? null, locale);
      setCurrentEndpoint(sub.endpoint);
      await loadDevices().catch(() => undefined);
      toast.success(tn.enabledToast);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      refreshAvailability(config);
      setBusy(null);
    }
  };

  const disable = async () => {
    setBusy("disable");
    try {
      await unsubscribeDevice();
      setCurrentEndpoint(null);
      await loadDevices().catch(() => undefined);
      toast.success(tn.disabledToast);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      await sendTestPush(locale);
      toast.success(config?.delivery ? tn.testSent : tn.testQueued);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (event: StaffPushEvent, channel: PushChannel, enabled: boolean) => {
    if (!userId) return;
    const before = matrix;
    const key = `${event}:${channel}`;
    setMatrix(setPref(matrix, event, channel, enabled));
    setSavingCell(key);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ profile_id: userId, event, channel, enabled }, { onConflict: "profile_id,event,channel" });
    setSavingCell(null);
    if (error) {
      setMatrix(before);
      toast.error(tn.saveError);
    } else {
      toast.success(tn.saved, { id: "notification-prefs-saved" });
    }
  };

  const removeDevice = async () => {
    if (!removeTarget) return;
    const { error } = await supabase.from("push_subscriptions").delete().eq("id", removeTarget.id);
    if (error) throw new Error(tn.errors.generic);
    if (removeTarget.endpoint === currentEndpoint) {
      const sub = await getDeviceSubscription().catch(() => null);
      await sub?.unsubscribe().catch(() => undefined);
      setCurrentEndpoint(null);
    }
    setDevices((d) => d.filter((x) => x.id !== removeTarget.id));
    toast.success(tn.deviceRemoved);
  };

  // ── Render ──

  const header = (
    <SettingsSubpageHeader title={tn.title} subtitle={tn.subtitle} backHref={href("/settings")} backLabel={tn.back} />
  );

  let body: React.ReactNode;
  if (!hydrated || (isStaff && load === "loading")) {
    body = <ListSkeleton rows={5} />;
  } else if (!isStaff) {
    body = <EmptyState icon={BellOff} title={tn.staffOnly} description={tn.staffOnlyHint} action={{ label: tn.back, href: href("/settings") }} />;
  } else if (load === "error") {
    body = (
      <EmptyState
        icon={AlertTriangle}
        title={tn.loadError}
        action={{ label: t.common.retry, onClick: () => void loadAll() }}
      />
    );
  } else {
    body = (
      <>
        {/* ── This device ── */}
        <Card id="ns-device" title={tn.deviceTitle} hint={tn.deviceHint}>
          {availability === "unconfigured" ? (
            <Notice icon={BellOff} title={tn.notConfiguredTitle} body={tn.notConfiguredBody} />
          ) : availability === "ios_needs_install" ? (
            <div className="flex flex-col gap-3">
              <Notice icon={Smartphone} title={tn.iosInstallTitle} body={tn.iosInstallBody} />
              <InstallPrompt ignoreSnooze />
            </div>
          ) : availability === "unsupported" ? (
            <Notice icon={BellOff} title={tn.unsupportedTitle} body={tn.unsupportedBody} />
          ) : availability === "denied" ? (
            <Notice icon={AlertTriangle} tone="danger" title={tn.deniedTitle} body={tn.deniedBody} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={deviceIsOn ? "success" : "neutral"} icon={deviceIsOn ? <BellRing size={12} aria-hidden="true" /> : <BellOff size={12} aria-hidden="true" />}>
                  {deviceIsOn ? tn.statusOn : tn.statusOff}
                </Pill>
                {!config?.delivery && <Pill tone="neutral">{tn.deliveryPending}</Pill>}
              </div>
              <div className="flex flex-wrap gap-2">
                {deviceIsOn ? (
                  <>
                    <button type="button" onClick={test} disabled={busy !== null} aria-busy={busy === "test" || undefined} className={btnPrimary}>
                      <Send size={16} aria-hidden="true" className="rtl:-scale-x-100" />
                      {tn.sendTest}
                    </button>
                    <button type="button" onClick={() => setConfirmDisable(true)} disabled={busy !== null} className={btnSecondary}>
                      <BellOff size={16} aria-hidden="true" />
                      {tn.disable}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={enable} disabled={busy !== null} aria-busy={busy === "enable" || undefined} className={btnPrimary}>
                    <BellRing size={16} aria-hidden="true" />
                    {busy === "enable" ? t.common.processing : tn.enable}
                  </button>
                )}
              </div>
              {currentPlatform() === "android" && !isStandalone() && <InstallPrompt variant="compact" />}
            </div>
          )}
        </Card>

        {/* ── Events × channels ── */}
        <Card id="ns-events" title={tn.eventsTitle} hint={tn.eventsHint}>
          <div role="table" aria-label={tn.eventsTitle} className="flex flex-col">
            <div role="row" className="flex items-center gap-2 border-b border-line pb-2 text-xs font-semibold text-ink-muted">
              <span role="columnheader" className="flex-1">
                {tn.eventColumn}
              </span>
              <span role="columnheader" className="w-14 text-center">
                {tn.channelPush}
              </span>
              <span role="columnheader" className="w-14 text-center">
                {tn.channelWhatsapp}
              </span>
            </div>
            {STAFF_PUSH_EVENTS.map((event) => (
              <div role="row" key={event} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
                <div role="rowheader" className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-ink">{tn.events[event].label}</p>
                  <p className="m-0 text-xs text-ink-soft">{tn.events[event].hint}</p>
                </div>
                {(["push", "whatsapp"] as const).map((channel) => (
                  <div role="cell" key={channel} className="flex w-14 justify-center">
                    <Switch
                      checked={matrix[event][channel]}
                      disabled={savingCell === `${event}:${channel}`}
                      onChange={(v) => void toggle(event, channel, v)}
                      label={`${tn.events[event].label} · ${channel === "push" ? tn.channelPush : tn.channelWhatsapp}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
            <MessageCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{tn.whatsappHint}</span>
          </p>
          {!hasPhone && STAFF_PUSH_EVENTS.some((e) => matrix[e].whatsapp) && (
            <p role="status" className="mt-2 flex items-start gap-2 text-xs font-medium text-danger-text">
              <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{tn.noPhone}</span>
            </p>
          )}
        </Card>

        {/* ── Devices ── */}
        <Card id="ns-devices" title={tn.devicesTitle} hint={tn.devicesHint}>
          {devices.length === 0 ? (
            <EmptyState size="sm" icon={Smartphone} title={tn.devicesEmpty} description={tn.devicesEmptyHint} />
          ) : (
            <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
              {sortDevices(devices, currentEndpoint).map((d) => {
                const info = describeUserAgent(d.user_agent);
                const Icon = DEVICE_ICON[info.kind];
                const isThis = d.endpoint === currentEndpoint;
                return (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl bg-sunken p-3">
                    <Icon size={18} aria-hidden="true" className="shrink-0 text-ink-soft" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        <span>{tn.deviceKinds[info.kind]}</span>
                        {isThis && <Pill size="sm" tone="ink">{tn.thisDevice}</Pill>}
                        {isDeviceUnhealthy(d) && (
                          <Pill size="sm" tone="danger" icon={<AlertTriangle size={11} aria-hidden="true" />}>
                            {tn.deviceFailing}
                          </Pill>
                        )}
                      </p>
                      <MetaLine
                        className="text-xs text-ink-soft"
                        items={[
                          info.browser,
                          d.locale === "en" ? tn.alertLanguageEn : tn.alertLanguageAr,
                          d.last_success_at ? `${tn.lastAlert} ${formatRelative(d.last_success_at)}` : tn.noAlertsYet,
                        ].filter(Boolean)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(d)}
                      aria-label={`${tn.removeDevice} · ${tn.deviceKinds[info.kind]}`}
                      className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-card hover:text-danger-text"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
      {header}
      {body}

      <ConfirmDialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={disable}
        title={tn.disableConfirmTitle}
        description={tn.disableConfirmBody}
        confirmLabel={tn.disable}
        destructive
      />
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeDevice}
        title={tn.removeDeviceConfirmTitle}
        description={tn.removeDeviceConfirmBody}
        confirmLabel={tn.removeDevice}
        destructive
      />
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: typeof BellOff;
  title: string;
  body: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-sunken p-3">
      <Icon
        size={18}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", tone === "danger" ? "text-danger-text" : "text-ink-soft")}
      />
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold text-ink">{title}</p>
        <p className="m-0 mt-0.5 text-sm text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
