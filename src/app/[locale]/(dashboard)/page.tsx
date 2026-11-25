"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { isToday } from "date-fns";
import {
  CheckCircle,
  UserX,
  XCircle,
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
import { Panel } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKeys } from "@/i18n/en";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { usePos, useDashboardVersion, errorMessageFor } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
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
  const { t, href, formatCurrency, formatTime, formatDate } = useTranslation();
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
      barberId: a.barberId ?? null,
    });

  function renderActions(a: Appt) {
    const busy = loadingId === a.id;
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="soft"
          size="sm"
          loading={busy}
          onClick={() => openCheckout(a)}
          aria-label={`${t.dashboard.markPaid}: ${a.client}`}
          icon={<CheckCircle aria-hidden="true" />}
        >
          {t.dashboard.markPaid}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={() => setPending({ kind: "no_show", appt: a })}
          aria-label={`${t.dashboard.markNoShow}: ${a.client}`}
          title={t.dashboard.markNoShow}
          icon={<UserX aria-hidden="true" />}
        />
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={() => setPending({ kind: "cancel", appt: a })}
          aria-label={`${t.dashboard.cancelAppointment}: ${a.client}`}
          title={t.dashboard.cancelAppointment}
          icon={<XCircle aria-hidden="true" />}
          className="hover:bg-danger-soft hover:text-danger-text"
        />
      </div>
    );
  }

  let body: React.ReactNode;
  if (initialLoading) {
    body = <TableRowsSkeleton rows={4} columns={4} />;
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
      <ul className="m-0 list-none divide-y divide-line p-0">
        {appointments.map((a) => {
          const d = new Date(a.startTime);
          const today = isToday(d);
          // One line when the panel is wide (md–lg full width, 2xl beside the
          // receipt); two lines on phones and in the narrower xl column.
          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-sunken/50 motion-reduce:transition-none md:flex-row md:items-center md:gap-4 lg:px-5 xl:flex-col xl:items-stretch xl:gap-3 2xl:flex-row 2xl:items-center 2xl:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                <div className="w-16 shrink-0">
                  <p className="m-0 text-[15px] font-semibold tabular-nums text-ink">{formatTime(d)}</p>
                  <p className="m-0 text-xs text-ink-muted">{today ? t.common.today : formatDate(d, "dayMonth")}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden size-10 shrink-0 place-items-center rounded-full bg-sunken text-[13px] font-semibold text-ink-soft sm:grid"
                >
                  {getInitials(a.client || "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[15px] font-semibold text-ink">
                    <bdi>{a.client}</bdi>
                  </p>
                  <p className="text-meta m-0 truncate text-ink-muted">
                    <bdi>{serviceName(a)}</bdi> · <bdi>{barberName(a.barberId)}</bdi>
                  </p>
                </div>
                <bdi className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{formatCurrency(a.price, currency)}</bdi>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end xl:justify-between 2xl:justify-end">
                <StatusBadge status={a.status} />
                {renderActions(a)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Panel
      aria-labelledby="upcoming-title"
      flush
      title={<span id="upcoming-title">{t.dashboard.upNext}</span>}
      description={t.dashboard.upcomingAppointments}
      action={
        <ButtonLink
          href={href("/calendar")}
          variant="ghost"
          size="sm"
          iconEnd={<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />}
        >
          {t.dashboard.viewSchedule}
        </ButtonLink>
      }
    >
      {body}

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
    </Panel>
  );
}

function greetingFor(t: TranslationKeys, hour: number): string {
  if (hour < 12) return t.topbar.goodMorning;
  if (hour < 18) return t.topbar.goodAfternoon;
  return t.topbar.goodEvening;
}

export default function DashboardPage() {
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const shopName = useWorkspaceStore((s) => s.shopName);
  const { t, href, formatDate } = useTranslation();

  if (!hydrated) return <DashboardSkeleton />;

  const now = new Date();

  return (
    <div className="page-enter flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h2 m-0 text-ink">{greetingFor(t, now.getHours())}</h1>
          <p className="m-0 mt-1 text-[15px] text-ink-muted">
            {formatDate(now, "long")}
            {shopName && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-ink-disabled">
                  ·
                </span>
                <bdi className="whitespace-nowrap font-medium text-ink-soft">{shopName}</bdi>
              </>
            )}
          </p>
        </div>

        <ButtonLink href={href("/leads")} variant="secondary" size="sm" icon={<UserPlus aria-hidden="true" />}>
          {t.dashboard.newLead}
        </ButtonLink>
      </header>

      <MetricCards />

      <div className="grid items-start gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <UpcomingAppointments />
          <SalesChart />
        </div>
        <div className="min-w-0">
          <DailyReceipt />
        </div>
      </div>
    </div>
  );
}
