"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CalendarCheck, CalendarX, CalendarClock, CheckCheck, AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/recipes";
import { statusLabel } from "@/components/dashboard/status-badge";
import { normalizeAppointmentStatus } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/en";
import { cn } from "@/lib/utils";

export interface NotificationPayload {
  appointment_id?: string | null;
  status?: string | null;
  start_time?: string | null;
  client_name?: string | null;
  service_name?: string | null;
  shop_name?: string | null;
}

export interface NotificationRow {
  id: string;
  type: string | null;
  payload: NotificationPayload | null;
  title: string | null;
  message: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string;
}

const PAGE_SIZE = 20;
const COLUMNS = "id, type, payload, title, message, link, is_read, created_at";

/** Local yyyy-MM-dd for a timestamp (the calendar deep-link format). */
function localDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Localised title/body/link for a notification row. Typed rows are rendered
 * from `type` + `payload`; legacy rows fall back to the stored title/message.
 * Links are locale-less ("/calendar?date=…"); the caller prefixes the locale.
 */
export function describeNotification(
  n: NotificationRow,
  t: TranslationKeys,
  fmt: { time: (iso: string) => string; date: (iso: string) => string },
): { title: string; body: string; link: string | null } {
  const p = n.payload ?? {};
  const client = p.client_name || t.notifications.aClient;
  const when = p.start_time ? `${fmt.date(p.start_time)} · ${fmt.time(p.start_time)}` : "";
  const detail = [client, p.service_name, when].filter(Boolean).join(" · ");
  const day = p.start_time ? localDay(p.start_time) : null;
  const calendarLink = day ? `/calendar?date=${day}` : n.link;

  switch (n.type) {
    case "booking_created":
      return { title: t.notifications.bookingCreated, body: detail, link: calendarLink };
    case "booking_cancelled_by_customer":
      return { title: t.notifications.bookingCancelledByCustomer, body: detail, link: calendarLink };
    case "booking_status_changed": {
      const s = normalizeAppointmentStatus(p.status);
      const title = s
        ? interpolate(t.notifications.bookingStatusChanged, { status: statusLabel(t, s) })
        : t.notifications.bookingUpdated;
      return { title, body: detail, link: n.link || calendarLink };
    }
    default:
      return { title: n.title || t.notifications.bookingUpdated, body: n.message || "", link: n.link };
  }
}

/** Leading icon per notification type (decorative; the title carries the meaning). */
function iconFor(type: string | null): LucideIcon {
  if (type === "booking_created") return CalendarCheck;
  if (type === "booking_cancelled_by_customer") return CalendarX;
  return CalendarClock;
}

/**
 * Topbar bell backed by the `notifications` table: latest 20 rows for the
 * signed-in user, live inserts over a per-user realtime channel, optimistic
 * mark-as-read with rollback.
 */
export function NotificationBell() {
  const { t, href, formatRelative, formatTime, formatDate } = useTranslation();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (cancelled) return;
        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);

        const { data, error } = await supabase
          .from("notifications")
          .select(COLUMNS)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (cancelled) return;
        if (error) throw error;
        setNotifications((data ?? []) as NotificationRow[]);
        setFailed(false);

        channel = supabase
          .channel(`notifications:${user.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
            (payload: { new: unknown }) => {
              const row = payload.new as NotificationRow;
              setNotifications((prev) =>
                prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, PAGE_SIZE),
              );
            },
          )
          .subscribe();
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, reloadKey]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Escape and outside clicks close the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, close]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function setRead(ids: string[]) {
    if (ids.length === 0) return;
    const before = notifications;
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    let query = supabase.from("notifications").update({ is_read: true }).in("id", ids);
    if (userId) query = query.eq("user_id", userId);
    const { error } = await query;
    if (error) {
      setNotifications(before); // rollback
      toast.error(t.notifications.markReadFailed);
    }
  }

  function openNotification(n: NotificationRow, link: string | null) {
    if (!n.is_read) void setRead([n.id]);
    if (link) {
      setOpen(false);
      router.push(href(link));
    }
  }

  const fmt = { time: (iso: string) => formatTime(iso), date: (iso: string) => formatDate(iso, "dayMonth") };
  const label =
    unreadCount > 0
      ? interpolate(t.notifications.labelWithCount, { count: unreadCount })
      : t.common.notifications;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        className={cn(
          "relative grid size-11 place-items-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink motion-reduce:transition-none aria-expanded:bg-sunken aria-expanded:text-ink",
          focusRing,
        )}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute end-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-page dark:text-[#2E1414]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="fixed inset-x-4 top-[72px] z-50 flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-float sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[400px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id={titleId} className="m-0 flex items-center gap-2 text-base font-semibold text-ink">
              {t.common.notifications}
              {unreadCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-soft px-1.5 text-xs font-semibold tabular-nums text-brand-pressed">
                  {unreadCount}
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRead(notifications.filter((n) => !n.is_read).map((n) => n.id))}
                icon={<CheckCheck aria-hidden="true" />}
                className="-me-2 text-brand-text hover:text-brand-text"
              >
                {t.notifications.markAllRead}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <SkeletonGroup className="flex flex-col gap-1 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2 pt-1">
                      <Skeleton className="h-3.5 w-3/5" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </SkeletonGroup>
            ) : failed ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger-text">
                  <AlertTriangle size={22} />
                </span>
                <p className="m-0 max-w-xs text-sm text-ink-muted">{t.notifications.loadFailed}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw aria-hidden="true" />}
                  onClick={() => {
                    setLoading(true);
                    setReloadKey((k) => k + 1);
                  }}
                >
                  {t.common.retry}
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span aria-hidden="true" className="bg-hatch-ink grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-text">
                  <BellOff size={24} />
                </span>
                <p className="m-0 max-w-xs text-sm text-ink-muted">{t.notifications.empty}</p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {notifications.map((n) => {
                  const d = describeNotification(n, t, fmt);
                  const Icon = iconFor(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n, d.link)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-3 text-start transition-colors duration-150 motion-reduce:transition-none",
                          n.is_read ? "hover:bg-sunken" : "bg-brand-soft/60 hover:bg-brand-soft",
                          focusRing,
                          "focus-visible:-outline-offset-2",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full",
                            n.is_read ? "bg-sunken text-ink-muted" : "bg-card text-brand-text shadow-xs",
                          )}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={cn("text-sm", n.is_read ? "font-medium text-ink-soft" : "font-semibold text-ink")}>
                              {d.title}
                            </span>
                            {!n.is_read && (
                              <>
                                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                                <span className="sr-only">{t.notifications.unread}</span>
                              </>
                            )}
                          </span>
                          {d.body && (
                            <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-ink-muted">{d.body}</span>
                          )}
                          <span className="mt-1 block text-xs text-ink-muted">{formatRelative(n.created_at)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
