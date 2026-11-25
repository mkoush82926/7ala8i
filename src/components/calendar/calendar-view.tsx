"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Footprints, Lock, Moon, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn, parseDateInput } from "@/lib/utils";
import { formatHijri } from "@/lib/hijri";
import { enqueueMessage } from "@/lib/messaging-stub";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabase } from "@/hooks/use-supabase";
import { getClientById } from "@/lib/queries/clients";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { AppointmentActionError, useAppointments, type CalendarAppointment } from "@/hooks/use-appointments";
import type { PaymentMethod } from "@/lib/types";
import type { BlockedTimeRow } from "@/lib/queries/appointments";
import {
  COLOR_SOURCES,
  JUMP_WEEKS,
  RANGE_MODES,
  addDaysLocal,
  barberColor,
  cardColor,
  fromIsoDay,
  hourRangeFor,
  isoDay,
  minutesOfDay,
  orderTeam,
  rangeFor,
  scheduledIds,
  selectTeam,
  shiftAnchor,
  workRanges,
  UNASSIGNED_KEY,
  type ColorSource,
  type MoveTarget,
  type RangeMode,
  type TeamMode,
} from "./calendar-model";
import { useCalendarData } from "./use-calendar-data";
import { TimeGrid, LaneAvatar, type GridLane, type SlotRequest } from "./time-grid";
import { WeekMatrix } from "./week-matrix";
import { MonthView } from "./month-view";
import { SlotPopover, CreateFab, type CreateKind } from "./slot-popover";
import { MoveConfirmDialog, type MoveRequest } from "./move-confirm-dialog";
import { AppointmentDetailsDialog } from "./appointment-details-dialog";
import { AppointmentFormDialog, type AppointmentFormDefaults } from "./appointment-form-dialog";
import { BlockTimeDialog, useBlockLabel, type BlockDialogState } from "./block-time-dialog";
import { PrayerSettingsDialog } from "./prayer-settings-dialog";
import { TeamDialog } from "./team-dialog";
import { errorText } from "./error-text";

type PendingStatus = { appointment: CalendarAppointment; status: "no_show" | "cancelled" } | null;
type FormState = { open: false } | { open: true; appointment: CalendarAppointment | null; defaults: AppointmentFormDefaults };
type Popover = { req: SlotRequest } | null;

interface Prefs {
  mode: RangeMode;
  teamMode: TeamMode;
  custom: string[];
  order: string[];
  colorSource: ColorSource;
  showHijri: boolean;
}

const PREFS_KEY = "halaqy.calendar.v2";
const DEFAULT_PREFS: Prefs = { mode: "day", teamMode: "scheduled", custom: [], order: [], colorSource: "barber", showHijri: false };
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      mode: RANGE_MODES.includes(p.mode as RangeMode) ? (p.mode as RangeMode) : DEFAULT_PREFS.mode,
      teamMode: (["scheduled", "all", "custom"] as const).includes(p.teamMode as TeamMode) ? (p.teamMode as TeamMode) : "scheduled",
      custom: Array.isArray(p.custom) ? p.custom.filter((x) => typeof x === "string") : [],
      order: Array.isArray(p.order) ? p.order.filter((x) => typeof x === "string") : [],
      colorSource: COLOR_SOURCES.includes(p.colorSource as ColorSource) ? (p.colorSource as ColorSource) : "barber",
      showHijri: !!p.showHijri,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * Calendar v2 (WS-1E): Day / 3-Day / Week (staff × days) / Month density,
 * drag-and-drop with conflict confirmation, blocked and prayer time, team
 * selection and ordering, and front-desk statuses.
 */
