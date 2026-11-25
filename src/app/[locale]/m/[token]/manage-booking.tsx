"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Scissors,
  User,
  XCircle,
} from "lucide-react";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAvailableSlots, type AvailableSlot, type RpcClient as AvailabilityClient } from "@/lib/availability";
import { buildIcs, directionsUrl, googleCalendarUrl } from "@/lib/messaging/calendar";
import { buildWaLink } from "@/lib/messaging/phone";
import {
  bookingCalendarEvent,
  hoursUntil,
  manageState,
  parseManageBooking,
  rescheduleDates,
  rpcErrorCode,
  servicesLabel,
  shopNameFor,
  type ManageBooking,
  type ManageState,
} from "@/lib/messaging/manage";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-5";
const actionBtn =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-50";

const STATE_TONE: Record<ManageState, "ink" | "brass" | "success" | "danger" | "neutral"> = {
  upcoming: "success",
  pending: "brass",
  cancelled: "danger",
  completed: "ink",
  no_show: "danger",
  past: "neutral",
  in_progress: "ink",
};

export function ManageBookingView({ token }: { token: string | null }) {
  const { t, locale, isRTL, FFD, href } = useTranslation();
  const tm = t.manageBooking;
  const supabase = useSupabase();
  const rpc: Rpc = useCallback((fn, args) => supabase.rpc(fn as never, args as never) as never, [supabase]);

  const [booking, setBooking] = useState<ManageBooking | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "error" | "rate_limited">(token ? "loading" : "not_found");
  const [busy, setBusy] = useState<"confirm" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);

  const codeText = useCallback(
    (code: string | null, fallback: string) => {
      const codes = (t.error as unknown as { codes?: Record<string, string> }).codes ?? {};
      return (code && codes[code]) || fallback;
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      const { data, error } = await rpc("get_booking_by_token", { p_token: token });
      if (error) {
        setState(rpcErrorCode(error) === "RATE_LIMITED" ? "rate_limited" : "error");
        return;
      }
      const parsed = parseManageBooking(data);
      setBooking(parsed);
      setState(parsed ? "ready" : "not_found");
    } catch {
      setState("error");
    }
  }, [rpc, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const tz = booking?.timezone ?? "Asia/Amman";
  const fmtDate = useCallback(
    (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { timeZone: tz, ...opts }).format(new Date(iso)),
    [locale, tz],
  );
  const fmtTime = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(
        new Date(iso),
      ),
    [locale, tz],
  );

  const shopName = booking ? shopNameFor(booking.shop, locale) : "";
  const services = booking ? servicesLabel(booking.items, locale) : "";
  const pageUrl = typeof window !== "undefined" ? window.location.href.split("#")[0] : undefined;

  const calendar = useMemo(() => {
    if (!booking) return null;
    const ev = bookingCalendarEvent(booking, {
      locale,
      title: interpolate(tm.calendarTitle, { services: services || tm.visit, shop: shopName }),
      url: pageUrl,
    });
    return { ev, google: googleCalendarUrl(ev) };
  }, [booking, locale, tm, services, shopName, pageUrl]);

  function downloadIcs() {
    if (!calendar) return;
    try {
      const blob = new Blob([buildIcs(calendar.ev)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "halaqy-booking.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t.error.message);
    }
  }

  async function confirm() {
    if (!token) return;
    setBusy("confirm");
    try {
      const { error } = await rpc("confirm_by_token", { p_token: token });
      if (error) throw error;
      toast.success(tm.confirmedToast);
      await load();
    } catch (err) {
      toast.error(codeText(rpcErrorCode(err), t.error.message));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!token) return;
    const { error } = await rpc("cancel_by_token", { p_token: token, p_reason: reason.trim() || null });
    if (error) throw new Error(codeText(rpcErrorCode(error), t.error.message));
    toast.success(tm.cancelledToast);
    setReason("");
    await load();
  }

  if (state === "loading") {
    return (
      <Frame>
        <div className={cn(card, "flex flex-col gap-4")} aria-busy="true" aria-label={t.common.loading}>
          <Skeleton className="h-6 w-2/3" />
          <SkeletonText lines={4} />
          <Skeleton variant="button" className="h-11 w-full" />
        </div>
      </Frame>
    );
  }

  if (state !== "ready" || !booking) {
    const isError = state === "error" || state === "rate_limited";
    return (
      <Frame>
        <EmptyState
          size="lg"
          tone={isError ? "error" : "neutral"}
          icon={isError ? AlertCircle : CalendarClock}
          title={isError ? tm.errorTitle : tm.notFoundTitle}
          description={state === "rate_limited" ? codeText("RATE_LIMITED", tm.errorBody) : isError ? tm.errorBody : tm.notFoundBody}
          action={isError ? { label: t.common.retry, onClick: () => void load(), icon: RefreshCw } : { label: tm.findShop, href: href("/explore") }}
        />
      </Frame>
    );
  }

  const st = manageState(booking);
  const active = st === "upcoming" || st === "pending";
  const deadlineHours = hoursUntil(booking.policy.deadline);
  const landmark = locale === "ar" ? booking.shop.landmarkAr || booking.shop.landmarkEn : booking.shop.landmarkEn || booking.shop.landmarkAr;
  const directions = directionsUrl({
    google_maps_url: booking.shop.googleMapsUrl,
    lat: booking.shop.lat,
    lng: booking.shop.lng,
    address: booking.shop.address,
    name: shopName,
  });
  const shopWa = booking.shop.whatsapp || booking.shop.phone;
  const waHref = shopWa
    ? buildWaLink(shopWa, interpolate(tm.messageShopText, { date: fmtDate(booking.startTime), time: fmtTime(booking.startTime) }))
    : null;
  const bookAgainHref = booking.shop.slug || booking.shop.id ? href(`/book/${encodeURIComponent(booking.shop.slug || booking.shop.id)}?entry=rebook&src=wa`) : null;

  let policyText: string;
  if (!active) policyText = "";
  else if (booking.policy.hours <= 0) policyText = tm.policyAnytime;
  else if (booking.canCancel && booking.policy.deadline)
    policyText = interpolate(tm.policyUntil, { date: fmtDate(booking.policy.deadline), time: fmtTime(booking.policy.deadline) });
  else policyText = interpolate(tm.policyLocked, { hours: booking.policy.hours });

  return (
    <Frame>
      <header className="flex flex-col gap-2">
        <p className="m-0 text-sm font-medium text-[var(--text-secondary)]">
          {booking.clientName ? interpolate(tm.greeting, { name: booking.clientName }) : tm.title}
        </p>
        <h1
          className="m-0 text-[24px] font-extrabold leading-tight text-[var(--text-primary)] sm:text-[28px]"
          style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.01em") }}
        >
          {shopName}
        </h1>
        <div>
          <Pill tone={STATE_TONE[st]} size="md">
            {tm.states[st]}
          </Pill>
        </div>
      </header>

      <section aria-label={tm.detailsLabel} className={cn(card, "flex flex-col gap-4")}>
        <Row icon={CalendarClock} label={tm.whenLabel}>
          <span className="font-semibold">{fmtDate(booking.startTime)}</span>
          <span className="text-[var(--text-secondary)]">
            {" · "}
            <bdi>
              {fmtTime(booking.startTime)} – {fmtTime(booking.endTime)}
            </bdi>
          </span>
        </Row>
        {services && (
          <Row icon={Scissors} label={tm.servicesLabel}>
            {services}
          </Row>
        )}
        <Row icon={User} label={tm.barberLabel}>
          {booking.barber?.name || tm.anyBarber}
        </Row>
        {(booking.shop.address || landmark) && (
          <Row icon={MapPin} label={tm.locationLabel}>
            {[booking.shop.address, landmark].filter(Boolean).join(" · ")}
          </Row>
        )}
        {booking.price != null && booking.price > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-sm">
            <span className="text-[var(--text-secondary)]">{tm.totalLabel}</span>
            <span className="font-bold text-[var(--text-primary)]">
              <bdi>{formatJOD(booking.price, locale)}</bdi>
            </span>
          </div>
        )}
      </section>

      {active && (
        <section aria-label={tm.actionsLabel} className="flex flex-col gap-3">
          {booking.canConfirm && (
            <button type="button" className="btn btn-primary min-h-12 w-full" onClick={confirm} disabled={busy === "confirm"}>
              {busy === "confirm" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
              {tm.confirmCta}
            </button>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" className={actionBtn} onClick={() => setMoveOpen(true)} disabled={!booking.canReschedule}>
              <CalendarClock size={16} aria-hidden="true" />
              {tm.rescheduleCta}
            </button>
            <button
              type="button"
              className={cn(actionBtn, "text-[var(--color-error)]")}
              onClick={() => setCancelOpen(true)}
              disabled={!booking.canCancel}
            >
              <XCircle size={16} aria-hidden="true" />
              {tm.cancelCta}
            </button>
          </div>
          {policyText && (
            <p className="m-0 flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Clock3 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {policyText}
                {booking.policy.feePercent > 0 && ` ${interpolate(tm.policyFee, { percent: booking.policy.feePercent })}`}
                {booking.canCancel && deadlineHours > 0 && deadlineHours < 24 && ` ${interpolate(tm.policyHoursLeft, { hours: deadlineHours })}`}
              </span>
            </p>
          )}
        </section>
      )}

      <section aria-label={tm.moreLabel} className={cn(card, "flex flex-col gap-2")}>
        {active && calendar && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={cn(actionBtn, "flex-1")} onClick={downloadIcs}>
              <CalendarPlus size={16} aria-hidden="true" />
              {tm.addToCalendar}
            </button>
            <a className={cn(actionBtn, "flex-1")} href={calendar.google} target="_blank" rel="noopener noreferrer">
              <CalendarPlus size={16} aria-hidden="true" />
              {tm.googleCalendar}
            </a>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {directions && (
            <a className={cn(actionBtn, "flex-1")} href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} aria-hidden="true" className="rtl:-scale-x-100" />
              {tm.directions}
            </a>
          )}
          {waHref && (
            <a className={cn(actionBtn, "flex-1")} href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" />
              {tm.messageShop}
            </a>
          )}
          {booking.shop.phone && (
            <a className={cn(actionBtn, "flex-1")} href={`tel:${booking.shop.phone}`}>
              <Phone size={16} aria-hidden="true" />
              {tm.callShop}
            </a>
          )}
        </div>
        {!active && bookAgainHref && (
          <Link href={bookAgainHref} className="btn btn-primary mt-1 min-h-11 w-full">
            {tm.bookAgain}
          </Link>
        )}
      </section>

      <p className="m-0 text-center text-xs text-[var(--text-muted)]">{tm.privacyNote}</p>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
        destructive
        title={tm.cancelTitle}
        description={interpolate(tm.cancelDescription, { date: fmtDate(booking.startTime), time: fmtTime(booking.startTime) })}
        confirmLabel={tm.cancelConfirm}
        cancelLabel={tm.cancelKeep}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            {tm.cancelReasonLabel} <span className="text-[var(--text-muted)]">({t.common.optional})</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={2}
            maxLength={500}
            placeholder={tm.cancelReasonPlaceholder}
            className="focus-ring w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)]"
          />
        </label>
      </ConfirmDialog>

      {moveOpen && token && (
        <RescheduleDialog
          token={token}
          booking={booking}
          rpc={rpc}
          onClose={() => setMoveOpen(false)}
          onDone={async (startIso) => {
            setMoveOpen(false);
            toast.success(interpolate(tm.rescheduledToast, { date: fmtDate(startIso), time: fmtTime(startIso) }));
            await load();
          }}
          fmtDate={fmtDate}
          fmtTime={fmtTime}
          codeText={codeText}
        />
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { dir, FF } = useTranslation();
  return (
    <main dir={dir} style={{ fontFamily: FF }} className="min-h-dvh bg-[var(--bg-secondary)] px-4 py-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">{children}</div>
    </main>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 text-sm text-[var(--text-primary)]">
        <p className="m-0 text-xs font-medium text-[var(--text-muted)]">{label}</p>
        <p className="m-0 mt-0.5 break-words">{children}</p>
      </div>
    </div>
  );
}

function RescheduleDialog({
  token,
  booking,
  rpc,
  onClose,
  onDone,
  fmtDate,
  fmtTime,
  codeText,
}: {
  token: string;
  booking: ManageBooking;
  rpc: Rpc;
  onClose: () => void;
  onDone: (startIso: string) => void | Promise<void>;
  fmtDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  fmtTime: (iso: string) => string;
  codeText: (code: string | null, fallback: string) => string;
}) {
  const { t } = useTranslation();
  const tm = t.manageBooking;
  const dates = useMemo(() => rescheduleDates(new Date(), booking.timezone, 14), [booking.timezone]);
  const [date, setDate] = useState(dates[0]);
  const [anyBarber, setAnyBarber] = useState(!booking.barber);
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [picked, setPicked] = useState<AvailableSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setSlotsError(false);
    setPicked(null);
    getAvailableSlots({ rpc } as unknown as AvailabilityClient, {
      shopId: booking.shop.id,
      dateFrom: date,
      dateTo: date,
      items: booking.serviceIds,
      barberId: anyBarber ? null : booking.barber?.id ?? null,
    })
      .then((s) => {
        if (!alive) return;
        const currentStart = new Date(booking.startTime).getTime();
        setSlots(s.filter((x) => new Date(x.startIso).getTime() !== currentStart));
      })
      .catch(() => alive && setSlotsError(true));
    return () => {
      alive = false;
    };
  }, [rpc, booking, date, anyBarber, reloadKey]);

  async function save() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      const barber = anyBarber ? picked.barberIds[0] ?? null : booking.barber?.id ?? null;
      const { data, error: err } = await rpc("reschedule_by_token", {
        p_token: token,
        p_date: picked.localDate,
        p_start: picked.localTime,
        p_barber_id: barber,
      });
      if (err) throw err;
      const start = (data as { start_time?: string } | null)?.start_time ?? picked.startIso;
      await onDone(start);
    } catch (err) {
      const code = rpcErrorCode(err);
      setError(codeText(code, t.error.message));
      if (code === "SLOT_TAKEN") setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={tm.rescheduleTitle}
      description={tm.rescheduleDescription}
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary min-h-11" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary min-h-11" onClick={save} disabled={!picked || saving}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {picked ? interpolate(tm.rescheduleConfirm, { time: fmtTime(picked.startIso) }) : tm.pickTime}
          </button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        {booking.barber && (
          <div role="radiogroup" aria-label={tm.barberLabel} className="flex gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={anyBarber === v}
                onClick={() => setAnyBarber(v)}
                className={cn(
                  "focus-ring min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors",
                  anyBarber === v ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)]",
                )}
              >
                {v ? tm.anyBarberOption : interpolate(tm.sameBarber, { name: booking.barber!.name })}
              </button>
            ))}
          </div>
        )}

        <div>
          <p className="m-0 mb-2 text-sm font-semibold text-[var(--text-primary)]">{tm.pickDay}</p>
          <div role="radiogroup" aria-label={tm.pickDay} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {dates.map((d) => {
              const noon = `${d}T12:00:00Z`;
              const on = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDate(d)}
                  className={cn(
                    "focus-ring flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border px-2 text-xs transition-colors",
                    on
                      ? "border-[var(--cta-bg)] bg-[var(--cta-bg)] text-[var(--cta-fg)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]",
                  )}
                >
                  <span>{fmtDate(noon, { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-base font-bold">{fmtDate(noon, { day: "numeric", timeZone: "UTC" })}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite">
          <p className="m-0 mb-2 text-sm font-semibold text-[var(--text-primary)]">{tm.pickTime}</p>
          {slotsError ? (
            <EmptyState
              size="sm"
              icon={AlertCircle}
              title={tm.slotsError}
              action={{ label: t.common.retry, onClick: () => setReloadKey((k) => k + 1), icon: RefreshCw }}
            />
          ) : slots === null ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true" aria-label={t.common.loading}>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <EmptyState size="sm" icon={CalendarClock} title={tm.noSlots} description={tm.noSlotsHint} />
          ) : (
            <div role="radiogroup" aria-label={tm.pickTime} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const on = picked?.startIso === s.startIso;
                return (
                  <button
                    key={s.startIso}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(s)}
                    className={cn(
                      "focus-ring min-h-11 rounded-xl border text-sm font-semibold transition-colors",
                      on
                        ? "border-[var(--cta-bg)] bg-[var(--cta-bg)] text-[var(--cta-fg)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
                    )}
                  >
                    <bdi>{fmtTime(s.startIso)}</bdi>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="m-0 flex items-start gap-2 text-sm text-[var(--color-error)]">
            <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
