"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Clock,
  Compass,
  Info,
  MapPin,
  Phone,
  Repeat,
  Scissors,
  UserRound,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { StickyBar } from "@/components/ui/sticky-bar";
import { buttonClasses, focusRing, inputClasses, labelClasses, textLinkClasses } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { mapsUrl, telHref } from "../../shop/shop-utils";
import { cancellationState, classifyAppointment, errorMessageFor, rpcErrorCode, statusOf } from "../customer-utils";

interface AppointmentDetail {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  shop_maps_url: string | null;
  shop_timezone: string | null;
  cancellation_policy_hours: number | null;
  barber_name: string | null;
  service_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  currency: string;
  cancelled_at: string | null;
}

const REASON_MAX = 200;

export default function BookingDetailPage() {
  const params = useParams();
  const appointmentId = params.appointment_id as string;
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { t, dir, isRTL, FF, href, formatCurrency, formatDate, formatTime } = useTranslation();

  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "error">("loading");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(href("/customer/login"));
        return;
      }

      // RLS: customers can only read appointments on client rows linked to
      // their account (clients.auth_user_id), so "not yours" == "not found".
      const { data: row, error } = await supabase
        .from("appointments")
        .select("id, shop_id, barber_id, service_name, start_time, end_time, status, price, currency, cancelled_at")
        .eq("id", appointmentId)
        .maybeSingle();

      if (error) {
        setStatus(error.code === "22P02" ? "not_found" : "error");
        return;
      }
      if (!row) {
        setStatus("not_found");
        return;
      }

      const [shopRes, barberRes] = await Promise.all([
        supabase
          .from("shops")
          .select("name, address, phone, google_maps_url, timezone, currency, cancellation_policy_hours")
          .eq("id", row.shop_id)
          .maybeSingle(),
        row.barber_id
          ? supabase.from("profiles").select("full_name").eq("id", row.barber_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const shop = shopRes.data as {
        name: string;
        address: string | null;
        phone: string | null;
        google_maps_url: string | null;
        timezone: string | null;
        currency: string | null;
        cancellation_policy_hours: number | null;
      } | null;

      setAppt({
        id: row.id,
        shop_id: row.shop_id,
        shop_name: shop?.name || "—",
        shop_address: shop?.address || null,
        shop_phone: shop?.phone || null,
        shop_maps_url: shop?.google_maps_url || null,
        shop_timezone: shop?.timezone || null,
        cancellation_policy_hours: shop?.cancellation_policy_hours ?? null,
        barber_name: (barberRes.data as { full_name: string | null } | null)?.full_name || null,
        service_name: row.service_name || null,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.status,
        price: Number(row.price) || 0,
        currency: row.currency || shop?.currency || "JOD",
        cancelled_at: row.cancelled_at ?? null,
      });
      setNow(new Date());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [supabase, appointmentId, router, href]);

  useEffect(() => {
    // Data fetch on mount; the loader sets state after awaiting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function confirmCancel() {
    if (!appt) return;
    const { data, error } = await supabase.rpc("cancel_customer_booking", {
      p_appointment_id: appt.id,
      p_reason: cancelReason.trim() ? cancelReason.trim().slice(0, REASON_MAX) : null,
    });
    if (error) {
      const code = rpcErrorCode(error);
      if (code === "INSIDE_CANCELLATION_WINDOW") {
        const hours = Number((error as { details?: string }).details) || appt.cancellation_policy_hours || 0;
        throw new Error(interpolate(t.customer.cancelWindowClosed, { hours }));
      }
      throw new Error(errorMessageFor(t.error, code));
    }
    const cancelledAt = (data as { cancelled_at?: string } | null)?.cancelled_at ?? new Date().toISOString();
    setAppt((prev) => (prev ? { ...prev, status: "cancelled", cancelled_at: cancelledAt } : prev));
    setShowCancelConfirm(false);
    setCancelReason("");
    toast.success(t.customer.appointmentCancelled);
  }

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const header = (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-full max-w-xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={href("/customer")} className={buttonClasses({ variant: "ghost", size: "sm", className: "-ms-3 min-w-0" })}>
          <BackIcon aria-hidden="true" />
          <span className="truncate">{t.customer.myAppointments}</span>
        </Link>
        <span className="truncate text-sm font-semibold text-ink">{t.customer.detailTitle}</span>
      </div>
    </header>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-page text-ink" dir={dir} style={{ fontFamily: FF }}>
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>
      {header}
      {children}
    </div>
  );

  if (status === "loading") {
    return shell(
      <SkeletonGroup className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton variant="pill" className="h-6 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </SkeletonGroup>,
    );
  }

  if (status !== "ok" || !appt) {
    const isError = status === "error";
    return shell(
      <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-10 outline-none sm:px-6">
        <EmptyState
          icon={CalendarX}
          tone={isError ? "error" : "neutral"}
          headingLevel={2}
          title={isError ? t.customer.loadErrorTitle : t.customer.notFoundTitle}
          description={isError ? t.customer.loadErrorDesc : t.customer.notFoundDesc}
          action={isError ? { label: t.common.retry, onClick: load } : { label: t.customer.backToBookings, href: href("/customer") }}
          secondaryAction={isError ? undefined : { label: t.customer.exploreShops, href: href("/explore"), icon: Compass }}
        />
      </main>,
    );
  }

  const s = statusOf(appt);
  const tab = classifyAppointment(appt, now);
  const cancelState = cancellationState(appt, now);
  const tz: Intl.DateTimeFormatOptions = { timeZone: appt.shop_timezone || undefined };
  const mapHref = mapsUrl(appt.shop_maps_url, appt.shop_address);
  const phoneHref = telHref(appt.shop_phone);
  const deadlineText = cancelState.deadline
    ? formatDate(cancelState.deadline, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", ...tz })
    : "";

  const statusMeta: Record<string, { label: string; tone: PillTone }> = {
    confirmed: { label: t.customer.statusConfirmed, tone: "brand" },
    pending: { label: t.customer.statusPending, tone: "warning" },
    cancelled: { label: t.customer.cancelled, tone: "neutral" },
    completed: { label: t.customer.completed, tone: "success" },
    no_show: { label: t.customer.statusNoShow, tone: "danger" },
  };
  const badge = statusMeta[s] ?? { label: s, tone: "neutral" as PillTone };

  const rows: { key: string; icon: typeof CalendarDays; label: string; content: React.ReactNode }[] = [];
  if (appt.service_name) rows.push({ key: "service", icon: Scissors, label: t.customer.service, content: <p className="m-0 font-semibold">{appt.service_name}</p> });
  if (appt.barber_name) rows.push({ key: "barber", icon: UserRound, label: t.customer.barber, content: <p className="m-0 font-semibold">{appt.barber_name}</p> });
  if (appt.shop_address || mapHref)
    rows.push({
      key: "location",
      icon: MapPin,
      label: t.customer.location,
      content: (
        <>
          {appt.shop_address && <p className="m-0 font-semibold">{appt.shop_address}</p>}
          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className={cn("mt-1 inline-block rounded-sm text-sm", textLinkClasses, focusRing)}>
              {t.shopPage.viewOnMap}
            </a>
          )}
        </>
      ),
    });
  if (phoneHref)
    rows.push({
      key: "contact",
      icon: Phone,
      label: t.customer.contact,
      content: (
        <a href={phoneHref} className={cn("rounded-sm font-semibold tabular-nums text-ink hover:underline", focusRing)} dir="ltr">
          {appt.shop_phone}
        </a>
      ),
    });
  rows.push({
    key: "total",
    icon: Wallet,
    label: t.customer.total,
    content: (
      <>
        <p className="m-0 text-xl font-bold tabular-nums text-ink">{formatCurrency(appt.price, appt.currency)}</p>
        <p className="text-meta m-0">{t.customer.payInStore}</p>
      </>
    ),
  });

  const openCancel = () => {
    setCancelReason("");
    setShowCancelConfirm(true);
  };

  // One primary per surface; rendered inline (md+) and in the sticky bar (phones).
  const actions = (size: "md" | "xl") => {
    if (tab === "upcoming" && cancelState.canCancel) {
      return (
        <>
          <Link
            href={href(`/book/${appt.shop_id}?reschedule=${appt.id}`)}
            className={buttonClasses({ variant: "primary", size, className: "flex-1" })}
          >
            <CalendarClock aria-hidden="true" />
            {t.customer.reschedule}
          </Link>
          <Button variant="destructive-soft" size={size} className="flex-1" onClick={openCancel}>
            {t.customer.cancelConfirm}
          </Button>
        </>
      );
    }
    if (tab === "upcoming" && phoneHref) {
      return (
        <a href={phoneHref} className={buttonClasses({ variant: "primary", size, className: "flex-1" })}>
          <Phone aria-hidden="true" />
          {t.customer.callShop}
        </a>
      );
    }
    if (tab !== "upcoming") {
      return (
        <Link href={href(`/book/${appt.shop_id}`)} className={buttonClasses({ variant: "primary", size, className: "flex-1" })}>
          <Repeat aria-hidden="true" />
          {t.customer.bookAgain}
        </Link>
      );
    }
    return null;
  };
  const hasActions = actions("md") !== null;

  return shell(
    <>
      <main id="main" tabIndex={-1} className={cn("mx-auto max-w-xl space-y-5 px-4 pt-8 outline-none sm:px-6", hasActions ? "pb-32 md:pb-12" : "pb-12")}>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone={badge.tone} size="md">
              {badge.label}
            </Pill>
            <span className="text-meta">{interpolate(t.customer.reference, { ref: appt.id.slice(0, 7).toUpperCase() })}</span>
          </div>
          <h1 className="text-h1 m-0 text-ink">
            <time dateTime={appt.start_time}>
              {formatDate(appt.start_time, { weekday: "long", day: "numeric", month: "long", ...tz })}
            </time>
          </h1>
          <p className="text-body-lg m-0 mt-1 tabular-nums text-ink-soft">
            {formatTime(appt.start_time, tz)} – {formatTime(appt.end_time, tz)}
            <span aria-hidden="true" className="mx-1.5 text-ink-disabled">·</span>
            {formatDate(appt.start_time, { year: "numeric", ...tz })}
          </p>
        </div>

        <article aria-labelledby="appt-shop" className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
          <PhotoFrame alt="" ratio="3/1" seed={appt.shop_id} fallbackName={appt.shop_name} scrim initialsClassName="hidden">
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p className="m-0 text-[13px] font-medium text-white/85">{t.customer.yourAppointment}</p>
              <h2 id="appt-shop" className="m-0 break-words text-[22px] font-bold leading-7 text-white rtl:leading-8">
                {appt.shop_name}
              </h2>
            </div>
          </PhotoFrame>

          <dl className="m-0 divide-y divide-line px-4 sm:px-5">
            {rows.map(({ key, icon: Icon, label, content }) => (
              <div key={key} className="flex items-start gap-3 py-4">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-meta mb-0.5">{label}</dt>
                  <dd className="m-0 break-words text-[15px] text-ink">{content}</dd>
                </div>
              </div>
            ))}
          </dl>
        </article>

        {/* Policy note */}
        {tab === "upcoming" && cancelState.deadline && (
          <p className="m-0 flex items-start gap-2.5 rounded-xl bg-sunken p-4 text-sm leading-[22px] text-ink-soft">
            <Clock size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
            {cancelState.canCancel
              ? interpolate(t.customer.freeCancelUntil, { date: deadlineText })
              : interpolate(t.customer.cancelWindowClosed, { hours: cancelState.policyHours })}
          </p>
        )}
        {s === "cancelled" && appt.cancelled_at && (
          <p className="m-0 flex items-start gap-2.5 rounded-xl bg-sunken p-4 text-sm text-ink-soft">
            <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
            {interpolate(t.customer.cancelledOn, { date: formatDate(appt.cancelled_at, { day: "numeric", month: "long", year: "numeric", ...tz }) })}
          </p>
        )}

        {hasActions && <div className="hidden gap-3 md:flex">{actions("md")}</div>}

        <div className="pt-2 text-center">
          <Link href={href(`/shop/${appt.shop_id}`)} className={cn("rounded-sm text-sm", textLinkClasses, focusRing)}>
            {t.customer.viewShop}
          </Link>
        </div>
      </main>

      {hasActions && (
        <StickyBar label={t.customer.detailTitle} hideAt="md" maxWidth="sm">
          <div className="flex w-full gap-2">{actions("xl")}</div>
        </StickyBar>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={confirmCancel}
        destructive
        title={t.customer.cancelTitle}
        description={t.customer.cancelDesc}
        confirmLabel={t.customer.cancelConfirm}
        cancelLabel={t.customer.keepAppointment}
      >
        <div className="space-y-4 text-start">
          {cancelState.deadline && cancelState.canCancel && (
            <p className="m-0 text-[13px] text-ink-muted">{interpolate(t.customer.freeCancelUntil, { date: deadlineText })}</p>
          )}
          <div>
            <label htmlFor="detail-cancel-reason" className={labelClasses}>
              {t.customer.cancelReasonLabel}
            </label>
            <input
              id="detail-cancel-reason"
              type="text"
              className={inputClasses()}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value.slice(0, REASON_MAX))}
              placeholder={t.customer.cancelReasonPlaceholder}
              maxLength={REASON_MAX}
            />
          </div>
        </div>
      </ConfirmDialog>
    </>,
  );
}