export function CalendarView() {
  const { t, isRTL, FFD, href, locale, formatDate, formatTime } = useTranslation();
  const supabase = useSupabase();
  const barbers = useWorkspaceStore((s) => s.barbers);
  const currentView = useWorkspaceStore((s) => s.currentView);
  const role = useWorkspaceStore((s) => s.role);
  const selfId = useWorkspaceStore((s) => s.userId);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const shopName = useWorkspaceStore((s) => s.shopName);
  const shopCurrency = useWorkspaceStore((s) => s.currency);
  const isAdmin = role === "shop_admin";
  const narrow = useIsNarrow();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    setPrefs(readPrefs());
    setPrefsLoaded(true);
  }, []);
  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode: keep in memory */
      }
      return next;
    });
  }, []);
  const mode = prefs.mode;

  const [anchor, setAnchor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>(null);
  const [form, setForm] = useState<FormState>({ open: false });
  const [popover, setPopover] = useState<Popover>(null);
  const [moveReq, setMoveReq] = useState<MoveRequest | null>(null);
  const [moveModeId, setMoveModeId] = useState<string | null>(null);
  const [blockDialog, setBlockDialog] = useState<BlockDialogState | null>(null);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [laneIndex, setLaneIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Deep links (same contract as v1): ?date=yyyy-MM-dd[&appt=id], ?new=1&client=id ───
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const linkKey = ["date", "appt", "new", "client"].map((k) => searchParams.get(k) ?? "").join("|");
  const hasLink = linkKey !== "|||";
  const [appliedLink, setAppliedLink] = useState<string | null>(null);
  const [pendingAppt, setPendingAppt] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<string | null>(null);
  if (linkKey !== appliedLink) {
    setAppliedLink(linkKey);
    const linkedDate = parseDateInput(searchParams.get("date"));
    if (linkedDate) setAnchor(linkedDate);
    const linkedAppt = searchParams.get("appt");
    if (linkedAppt) {
      setDetailsId(linkedAppt);
      setPendingAppt(linkedAppt);
    }
    if (searchParams.get("new") === "1") setPendingClient(searchParams.get("client") ?? "");
  }
  useEffect(() => {
    if (hasLink) router.replace(pathname, { scroll: false });
  }, [hasLink, linkKey, pathname, router]);

  // ─── Data ───
  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const fromDate = useMemo(() => fromIsoDay(range.from), [range.from]);
  const toDate = useMemo(() => fromIsoDay(range.to), [range.to]);
  const {
    appointments,
    loading,
    error,
    refetch,
    refresh,
    updateStatus,
    markPaid,
    createAppointment,
    updateAppointment,
    moveAppointment,
    undoNoShow,
    loadedDate,
  } = useAppointments(fromDate, { to: toDate, detailed: true });
  const data = useCalendarData(range.from, range.to);
  const { blockLabel } = useBlockLabel(data.blockTypes);

  useEffect(() => {
    if (!pendingAppt || loading || loadedDate !== range.from) return;
    if (!appointments.some((a) => a.id === pendingAppt)) {
      toast.error(t.common.linkNotFound);
      setDetailsId(null);
    }
    setPendingAppt(null);
  }, [pendingAppt, loading, loadedDate, range.from, appointments, t]);

  useEffect(() => {
    if (pendingClient === null) return;
    const clientId = pendingClient;
    let cancelled = false;
    (async () => {
      let defaults: Partial<AppointmentFormDefaults> | null = {};
      if (clientId) {
        try {
          const { data: row } = await getClientById(supabase, clientId);
          const c = (row ?? null) as { name?: string | null; phone?: string | null } | null;
          defaults = c ? { clientName: c.name ?? "", clientPhone: c.phone ?? "" } : null;
        } catch {
          defaults = null;
        }
      }
      if (cancelled) return;
      setPendingClient(null);
      if (!defaults) {
        toast.error(t.common.linkNotFound);
        return;
      }
      setForm({ open: true, appointment: null, defaults: { day: isoDay(anchor), barberId: currentView !== "master" ? currentView : null, ...defaults } });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClient, supabase]);

  // ─── Team / lanes ───
  const metaById = useMemo(() => new Map(data.teamMeta.map((m) => [m.id, m])), [data.teamMeta]);
  const ordered = useMemo(
    () =>
      orderTeam(
        barbers.map((b) => ({
          id: b.id,
          name: b.name,
          avatar: b.avatar ?? null,
          order: metaById.get(b.id)?.calendar_order ?? null,
          color: metaById.get(b.id)?.calendar_color ?? null,
        })),
        prefs.order,
      ),
    [barbers, metaById, prefs.order],
  );
  const barberColors = useMemo(() => {
    const index = new Map(barbers.map((b, i) => [b.id, i]));
    return new Map(ordered.map((m) => [m.id, barberColor(m, index.get(m.id) ?? 0)]));
  }, [ordered, barbers]);
  const scheduled = useMemo(
    () => scheduledIds(ordered.map((m) => m.id), range.days, data.schedule),
    [ordered, range.days, data.schedule],
  );

  const visible = useMemo(
    () => (currentView === "master" ? appointments : appointments.filter((a) => a.barberId === currentView)),
    [appointments, currentView],
  );

  const lanes = useMemo<GridLane[]>(() => {
    const base = currentView === "master" ? selectTeam(prefs.teamMode, ordered, scheduled, prefs.custom) : ordered.filter((m) => m.id === currentView);
    const out: GridLane[] = base.map((m) => ({ key: m.id, barberId: m.id, name: m.name, avatar: m.avatar, color: barberColors.get(m.id) ?? "#8c8478" }));
    const known = new Set(out.map((l) => l.barberId));
    // Anyone hidden by the team filter who still has bookings in range stays visible.
    for (const a of visible) {
      if (a.barberId && !known.has(a.barberId)) {
        known.add(a.barberId);
        const m = ordered.find((x) => x.id === a.barberId);
        out.push({ key: a.barberId, barberId: a.barberId, name: m?.name ?? t.calendar.barber, avatar: m?.avatar, color: barberColors.get(a.barberId) ?? "#8c8478" });
      }
    }
    if (currentView === "master" && visible.some((a) => a.barberId === null)) {
      out.push({ key: UNASSIGNED_KEY, barberId: null, name: t.calendar.unassigned, color: "#8c8478" });
    }
    return out;
  }, [currentView, prefs.teamMode, prefs.custom, ordered, scheduled, barberColors, visible, t]);

  const safeLaneIndex = Math.min(laneIndex, Math.max(0, lanes.length - 1));
  const singleLane = narrow && mode === "day" && lanes.length > 1;
  const gridLanes = singleLane ? lanes.slice(safeLaneIndex, safeLaneIndex + 1) : lanes;
  const gridDays = useMemo(() => (mode === "day" ? [range.from] : range.days), [mode, range]);

  const workRangesFor = useCallback(
    (barberId: string | null, day: string): [number, number][] => (barberId ? workRanges(barberId, day, data.schedule) : [[0, 1440]]),
    [data.schedule],
  );
  const hourRange = useMemo(() => {
    const work = gridLanes.flatMap((l) => (l.barberId ? gridDays.flatMap((d) => workRanges(l.barberId!, d, data.schedule)) : []));
    return hourRangeFor(visible, work);
  }, [gridLanes, gridDays, data.schedule, visible]);

  const canEdit = useCallback(
    (a: CalendarAppointment) => isAdmin || (!!selfId && (a.barberId === selfId || a.barberId === null)),
    [isAdmin, selfId],
  );
  const colorFor = useCallback(
    (a: CalendarAppointment) =>
      cardColor(prefs.colorSource, { status: a.status, barberId: a.barberId, categorySlug: data.categoryOf(a.serviceIds) }, barberColors),
    [prefs.colorSource, data, barberColors],
  );
  const serviceLabel = useCallback(
    (a: CalendarAppointment) =>
      a.services.length ? a.services.map((l) => (locale === "ar" && l.nameAr ? l.nameAr : l.name)).join(" + ") : a.serviceName ?? "",
    [locale],
  );
  const barberName = useCallback(
    (id: string | null) => (id ? barbers.find((b) => b.id === id)?.name ?? t.calendar.barber : t.calendar.unassigned),
    [barbers, t],
  );

  const details = detailsId ? appointments.find((a) => a.id === detailsId) ?? null : null;
  const currency = shopCurrency || appointments[0]?.currency || "JOD";
  const todayIso = isoDay(now);

  // ─── Create ───
  const nowSlot = () => {
    const m = minutesOfDay(new Date());
    return hhmm(Math.floor(m / 5) * 5);
  };
  const defaultBarber = () => (currentView !== "master" ? currentView : !isAdmin ? selfId : null);

  const openCreate = (kind: CreateKind, at?: { day: string; minutes: number; barberId: string | null }) => {
    setPopover(null);
    const barberId = at ? at.barberId : defaultBarber();
    if (kind === "block") {
      setBlockDialog({ mode: "create", day: at?.day ?? isoDay(anchor), time: at ? hhmm(at.minutes) : nowSlot(), barberId });
      return;
    }
    if (kind === "walk_in") {
      setForm({ open: true, appointment: null, defaults: { day: todayIso, time: nowSlot(), barberId, walkIn: true } });
      return;
    }
    setForm({ open: true, appointment: null, defaults: { day: at?.day ?? isoDay(anchor), time: at ? hhmm(at.minutes) : undefined, barberId } });
  };

  // ─── Status actions ───
  const fail = (err: unknown) => errorText(t, err instanceof AppointmentActionError ? err.code : null);

  const handleConfirmStatus = async (a: CalendarAppointment) => {
    try {
      await updateStatus(a.id, "confirmed");
      toast.success(t.calendar.markedConfirmed);
    } catch (err) {
      toast.error(fail(err));
    }
  };
  const handleFrontDesk = async (a: CalendarAppointment, status: "arrived" | "in_chair") => {
    try {
      await updateStatus(a.id, status);
      toast.success(status === "arrived" ? t.calendar.markedArrived : t.calendar.markedInChair);
      refresh();
    } catch (err) {
      toast.error(fail(err));
    }
  };
  const handlePay = async (a: CalendarAppointment, method: PaymentMethod) => {
    try {
      await markPaid(a.id, method);
      toast.success(t.calendar.markedPaid);
      setDetailsId(null);
    } catch (err) {
      toast.error(fail(err));
    }
  };
  const handleUndoNoShow = async (a: CalendarAppointment) => {
    try {
      await undoNoShow(a.id);
      toast.success(t.calendar.noShowUndone);
    } catch (err) {
      toast.error(fail(err));
    }
  };
  const runPendingStatus = async () => {
    if (!pendingStatus) return;
    const { appointment, status } = pendingStatus;
    try {
      await updateStatus(appointment.id, status);
    } catch (err) {
      throw new Error(fail(err));
    }
    setDetailsId(null);
    if (status === "no_show") {
      toast.success(t.calendar.markedNoShow, { action: { label: t.calendar.undo, onClick: () => handleUndoNoShow(appointment) } });
    } else {
      toast.success(t.calendar.markedCancelled);
    }
  };

  // ─── Moves (drag, resize, keyboard) ───
  const requestMove = useCallback((a: CalendarAppointment, target: MoveTarget, kind: "move" | "resize") => {
    setMoveReq({ appointment: a, target, kind });
  }, []);

  const confirmMove = async (req: MoveRequest, notifyPhone: string | null) => {
    try {
      await moveAppointment(req.appointment.id, { startTime: req.target.startIso, endTime: req.target.endIso, barberId: req.target.barberId });
    } catch (err) {
      throw new Error(fail(err));
    }
    setMoveReq(null);
    toast.success(t.calendar.moved);
    if (!notifyPhone) return;
    const body = interpolate(t.calendar.notifyBody, {
      name: req.appointment.clientName || "",
      shop: shopName,
      time: `${formatDate(req.target.startIso, "weekdayDay")} ${formatTime(req.target.startIso)}`,
    });
    const res = await enqueueMessage({
      shopId,
      to: notifyPhone,
      template: "schedule_change",
      body,
      locale: locale === "ar" ? "ar" : "en",
      appointmentId: req.appointment.id,
    });
    if (res.status === "queued") toast.success(t.calendar.notifyQueued);
    else if (res.status === "fallback") {
      toast.info(t.calendar.notifyFallback, {
        duration: 0,
        action: { label: t.calendar.openWhatsapp, onClick: () => window.open(res.waLink, "_blank", "noopener,noreferrer") },
      });
    }
  };

  // ─── Navigation ───
  const rangeLabel = (() => {
    if (mode === "month") return formatDate(anchor, { month: "long", year: "numeric" });
    if (mode === "day") return formatDate(fromDate, "long");
    return `${formatDate(fromDate, "weekdayDay")} – ${formatDate(toDate, "weekdayDay")}`;
  })();
  const hijriLabel = prefs.showHijri
    ? mode === "day"
      ? formatHijri(range.from, locale === "ar" ? "ar" : "en", { withYear: true })
      : `${formatHijri(range.from, locale === "ar" ? "ar" : "en")} – ${formatHijri(range.to, locale === "ar" ? "ar" : "en", { withYear: true })}`
    : null;
  const inRange = range.days.includes(todayIso);

  const modeLabels: Record<RangeMode, string> = {
    day: t.calendar.rangeDay,
    "3day": t.calendar.range3Day,
    week: t.calendar.rangeWeek,
    month: t.calendar.rangeMonth,
  };
  const colorLabels: Record<ColorSource, string> = {
    barber: t.calendar.colorBarber,
    category: t.calendar.colorCategory,
    status: t.calendar.colorStatus,
  };

  const onSwipeEnd = (e: React.TouchEvent) => {
    if (!touchStart || !singleLane) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Swiping toward the reading start reveals the next barber (mirrored in RTL).
    const forward = isRTL ? dx > 0 : dx < 0;
    setLaneIndex((i) => Math.max(0, Math.min(lanes.length - 1, (Math.min(i, lanes.length - 1)) + (forward ? 1 : -1))));
  };

  const segBtn = (active: boolean) =>
    cn(
      "min-h-[36px] rounded-[6px] px-3 text-[13px] transition-colors",
      active ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
    );
  const navButton =
    "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";

  const showSkeleton = !prefsLoaded || (loading && appointments.length === 0);

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[22px] font-light text-[var(--text-primary)]" style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}>
            {t.calendar.title}
          </h1>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setAnchor((d) => shiftAnchor(mode, d, -1))} aria-label={t.calendar.previous} className={navButton}>
              <ChevronLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <label>
              <span className="sr-only">{t.calendar.jumpToDate}</span>
              <input
                type="date"
                value={isoDay(anchor)}
                onChange={(e) => {
                  const d = parseDateInput(e.target.value);
                  if (d) setAnchor(d);
                }}
                className="field-input h-11 w-auto min-w-0 cursor-pointer px-3 text-[14px]"
              />
            </label>
            <button type="button" onClick={() => setAnchor((d) => shiftAnchor(mode, d, 1))} aria-label={t.calendar.next} className={navButton}>
              <ChevronRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setAnchor(new Date())} disabled={inRange} className="btn btn-ghost ms-1 disabled:opacity-50">
              {t.common.today}
            </button>
          </div>
          <p className="w-full text-[13px] text-[var(--text-secondary)]" aria-live="polite">
            {rangeLabel}
            {hijriLabel && <span className="ms-2 text-[var(--text-muted)]">· {hijriLabel}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={t.calendar.viewMode} className="flex items-center gap-1 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
            {RANGE_MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => updatePrefs({ mode: m })} className={segBtn(mode === m)}>
                {modeLabels[m]}
              </button>
            ))}
          </div>
          <Link href={href("/queue")} className="btn btn-secondary">
            <Footprints size={16} aria-hidden="true" />
            {t.queue.title}
          </Link>
          <button type="button" className="btn btn-primary hidden sm:inline-flex" onClick={() => openCreate("appointment")}>
            <Plus size={16} aria-hidden="true" />
            {t.calendar.newBooking}
          </button>
        </div>
      </div>

      {/* Toolbar: jump chips, team, colours, Hijri, blocks */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t.calendar.jumpAhead}>
          {JUMP_WEEKS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAnchor(addDaysLocal(new Date(), n * 7))}
              className="min-h-[36px] shrink-0 rounded-full border border-[var(--border-subtle)] px-3 text-[12px] text-[var(--text-secondary)] hover:border-[var(--accent-brass)] hover:text-[var(--text-primary)]"
            >
              {interpolate(t.calendar.inWeeks, { n })}
            </button>
          ))}
        </div>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {currentView === "master" && (
            <button type="button" className="btn btn-ghost" onClick={() => setTeamOpen(true)} aria-haspopup="dialog">
              <Users size={16} aria-hidden="true" />
              {prefs.teamMode === "scheduled" ? t.calendar.teamScheduled : prefs.teamMode === "all" ? t.calendar.teamAll : t.calendar.teamCustom}
            </button>
          )}
          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <span>{t.calendar.colorBy}</span>
            <select
              className="field-input h-9 w-auto py-0 text-[13px]"
              value={prefs.colorSource}
              onChange={(e) => updatePrefs({ colorSource: e.target.value as ColorSource })}
            >
              {COLOR_SOURCES.map((c) => (
                <option key={c} value={c}>
                  {colorLabels[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent-brass)]" checked={prefs.showHijri} onChange={(e) => updatePrefs({ showHijri: e.target.checked })} />
            {t.calendar.showHijri}
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => openCreate("block")}>
            <Lock size={16} aria-hidden="true" />
            {t.calendar.blockTime}
          </button>
          {isAdmin && (
            <button type="button" className="btn btn-ghost" onClick={() => setPrayerOpen(true)} aria-haspopup="dialog">
              <Moon size={16} aria-hidden="true" />
              {t.calendar.prayerSettings}
            </button>
          )}
        </span>
      </div>

      {data.blocksError && (
        <p role="status" className="text-[12px] text-[var(--text-muted)]">
          {t.calendar.blocksLoadError}
        </p>
      )}

      {/* Mobile single-lane day view: barber chips + swipe */}
      {singleLane && (
        <div role="tablist" aria-label={t.calendar.teamTitle} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {lanes.map((l, i) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={i === safeLaneIndex}
              onClick={() => setLaneIndex(i)}
              className={cn(
                "flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3 text-[13px]",
                i === safeLaneIndex
                  ? "border-[var(--accent-brass)] bg-[var(--accent-blue-muted)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)]",
              )}
            >
              <LaneAvatar lane={l} size={22} />
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {showSkeleton && (
        <SkeletonGroup className="min-h-[320px] space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </SkeletonGroup>
      )}

      {!showSkeleton && error && (
        <EmptyState icon={AlertTriangle} tone="error" title={t.calendar.loadError} description={errorText(t, error)} action={{ label: t.common.retry, onClick: refetch }} />
      )}

      {!showSkeleton && !error && lanes.length === 0 && mode !== "month" && (
        <EmptyState
          icon={Users}
          title={t.calendar.noTeamTitle}
          description={t.calendar.noTeamDescription}
          action={isAdmin ? { label: t.calendar.addTeamMember, onClick: () => router.push(href("/team")) } : undefined}
        />
      )}

      {!showSkeleton && !error && lanes.length > 0 && (mode === "day" || mode === "3day") && (
        <div onTouchStart={(e) => singleLane && setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onSwipeEnd}>
          <TimeGrid
            days={gridDays}
            lanes={gridLanes}
            appointments={visible}
            blocks={data.blocks}
            range={hourRange}
            workRangesFor={workRangesFor}
            colorFor={colorFor}
            serviceLabel={serviceLabel}
            blockLabel={blockLabel}
            now={now}
            canEdit={canEdit}
            onSlot={(req) => setPopover({ req })}
            onOpen={(a) => setDetailsId(a.id)}
            onBlockOpen={(b: BlockedTimeRow) => setBlockDialog({ mode: "edit", block: b })}
            onMove={requestMove}
            moveModeId={moveModeId}
            onMoveModeChange={setMoveModeId}
            compact={singleLane}
          />
          {visible.length === 0 && !loading && (
            <p className="mt-3 text-center text-[13px] text-[var(--text-muted)]">{t.calendar.emptyDescription}</p>
          )}
        </div>
      )}

      {!showSkeleton && !error && lanes.length > 0 && mode === "week" && (
        <WeekMatrix
          days={range.days}
          lanes={lanes}
          appointments={visible}
          blocks={data.blocks}
          colorFor={colorFor}
          now={now}
          canEdit={canEdit}
          isWorking={(barberId, day) => (barberId ? workRanges(barberId, day, data.schedule).length > 0 : true)}
          onOpen={(a) => setDetailsId(a.id)}
          onSlot={(req) => setPopover({ req })}
          onMove={requestMove}
          onOpenDay={(day) => {
            setAnchor(fromIsoDay(day));
            updatePrefs({ mode: "day" });
          }}
        />
      )}

      {!showSkeleton && !error && mode === "month" && (
        <MonthView
          days={range.days}
          month={anchor.getMonth()}
          appointments={visible}
          now={now}
          showHijri={prefs.showHijri}
          onOpenDay={(day) => {
            setAnchor(fromIsoDay(day));
            updatePrefs({ mode: "day" });
          }}
        />
      )}

      <CreateFab onPick={(kind) => openCreate(kind)} />

      <SlotPopover
        open={!!popover}
        x={popover?.req.clientX ?? 0}
        y={popover?.req.clientY ?? 0}
        title={
          popover
            ? `${barberName(popover.req.barberId)} · ${formatDate(fromIsoDay(popover.req.day), "weekdayDay")} ${formatTime(hhmm(popover.req.minutes))}`
            : ""
        }
        onPick={(kind) => popover && openCreate(kind, { day: popover.req.day, minutes: popover.req.minutes, barberId: popover.req.barberId })}
        onClose={() => setPopover(null)}
      />

      <MoveConfirmDialog
        request={moveReq}
        appointments={appointments}
        blocks={data.blocks}
        barberName={barberName}
        blockLabel={blockLabel}
        onClose={() => setMoveReq(null)}
        onConfirm={confirmMove}
      />

      <AppointmentDetailsDialog
        appointment={pendingStatus || form.open ? null : details}
        barberName={details ? barberName(details.barberId) : ""}
        onClose={() => setDetailsId(null)}
        onConfirmStatus={handleConfirmStatus}
        onPay={handlePay}
        onEdit={(a) => setForm({ open: true, appointment: a, defaults: { day: isoDay(new Date(a.startTime)), barberId: a.barberId } })}
        onNoShow={(a) => setPendingStatus({ appointment: a, status: "no_show" })}
        onCancel={(a) => setPendingStatus({ appointment: a, status: "cancelled" })}
        onStatus={handleFrontDesk}
        onUndoNoShow={handleUndoNoShow}
        onMoveMode={
          mode === "day" || mode === "3day"
            ? (a) => {
                setDetailsId(null);
                setMoveModeId(a.id);
              }
            : undefined
        }
        canEdit={details ? canEdit(details) : false}
        now={now}
      />

      <ConfirmDialog
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={runPendingStatus}
        title={
          pendingStatus
            ? interpolate(pendingStatus.status === "no_show" ? t.calendar.noShowTitle : t.calendar.cancelTitle, {
                name: pendingStatus.appointment.clientName || t.calendar.walkIn,
              })
            : ""
        }
        description={
          pendingStatus
            ? `${formatTime(pendingStatus.appointment.startTime)} · ${barberName(pendingStatus.appointment.barberId)}. ${
                pendingStatus.status === "no_show" ? t.calendar.noShowUndoHint : t.calendar.irreversible
              }`
            : undefined
        }
        confirmLabel={pendingStatus?.status === "no_show" ? t.calendar.markNoShow : t.calendar.cancelAppointment}
        cancelLabel={t.calendar.keepAppointment}
        destructive
      />

      <AppointmentFormDialog
        open={form.open}
        onClose={() => setForm({ open: false })}
        appointment={form.open ? form.appointment : null}
        defaults={form.open ? form.defaults : { day: isoDay(anchor) }}
        barbers={barbers}
        currency={currency}
        onCreate={createAppointment}
        onUpdate={updateAppointment}
        onSaved={(m) => {
          toast.success(m === "create" ? t.calendar.created : t.calendar.saved);
          setForm({ open: false });
          setDetailsId(null);
        }}
      />

      <BlockTimeDialog
        state={blockDialog}
        team={ordered.map((m) => ({ id: m.id, name: m.name }))}
        types={data.blockTypes}
        onTypesChanged={data.reloadStatic}
        onClose={() => setBlockDialog(null)}
        onSaved={() => {
          setBlockDialog(null);
          data.reloadBlocks();
        }}
        onOpenPrayerSettings={() => {
          setBlockDialog(null);
          setPrayerOpen(true);
        }}
      />

      {isAdmin && (
        <PrayerSettingsDialog
          open={prayerOpen}
          onClose={() => setPrayerOpen(false)}
          onApplied={() => {
            setPrayerOpen(false);
            data.reloadBlocks();
            data.reloadStatic();
          }}
        />
      )}

      <TeamDialog
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        members={ordered.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, color: barberColors.get(m.id) ?? "#8c8478" }))}
        mode={prefs.teamMode}
        custom={prefs.custom}
        isAdmin={isAdmin}
        onApply={({ mode: teamMode, custom, order, colors }) => {
          updatePrefs({ teamMode, custom, order });
          data.setTeamMeta((prev) => prev.map((m) => (colors[m.id] ? { ...m, calendar_color: colors[m.id] } : m)));
        }}
        onSavedShared={() => {
          updatePrefs({ order: [] });
          data.reloadStatic();
        }}
      />
    </div>
  );
}
