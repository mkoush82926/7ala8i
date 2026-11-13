"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ListSkeleton } from "@/components/ui/skeleton";
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
        className="relative grid size-11 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute end-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--accent-rose)] px-1 text-[10px] font-bold leading-[14px] text-[var(--on-accent)]"
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
          className="fixed inset-x-4 top-[72px] z-50 flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
            <h2 id={titleId} className="m-0 text-[14px] font-bold text-[var(--text-primary)]">
              {t.common.notifications}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setRead(notifications.filter((n) => !n.is_read).map((n) => n.id))}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-[var(--accent-text)] hover:underline"
              >
                <Check size={13} aria-hidden="true" />
                {t.notifications.markAllRead}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <ListSkeleton rows={3} />
            ) : failed ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center" role="alert">
                <AlertTriangle size={20} className="text-[var(--accent-rose)]" aria-hidden="true" />
                <p className="m-0 text-[13px] text-[var(--text-secondary)]">{t.notifications.loadFailed}</p>
                <button
                  type="button"
                  className="btn btn-secondary min-h-10"
                  onClick={() => {
                    setLoading(true);
                    setReloadKey((k) => k + 1);
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {t.common.retry}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
                <p className="m-0 text-[13px] text-[var(--text-secondary)]">{t.notifications.empty}</p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {notifications.map((n) => {
                  const d = describeNotification(n, t, fmt);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n, d.link)}
                        className={cn(
                          "w-full rounded-xl p-3 text-start transition-colors",
                          n.is_read
                            ? "hover:bg-[var(--bg-surface-hover)]"
                            : "bg-[var(--accent-mint-muted)] hover:bg-[var(--bg-surface-hover)]",
                        )}
                      >
                        <span className="mb-1 flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "text-[13px]",
                              n.is_read ? "font-medium text-[var(--text-secondary)]" : "font-bold text-[var(--text-primary)]",
                            )}
                          >
                            {d.title}
                          </span>
                          {!n.is_read && (
                            <>
                              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent-mint)]" />
                              <span className="sr-only">{t.notifications.unread}</span>
                            </>
                          )}
                        </span>
                        {d.body && (
                          <span className="line-clamp-2 block text-[12px] leading-relaxed text-[var(--text-secondary)]">
                            {d.body}
                          </span>
                        )}
                        <span className="mt-1.5 block text-[11px] text-[var(--text-muted)]">
                          {formatRelative(n.created_at)}
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
