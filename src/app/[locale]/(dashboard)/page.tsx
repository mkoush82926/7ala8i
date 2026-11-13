"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { isToday } from "date-fns";
import {
  CheckCircle,
  UserX,
  XCircle,
  Loader2,
  CalendarCheck,
  CalendarPlus,
  UserPlus,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { DailyReceipt } from "@/components/dashboard/daily-receipt";
import { CheckoutDialog, type CheckoutTarget } from "@/components/dashboard/checkout-dialog";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ChartSkeleton, DashboardSkeleton, TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { usePos, useDashboardVersion, errorMessageFor } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";

// recharts is ~100 kB; load it after the rest of the overview has painted.
const SalesChart = dynamic(() => import("@/components/dashboard/sales-chart").then((m) => m.SalesChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

interface Appt {
  id: string;
  client: string;
  service: string;
  barberId: string | null;
  startTime: string;
  price: number;
  status: AppointmentStatus;
}

type PendingAction = { kind: "cancel" | "no_show"; appt: Appt } | null;

const UPCOMING_LIMIT = 8;

function UpcomingAppointments() {
  const { t, isRTL, FFD, href, formatCurrency, formatTime, formatDate } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const version = useDashboardVersion();
  const { currency } = useShopSettings();
  const { markPaid, markNoShow, cancelAppointment, loadingId } = usePos();
  const [supabase] = useState(() => createClient());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<PendingAction>(null);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);

  const { data, initialLoading, error, refetch } = useSupabaseQuery<Appt[]>(
    async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, start_time, barber_id, status, price, service_name")
        .eq("shop_id", shopId)
        .gte("start_time", new Date().toISOString())
        .in("status", ["pending", "confirmed"])
        .order("start_time", { ascending: true })
        .limit(UPCOMING_LIMIT);
      if (error) return { data: null, error: { message: error.message } };
      const rows = (data ?? []) as {
        id: string;
        client_name: string | null;
        start_time: string;
        barber_id: string | null;
        status: string | null;
        price: number | string | null;
        service_name: string | null;
      }[];
      return {
        data: rows.map((a) => ({
          id: a.id,
          client: a.client_name ?? "",
          service: a.service_name ?? "",
          barberId: a.barber_id,
          startTime: a.start_time,
          price: Number(a.price) || 0,
          status: normalizeAppointmentStatus(a.status) ?? "confirmed",
        })),
        error: null,
      };
    },
    [shopId, version],
    { enabled: !!shopId },
  );

  const appointments = (data ?? []).filter((a) => !hidden.has(a.id));

  const barberName = (id: string | null) => barbers.find((b) => b.id === id)?.name || t.dashboard.anyBarber;
  const serviceName = (a: Appt) => a.service || t.dashboard.appointment;
  const whenLabel = (iso: string) => {
    const d = new Date(iso);
    return isToday(d) ? formatTime(d) : `${formatDate(d, "dayMonth")} · ${formatTime(d)}`;
  };

  // Rows disappear immediately after a successful action; the refetch that
  // follows (via the dashboard version) reconciles with the server.
  const hideRow = (id: string) => setHidden((prev) => new Set(prev).add(id));

  async function confirmPending() {
    if (!pending) return;
    const { kind, appt } = pending;
    const res = kind === "cancel" ? await cancelAppointment(appt.id) : await markNoShow(appt.id);
    if (!res.ok) throw new Error(errorMessageFor(t, res.code));
    hideRow(appt.id);
    toast.success(kind === "cancel" ? t.dashboard.cancelledToast : t.dashboard.noShowToast);
  }

  async function confirmCheckout(method: "cash" | "card") {
    if (!checkout) return { ok: false as const, code: "INTERNAL" };
    const res = await markPaid({ appointmentId: checkout.id, method });
    if (res.ok) {
      hideRow(checkout.id);
      toast.success(t.dashboard.paidToast);
    }
    return res;
  }

  const openCheckout = (a: Appt) =>
    setCheckout({
      id: a.id,
      clientName: a.client,
      serviceName: serviceName(a),
      amount: a.price,
      currency,
      whenLabel: whenLabel(a.startTime),
    });

  function renderActions(a: Appt, compact = false) {
    const busy = loadingId === a.id;
    const btn = cn(
      "grid place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      compact ? "size-11" : "size-11 lg:size-9",
    );
    return (
      <div
        className={cn(
          "flex items-center gap-1.5",
          !compact && "justify-end opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
        )}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => openCheckout(a)}
          aria-label={`${t.dashboard.markPaid}: ${a.client}`}
          title={t.dashboard.markPaid}
          className={cn(btn, "text-[var(--accent-text)] hover:bg-[var(--bg-secondary)]")}
        >
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={20} aria-hidden="true" />}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPending({ kind: "no_show", appt: a })}
          aria-label={`${t.dashboard.markNoShow}: ${a.client}`}
          title={t.dashboard.markNoShow}
          className={cn(btn, "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]")}
        >
          <UserX size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPending({ kind: "cancel", appt: a })}
          aria-label={`${t.dashboard.cancelAppointment}: ${a.client}`}
          title={t.dashboard.cancelAppointment}
          className={cn(btn, "text-[var(--accent-rose)] hover:bg-[var(--accent-rose-muted)]")}
        >
          <XCircle size={20} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const cols = [
    t.calendar.client,
    t.calendar.service,
    t.calendar.barber,
    t.calendar.time,
    t.dashboard.price,
    t.calendar.status,
  ];

  let body: React.ReactNode;
  if (initialLoading) {
    body = (
      <>
        <div className="md:hidden">
          <TableRowsSkeleton rows={4} columns={3} />
        </div>
        <table className="hidden w-full md:table">
          <tbody>
            <TableRowsSkeleton asRows rows={5} columns={7} />
          </tbody>
        </table>
      </>
    );
  } else if (error) {
    body = (
      <EmptyState
        bare
        size="sm"
        tone="error"
        icon={AlertTriangle}
        title={t.dashboard.upcomingError}
        description={t.error.message}
        action={{ label: t.common.retry, onClick: refetch, icon: RefreshCw }}
      />
    );
  } else if (appointments.length === 0) {
    body = (
      <EmptyState
        bare
        size="sm"
        icon={CalendarCheck}
        title={t.dashboard.noUpcoming}
        description={t.dashboard.noUpcomingHint}
        action={{ label: t.sidebar.bookAppointment, href: href("/calendar"), icon: CalendarPlus }}
      />
    );
  } else {
    body = (
      <>
        {/* Phones: stacked cards with always-visible, 44px actions */}
        <ul className="m-0 list-none divide-y divide-[var(--border-subtle)] p-0 md:hidden">
          {appointments.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[15px] font-extrabold text-[var(--text-primary)]">{a.client}</p>
                  <p className="m-0 mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">
                    {serviceName(a)} · {barberName(a.barberId)}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="m-0 text-[14px] font-extrabold tabular-nums text-[var(--text-primary)]">
                    {whenLabel(a.startTime)}
                  </p>
                  <p className="m-0 mt-0.5 text-[13px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    {formatCurrency(a.price, currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={a.status} />
                {renderActions(a, true)}
              </div>
            </li>
          ))}
        </ul>

        {/* md+: table. One logical column order; `dir` mirrors it in Arabic. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-start">
            <caption className="sr-only">{t.dashboard.upcomingAppointments}</caption>
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                {cols.map((col, i) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn(
                      "px-5 py-4 text-start text-[11px] font-bold text-[var(--text-secondary)] lg:px-6",
                      !isRTL && "uppercase tracking-[0.12em]",
                      i === 2 && "hidden lg:table-cell",
                    )}
                  >
                    {col}
                  </th>
                ))}
                <th scope="col" className="px-5 py-4 text-end lg:px-6">
                  <span className="sr-only">{t.dashboard.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {appointments.map((a) => (
                <tr key={a.id} className="table-row-hover group transition-colors">
                  <td className="px-5 py-4 lg:px-6">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[12px] font-extrabold text-[var(--text-primary)]"
                      >
                        {getInitials(a.client || "?")}
                      </span>
                      <span className="text-[14px] font-extrabold text-[var(--text-primary)]">{a.client}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[14px] font-semibold text-[var(--text-primary)] lg:px-6">{serviceName(a)}</td>
                  <td className="hidden px-5 py-4 text-[14px] font-semibold text-[var(--text-secondary)] lg:table-cell lg:px-6">
                    {barberName(a.barberId)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] font-bold tabular-nums text-[var(--text-primary)] lg:px-6">
                    {whenLabel(a.startTime)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] font-bold tabular-nums text-[var(--text-primary)] lg:px-6">
                    {formatCurrency(a.price, currency)}
                  </td>
                  <td className="px-5 py-4 lg:px-6">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-4 text-end lg:px-6">
                    {renderActions(a)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="upcoming-title" className="mt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="upcoming-title"
          className="m-0 text-[20px] font-extrabold text-[var(--text-primary)] sm:text-[22px]"
          style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}
        >
          {t.dashboard.upcomingAppointments}
        </h2>
        <Link
          href={href("/calendar")}
          className={cn(
            "nav-link inline-flex min-h-11 items-center gap-1.5 text-[12px] font-bold text-[var(--text-primary)]",
            !isRTL && "uppercase tracking-[0.12em]",
          )}
        >
          {t.dashboard.viewSchedule}
          <ArrowRight size={14} aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">{body}</div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        destructive
        title={pending?.kind === "no_show" ? t.dashboard.noShowConfirmTitle : t.dashboard.cancelConfirmTitle}
        description={
          pending
            ? `${pending.appt.client} · ${serviceName(pending.appt)} · ${whenLabel(pending.appt.startTime)}`
            : undefined
        }
        confirmLabel={pending?.kind === "no_show" ? t.dashboard.markNoShow : t.dashboard.cancelAppointment}
        cancelLabel={t.dashboard.keepAppointment}
      />
      <CheckoutDialog target={checkout} onClose={() => setCheckout(null)} onConfirm={confirmCheckout} />
    </section>
  );
}

export default function DashboardPage() {
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const { t, isRTL, FFD, href, formatDate } = useTranslation();

  if (!hydrated) return <DashboardSkeleton />;

  return (
    <div className="page-enter">
      <header className="mb-8">
        <div className="dashboard-header-flex">
          <div>
            <h1
              className="m-0 text-[30px] font-extrabold leading-tight text-[var(--text-primary)] sm:text-[38px]"
              style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.016em") }}
            >
              {t.dashboard.overviewTitle}
            </h1>
            <p className="m-0 mt-2.5 text-[14px] text-[var(--text-secondary)]">{formatDate(new Date(), "long")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={href("/calendar")} className="btn btn-secondary">
              <CalendarCheck size={16} aria-hidden="true" />
              <span>{t.calendar.newBooking}</span>
            </Link>
            <Link href={href("/leads")} className="btn btn-secondary">
              <UserPlus size={16} aria-hidden="true" />
              <span>{t.dashboard.newLead}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-8">
        <MetricCards />
      </div>

      <div className="dashboard-main-grid">
        <SalesChart />
        <DailyReceipt />
      </div>

      <UpcomingAppointments />
    </div>
  );
}
