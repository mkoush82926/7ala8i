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
import { Pill, type PillTone } from "@/components/ui/pill";
import { buttonClasses, cardClasses, textareaClasses } from "@/components/ui/recipes";
import { toast } from "@/components/ui/toast";
import { placeholderFill, placeholderInitials } from "@/components/ui/photo-frame";
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

const card = cardClasses({ elevation: "card", className: "p-5 sm:p-6" });
const actionBtn = buttonClasses({ variant: "secondary", className: "w-full" });

// §5.5 status tones: confirmed → brand, pending → warning, completed → success,
// no-show → danger, cancelled/past → neutral. Always icon + label.
const STATE_TONE: Record<ManageState, PillTone> = {
  upcoming: "brand",
  pending: "warning",
  cancelled: "neutral",
  completed: "success",
  no_show: "danger",
  past: "neutral",
  in_progress: "brand",
};
const STATE_ICON: Record<ManageState, typeof MapPin> = {
  upcoming: CheckCircle2,
  pending: Clock3,
  cancelled: XCircle,
  completed: CheckCircle2,
  no_show: AlertCircle,
  past: CalendarClock,
  in_progress: Scissors,
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
  const shopFill = placeholderFill(booking.shop.id);
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
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATE_TONE[st]} size="md" icon={React.createElement(STATE_ICON[st], { "aria-hidden": true })}>
            {tm.states[st]}
          </Pill>
          <span className="text-meta text-ink-muted">
            {booking.clientName ? interpolate(tm.greeting, { name: booking.clientName }) : tm.title}
          </span>
        </div>
        <div>
          <h1
            className="text-h1 m-0 text-ink"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "-0.02em") }}
          >
            {fmtDate(booking.startTime)}
          </h1>
          <p className="m-0 mt-1 text-lg font-semibold tabular-nums text-ink-soft">
            <bdi>
              {fmtTime(booking.startTime)} – {fmtTime(booking.endTime)}
            </bdi>
          </p>
        </div>
      </header>

      <section aria-label={tm.detailsLabel} className={cn(card, "flex flex-col gap-4")}>
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-lg text-base font-extrabold"
            style={{
              backgroundImage: `repeating-linear-gradient(135deg, ${shopFill.hatch} 0 2px, transparent 2px 12px), ${shopFill.bg}`,
              color: shopFill.fg,
            }}
          >
            {placeholderInitials(shopName)}
          </span>
          <p className="text-title m-0 min-w-0 truncate text-ink">{shopName}</p>
        </div>
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
          <div className="flex items-center justify-between border-t border-line pt-4">
            <span className="text-[15px] font-semibold text-ink">{tm.totalLabel}</span>
            <span className="text-lg font-bold tabular-nums text-ink">
              <bdi>{formatJOD(booking.price, locale)}</bdi>
            </span>
          </div>
        )}
      </section>

      {active && policyText && (
        <div className="flex items-start gap-3 rounded-xl bg-sunken p-4 text-sm text-ink-soft">
          <Clock3 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="m-0">
            {policyText}
            {booking.policy.feePercent > 0 && ` ${interpolate(tm.policyFee, { percent: booking.policy.feePercent })}`}
            {booking.canCancel && deadlineHours > 0 && deadlineHours < 24 && ` ${interpolate(tm.policyHoursLeft, { hours: deadlineHours })}`}
          </p>
        </div>
      )}

      {active && (
        <section aria-label={tm.actionsLabel} className="flex flex-col gap-3">
          {booking.canConfirm && (
            <button
              type="button"
              className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true })}
              onClick={confirm}
              disabled={busy === "confirm"}
              aria-busy={busy === "confirm" || undefined}
            >
              {busy === "confirm" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              {tm.confirmCta}
            </button>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={buttonClasses({ variant: booking.canConfirm ? "secondary" : "primary", size: "lg", fullWidth: true })}
              onClick={() => setMoveOpen(true)}
              disabled={!booking.canReschedule}
            >
              <CalendarClock aria-hidden="true" />
              {tm.rescheduleCta}
            </button>
            <button
              type="button"
              className={buttonClasses({ variant: "destructive-soft", size: "lg", fullWidth: true })}
              onClick={() => setCancelOpen(true)}
              disabled={!booking.canCancel}
            >
              <XCircle aria-hidden="true" />
              {tm.cancelCta}
            </button>
          </div>
        </section>
      )}

      <section aria-label={tm.moreLabel} className={cn(card, "flex flex-col gap-3")}>
        {active && calendar && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" className={actionBtn} onClick={downloadIcs}>
              <CalendarPlus aria-hidden="true" />
              {tm.addToCalendar}
            </button>
            <a className={actionBtn} href={calendar.google} target="_blank" rel="noopener noreferrer">
              <CalendarPlus aria-hidden="true" />
              {tm.googleCalendar}
            </a>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {directions && (
            <a className={actionBtn} href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" className="rtl:-scale-x-100" />
              {tm.directions}
            </a>
          )}
          {waHref && (
            <a className={actionBtn} href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              {tm.messageShop}
            </a>
          )}
          {booking.shop.phone && (
            <a className={actionBtn} href={`tel:${booking.shop.phone}`}>
              <Phone aria-hidden="true" />
              {tm.callShop}
            </a>
          )}
        </div>
        {!active && bookAgainHref && (
          <Link href={bookAgainHref} className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true, className: "mt-1" })}>
            {tm.bookAgain}
          </Link>
        )}
      </section>

      <p className="text-meta m-0 text-center text-ink-muted">{tm.privacyNote}</p>

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
          <span className="font-semibold text-ink">
            {tm.cancelReasonLabel} <span className="text-ink-muted">({t.common.optional})</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={2}
            maxLength={500}
            placeholder={tm.cancelReasonPlaceholder}
            className={textareaClasses({ className: "min-h-20" })}
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
    <main dir={dir} style={{ fontFamily: FF }} className="min-h-dvh bg-page px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">{children}</div>
    </main>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 text-[15px] text-ink">
        <p className="text-meta m-0 text-ink-muted">{label}</p>
        <p className="m-0 mt-0.5 break-words font-medium">{children}</p>
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
          <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="button" className={buttonClasses({ variant: "primary" })} onClick={save} disabled={!picked || saving} aria-busy={saving || undefined}>
            {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {picked ? interpolate(tm.rescheduleConfirm, { time: fmtTime(picked.startIso) }) : tm.pickTime}
          </button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        {booking.barber && (
          <div role="radiogroup" aria-label={tm.barberLabel} className="flex gap-1 rounded-full bg-sunken p-1">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={anyBarber === v}
                onClick={() => setAnyBarber(v)}
                className={cn(
                  "focus-ring min-h-10 flex-1 rounded-full px-3 text-sm font-semibold transition-colors",
                  anyBarber === v ? "bg-card text-ink shadow-xs" : "text-ink-muted hover:text-ink",
                )}
              >
                {v ? tm.anyBarberOption : interpolate(tm.sameBarber, { name: booking.barber!.name })}
              </button>
            ))}
          </div>
        )}

        <div>
          <p className="m-0 mb-2 text-sm font-semibold text-ink">{tm.pickDay}</p>
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
                    "focus-ring flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border px-2 text-xs transition-colors",
                    on
                      ? "border-inverse bg-inverse text-on-inverse"
                      : "border-line bg-card text-ink hover:border-ink",
                  )}
                >
                  <span>{fmtDate(noon, { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-lg font-bold tabular-nums">{fmtDate(noon, { day: "numeric", timeZone: "UTC" })}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite">
          <p className="m-0 mb-2 text-sm font-semibold text-ink">{tm.pickTime}</p>
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
                <Skeleton key={i} className="h-11 rounded-full" />
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
                      "focus-ring h-11 rounded-full border text-sm font-semibold tabular-nums transition-colors",
                      on
                        ? "border-brand bg-brand text-on-brand"
                        : "border-line-strong bg-card text-ink hover:border-ink",
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
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger-text">
            <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
