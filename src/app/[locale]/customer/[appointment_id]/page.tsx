"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarX,
  Compass,
  Info,
  MapPin,
  Phone,
  Scissors,
  UserRound,
  Wallet,
  CalendarCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { coverForShop, mapsUrl, telHref } from "../../shop/shop-utils";
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
  const { t, dir, isRTL, FF, FFD, href, formatCurrency, formatDate, formatTime } = useTranslation();

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
        router.replace(href("/auth/login"));
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
    <header className="fixed top-0 inset-x-0 z-50 bg-[var(--bg-primary)] h-16 border-b border-[var(--border-subtle)]">
      <div className="flex justify-between items-center gap-3 max-w-3xl mx-auto px-4 sm:px-6 h-full">
        <Link
          href={href("/customer")}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-sm min-w-0"
        >
          <BackIcon size={19} aria-hidden="true" className="shrink-0" />
          <span className="text-sm font-bold truncate">{t.customer.myAppointments}</span>
        </Link>
        <span className="font-bold text-sm truncate">{t.customer.detailTitle}</span>
      </div>
    </header>
  );

  if (status === "loading") {
    return (
      <div className="min-h-dvh bg-[var(--bg-primary)]" dir={dir} style={{ fontFamily: FF }}>
        {header}
        <SkeletonGroup className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
          <Skeleton variant="pill" />
          <Skeleton className="h-36 w-full rounded-[12px]" />
          <Skeleton className="h-64 w-full rounded-[12px]" />
        </SkeletonGroup>
      </div>
    );
  }

  if (status !== "ok" || !appt) {
    const isError = status === "error";
    return (
      <div className="min-h-dvh bg-[var(--bg-primary)]" dir={dir} style={{ fontFamily: FF }}>
        {header}
        <main className="pt-24 max-w-3xl mx-auto px-4 sm:px-6">
          <EmptyState
            icon={CalendarX}
            tone={isError ? "error" : "neutral"}
            headingLevel={2}
            title={isError ? t.customer.loadErrorTitle : t.customer.notFoundTitle}
            description={isError ? t.customer.loadErrorDesc : t.customer.notFoundDesc}
            action={isError ? { label: t.common.retry, onClick: load } : { label: t.customer.backToBookings, href: href("/customer") }}
          />
        </main>
      </div>
    );
  }

  const s = statusOf(appt);
  const tab = classifyAppointment(appt, now);
  const cancelState = cancellationState(appt, now);
  const tz: Intl.DateTimeFormatOptions = { timeZone: appt.shop_timezone || undefined };
  const cover = coverForShop(appt.shop_id);
  const mapHref = mapsUrl(appt.shop_maps_url, appt.shop_address);
  const phoneHref = telHref(appt.shop_phone);
  const deadlineText = cancelState.deadline
    ? formatDate(cancelState.deadline, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", ...tz })
    : "";

  const statusLabel: Record<string, string> = {
    confirmed: t.customer.statusConfirmed,
    pending: t.customer.statusPending,
    cancelled: t.customer.cancelled,
    completed: t.customer.completed,
    no_show: t.customer.statusNoShow,
  };
  const statusColor = s === "cancelled" ? "var(--accent-rose)" : s === "pending" || s === "no_show" ? "var(--text-secondary)" : "var(--accent-text)";

  const rows: { key: string; icon: typeof CalendarDays; label: string; content: React.ReactNode }[] = [
    {
      key: "date",
      icon: CalendarDays,
      label: t.customer.dateTime,
      content: (
        <>
          <p className="font-bold text-lg m-0">
            <time dateTime={appt.start_time}>{formatDate(appt.start_time, { weekday: "long", day: "numeric", month: "long", year: "numeric", ...tz })}</time>
          </p>
          <p className="text-[var(--text-secondary)] text-sm m-0">
            {formatTime(appt.start_time, tz)} – {formatTime(appt.end_time, tz)}
          </p>
        </>
      ),
    },
  ];
  if (appt.service_name) rows.push({ key: "service", icon: Scissors, label: t.customer.service, content: <p className="font-bold m-0">{appt.service_name}</p> });
  if (appt.barber_name) rows.push({ key: "barber", icon: UserRound, label: t.customer.barber, content: <p className="font-bold m-0">{appt.barber_name}</p> });
  if (appt.shop_address || mapHref)
    rows.push({
      key: "location",
      icon: MapPin,
      label: t.customer.location,
      content: (
        <>
          {appt.shop_address && <p className="font-bold m-0">{appt.shop_address}</p>}
          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[var(--accent-text)] underline underline-offset-2 hover:no-underline">
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
        <a href={phoneHref} className="font-bold hover:underline" dir="ltr">
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
        <p className="font-black text-2xl m-0" style={{ fontFamily: FFD }}>
          {formatCurrency(appt.price, appt.currency)}
        </p>
        <p className="text-xs text-[var(--text-secondary)] m-0">{t.customer.payInStore}</p>
      </>
    ),
  });

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-dvh" dir={dir} style={{ fontFamily: FF }}>
      {header}

      <main className="pt-20 pb-28 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-5 pt-4 flex-wrap">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--bg-secondary)]" style={{ color: statusColor }}>
            {statusLabel[s] ?? s}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {interpolate(t.customer.reference, { ref: appt.id.slice(0, 7).toUpperCase() })}
          </span>
        </div>

        <article className="bg-[var(--bg-primary)] rounded-[12px] border border-[var(--border-subtle)] overflow-hidden mb-6">
          <div className="p-6 sm:p-8" style={{ background: cover.bg }}>
            <p className="text-xs font-bold mb-1 opacity-70" style={{ color: cover.fg }}>
              {t.customer.yourAppointment}
            </p>
            <h1 className="font-black text-2xl sm:text-3xl m-0 break-words" style={{ color: cover.fg, fontFamily: FFD }}>
              {appt.shop_name}
            </h1>
          </div>

          <dl className="px-5 sm:px-6 divide-y divide-[var(--border-subtle)] m-0">
            {rows.map(({ key, icon: Icon, label, content }) => (
              <div key={key} className="flex justify-between items-start gap-4 py-5">
                <div className="min-w-0">
                  <dt className="text-xs font-bold text-[var(--text-muted)] mb-1">{label}</dt>
                  <dd className="m-0 break-words">{content}</dd>
                </div>
                <Icon size={20} aria-hidden="true" className="text-[var(--text-muted)] shrink-0" />
              </div>
            ))}
          </dl>
        </article>

        {/* Policy note */}
        {tab === "upcoming" && cancelState.deadline && (
          <p className="flex items-start gap-2 text-sm text-[var(--text-secondary)] mb-5 rounded-[12px] bg-[var(--bg-secondary)] px-4 py-3">
            <Info size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
            {cancelState.canCancel
              ? interpolate(t.customer.freeCancelUntil, { date: deadlineText })
              : interpolate(t.customer.cancelWindowClosed, { hours: cancelState.policyHours })}
          </p>
        )}
        {s === "cancelled" && appt.cancelled_at && (
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            {interpolate(t.customer.cancelledOn, { date: formatDate(appt.cancelled_at, { day: "numeric", month: "long", year: "numeric", ...tz }) })}
          </p>
        )}

        <div className="flex gap-3 flex-col sm:flex-row">
          {tab === "upcoming" && cancelState.canCancel && (
            <>
              <Link href={href(`/book/${appt.shop_id}?reschedule=${appt.id}`)} className="btn btn-primary flex-1">
                {t.customer.reschedule}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCancelReason("");
                  setShowCancelConfirm(true);
                }}
                className="btn flex-1 border"
                style={{ color: "var(--accent-rose)", borderColor: "var(--accent-rose-muted)", background: "var(--bg-primary)" }}
              >
                {t.customer.cancelConfirm}
              </button>
            </>
          )}
          {tab === "upcoming" && !cancelState.canCancel && phoneHref && (
            <a href={phoneHref} className="btn btn-primary flex-1">
              <Phone size={16} aria-hidden="true" />
              {t.customer.callShop}
            </a>
          )}
          {tab !== "upcoming" && (
            <Link href={href(`/book/${appt.shop_id}`)} className="btn btn-primary flex-1">
              {t.customer.bookAgain}
            </Link>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href={href(`/shop/${appt.shop_id}`)}
            className="text-sm font-bold text-[var(--text-secondary)] underline underline-offset-4 decoration-2 hover:text-[var(--text-primary)] transition-colors"
          >
            {t.customer.viewShop}
          </Link>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label={t.customer.accountNav}
        className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center px-4 pt-2.5 md:hidden bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <Link className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-secondary)] rounded-[8px]" href={href("/explore")}>
          <Compass size={21} aria-hidden="true" />
          {t.customer.explore}
        </Link>
        <Link className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-primary)] rounded-[8px]" href={href("/customer")}>
          <span aria-hidden="true" className="w-10 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <CalendarCheck size={19} />
          </span>
          {t.explore.navBookings}
        </Link>
        <Link className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-secondary)] rounded-[8px]" href={href("/customer?edit=profile")}>
          <UserRound size={21} aria-hidden="true" />
          {t.explore.navAccount}
        </Link>
      </nav>

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
        <div className="space-y-3 text-start">
          {cancelState.deadline && cancelState.canCancel && (
            <p className="text-xs text-[var(--text-secondary)] m-0">{interpolate(t.customer.freeCancelUntil, { date: deadlineText })}</p>
          )}
          <div>
            <label htmlFor="detail-cancel-reason" className="field-label">
              {t.customer.cancelReasonLabel}
            </label>
            <input
              id="detail-cancel-reason"
              type="text"
              className="field-input w-full"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value.slice(0, REASON_MAX))}
              placeholder={t.customer.cancelReasonPlaceholder}
              maxLength={REASON_MAX}
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
