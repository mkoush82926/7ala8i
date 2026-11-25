"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { endOfDay, startOfDay } from "date-fns";
import { CheckCircle, UserX, XCircle, Sun, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { usePos, useDashboardVersion, errorMessageFor, type PaymentMethod } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton, Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/pill";
import { CheckoutDialog, type CheckoutTarget } from "@/components/dashboard/checkout-dialog";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";

interface Appt {
  id: string;
  client_name: string;
  start_time: string;
  barber_id: string | null;
  status: AppointmentStatus;
  price: number;
  payment_status: string | null;
  service_name: string | null;
}

/** Paid, completed, no-show or cancelled: nothing left to do mid-shift. Pure. */
function isResolved(appt: Pick<Appt, "status" | "payment_status">): boolean {
  return appt.payment_status === "paid" || !["pending", "confirmed"].includes(appt.status);
}

type Pending = { kind: "cancel" | "no_show"; appt: Appt } | null;

export default function MyDayPage() {
  const { t, href, formatDate, formatTime, formatCurrency } = useTranslation();
  const reduceMotion = useReducedMotion();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const version = useDashboardVersion();
  const { currency } = useShopSettings();
  const { markPaid, markNoShow, cancelAppointment, loadingId } = usePos();
  const [supabase] = useState(() => createClient());
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  // Optimistic status overrides, rolled back if the server rejects the change.
  const [overrides, setOverrides] = useState<Record<string, Partial<Appt>>>({});
  const [pending, setPending] = useState<Pending>(null);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);

  const isBarber = role === "barber";

  // Barbers see their own day; resolve their profile id once.
  const { data: me, error: meError, initialLoading: meLoading, refetch: refetchMe } = useSupabaseQuery<string | null>(
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return { data: null, error: { message: error.message } };
      return { data: data.user?.id ?? null, error: null };
    },
    [isBarber],
    { enabled: hydrated && isBarber },
  );

  // Admins default to the first barber; picking a chip overrides it.
  const activeBarberId = isBarber ? me ?? null : selectedBarberId ?? barbers[0]?.id ?? null;
  const activeBarberName = barbers.find((b) => b.id === activeBarberId)?.name;

  const { data, initialLoading, refreshing, error, refetch } = useSupabaseQuery<Appt[]>(
    async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, start_time, barber_id, status, price, payment_status, service_name")
        .eq("shop_id", shopId)
        .eq("barber_id", activeBarberId)
        .gte("start_time", startOfDay(today).toISOString())
        .lte("start_time", endOfDay(today).toISOString())
        .order("start_time", { ascending: true });
      if (error) return { data: null, error: { message: error.message } };
      const rows = (data ?? []) as (Omit<Appt, "status" | "price"> & { status: string | null; price: number | string | null })[];
      return {
        data: rows.map((r) => ({
          ...r,
          client_name: r.client_name ?? "",
          price: Number(r.price) || 0,
          status: normalizeAppointmentStatus(r.status) ?? "confirmed",
        })),
        error: null,
      };
    },
    [shopId, activeBarberId, version],
    { enabled: !!shopId && !!activeBarberId },
  );

  const appointments = (data ?? []).map((a) => ({ ...a, ...overrides[a.id] }));
  const remaining = appointments.filter((a) => !isResolved(a)).length;

  const serviceOf = (a: Appt) => a.service_name || t.dashboard.appointment;

  function setOverride(id: string, patch: Partial<Appt> | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (patch) next[id] = { ...prev[id], ...patch };
      else delete next[id];
      return next;
    });
  }

  async function confirmPending() {
    if (!pending) return;
    const { kind, appt } = pending;
    setOverride(appt.id, { status: kind === "cancel" ? "cancelled" : "no_show" });
    const res = kind === "cancel" ? await cancelAppointment(appt.id) : await markNoShow(appt.id);
    if (!res.ok) {
      setOverride(appt.id, null); // rollback
      throw new Error(errorMessageFor(t, res.code));
    }
    toast.success(kind === "cancel" ? t.dashboard.cancelledToast : t.dashboard.noShowToast);
  }

  async function confirmCheckout(method: PaymentMethod) {
    if (!checkout) return { ok: false as const, code: "INTERNAL" };
    const id = checkout.id;
    setOverride(id, { status: "completed", payment_status: "paid" });
    const res = await markPaid({ appointmentId: id, method });
    if (res.ok) toast.success(t.dashboard.paidToast);
    else setOverride(id, null);
    return res;
  }

  const showBarberPicker = !isBarber;
  const nextUp = appointments.find((a) => !isResolved(a)) ?? null;
  const rest = nextUp ? appointments.filter((a) => a.id !== nextUp.id) : appointments;
  const doneCount = appointments.length - remaining;

  const openCheckout = (appt: Appt) =>
    setCheckout({
      id: appt.id,
      clientName: appt.client_name,
      serviceName: serviceOf(appt),
      amount: appt.price,
      currency,
      whenLabel: formatTime(appt.start_time),
      barberId: appt.barber_id ?? null,
    });

  let body: React.ReactNode;
  if (isBarber && meError) {
    body = (
      <EmptyState
        tone="error"
        icon={AlertTriangle}
        title={t.dashboard.myDayError}
        description={t.error.message}
        action={{ label: t.common.retry, onClick: refetchMe, icon: RefreshCw }}
      />
    );
  } else if (!hydrated || (isBarber && (meLoading || !me)) || (activeBarberId && initialLoading)) {
    body = (
      <SkeletonGroup className="flex flex-col gap-4">
        <Skeleton variant="card" className="h-[188px] rounded-2xl" />
        <ListSkeleton rows={3} />
      </SkeletonGroup>
    );
  } else if (showBarberPicker && barbers.length === 0) {
    body = (
      <EmptyState
        icon={Users}
        title={t.dashboard.noBarbers}
        description={t.dashboard.noBarbersHint}
        action={{ label: t.sidebar.team, href: href("/team"), icon: Users }}
      />
    );
  } else if (error) {
    body = (
      <EmptyState
        tone="error"
        icon={AlertTriangle}
        title={t.dashboard.myDayError}
        description={t.error.message}
        action={{ label: t.common.retry, onClick: refetch, icon: RefreshCw }}
      />
    );
  } else if (appointments.length === 0) {
    body = <EmptyState icon={Sun} title={t.dashboard.noAppointmentsToday} description={t.dashboard.quietDay} />;
  } else {
    body = (
      <div className={cn("flex flex-col gap-6 transition-opacity duration-200 motion-reduce:transition-none", refreshing && "opacity-70")}>
        {/* Current / next appointment: the one thing to act on now */}
        {nextUp && (
          <section
            aria-labelledby="my-day-next"
            className="flex flex-col gap-5 rounded-2xl bg-inverse p-5 text-on-inverse shadow-raised sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="my-day-next" className="m-0 text-sm font-semibold text-on-inverse/75">
                  {t.dashboard.upNext}
                </h2>
                <p className="m-0 mt-1 text-[32px] font-bold leading-10 tabular-nums">{formatTime(nextUp.start_time)}</p>
              </div>
              <bdi className="mt-6 shrink-0 text-lg font-semibold tabular-nums">{formatCurrency(nextUp.price, currency)}</bdi>
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-xl font-semibold leading-7">{nextUp.client_name}</p>
              <p className="m-0 mt-0.5 truncate text-[15px] text-on-inverse/75">{serviceOf(nextUp)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="lg"
                loading={loadingId === nextUp.id}
                onClick={() => openCheckout(nextUp)}
                icon={<CheckCircle aria-hidden="true" />}
                className="flex-1 bg-card text-ink shadow-none hover:bg-sunken active:bg-sunken"
              >
                {t.dashboard.markPaid}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={loadingId === nextUp.id}
                onClick={() => setPending({ kind: "no_show", appt: nextUp })}
                aria-label={`${t.dashboard.markNoShow}: ${nextUp.client_name}`}
                title={t.dashboard.markNoShow}
                icon={<UserX aria-hidden="true" />}
                className="size-12 bg-on-inverse/10 text-on-inverse hover:bg-on-inverse/20 hover:text-on-inverse"
              />
              <Button
                size="icon"
                variant="ghost"
                disabled={loadingId === nextUp.id}
                onClick={() => setPending({ kind: "cancel", appt: nextUp })}
                aria-label={`${t.dashboard.cancelAppointment}: ${nextUp.client_name}`}
                title={t.dashboard.cancelAppointment}
                icon={<XCircle aria-hidden="true" />}
                className="size-12 bg-on-inverse/10 text-on-inverse hover:bg-on-inverse/20 hover:text-on-inverse"
              />
            </div>
          </section>
        )}

        {/* The rest of the day, in time order */}
        {rest.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rest.map((appt) => {
              const resolved = isResolved(appt);
              const busy = loadingId === appt.id;
              return (
                <li
                  key={appt.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-line bg-card p-4",
                    resolved && "bg-sunken/60",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <p className={cn("m-0 w-16 shrink-0 text-[15px] font-semibold tabular-nums", resolved ? "text-ink-muted" : "text-ink")}>
                      {formatTime(appt.start_time)}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className={cn("m-0 truncate text-[15px] font-semibold", resolved ? "text-ink-soft" : "text-ink")}>
                        {appt.client_name}
                      </p>
                      <p className="text-meta m-0 mt-0.5 truncate text-ink-muted">{serviceOf(appt)}</p>
                    </div>
                    <bdi className={cn("shrink-0 text-[15px] font-semibold tabular-nums", resolved ? "text-ink-muted" : "text-ink")}>
                      {formatCurrency(appt.price, currency)}
                    </bdi>
                  </div>

                  {resolved ? (
                    <StatusBadge
                      status={appt.status}
                      paid={appt.payment_status === "paid" || appt.status === "completed"}
                      className="ms-20 self-start"
                    />
                  ) : (
                    <div className="flex gap-2 sm:ms-20">
                      <Button
                        variant="soft"
                        loading={busy}
                        onClick={() => openCheckout(appt)}
                        aria-label={`${t.dashboard.markPaid}: ${appt.client_name}`}
                        icon={<CheckCircle aria-hidden="true" />}
                        className="flex-1 sm:flex-none"
                      >
                        {t.dashboard.markPaid}
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        disabled={busy}
                        onClick={() => setPending({ kind: "no_show", appt })}
                        aria-label={`${t.dashboard.markNoShow}: ${appt.client_name}`}
                        title={t.dashboard.markNoShow}
                        icon={<UserX aria-hidden="true" />}
                      />
                      <Button
                        variant="destructive-soft"
                        size="icon"
                        disabled={busy}
                        onClick={() => setPending({ kind: "cancel", appt })}
                        aria-label={`${t.dashboard.cancelAppointment}: ${appt.client_name}`}
                        title={t.dashboard.cancelAppointment}
                        icon={<XCircle aria-hidden="true" />}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.05, 0.7, 0.1, 1] }}
      className="mx-auto flex w-full max-w-[640px] flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-h2 m-0 text-ink">{t.sidebar.myDay}</h1>
          <p className="m-0 mt-1 text-[15px] text-ink-muted">
            {formatDate(new Date(), "long")}
            {appointments.length > 0 && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-ink-disabled">
                  ·
                </span>
                <span className={cn("font-semibold", remaining > 0 ? "text-ink-soft" : "text-success-text")}>
                  {remaining > 0 ? interpolate(t.dashboard.remainingToday, { count: remaining }) : t.dashboard.allDone}
                </span>
              </>
            )}
          </p>
        </div>
        {appointments.length > 0 && (
          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-standard motion-reduce:transition-none"
              style={{ width: `${(doneCount / appointments.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {showBarberPicker && barbers.length > 0 && (
        <div role="group" aria-label={t.calendar.barber} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {barbers.map((b) => (
            <FilterChip
              key={b.id}
              pressed={b.id === activeBarberId}
              onClick={() => setSelectedBarberId(b.id)}
              className="h-11 ps-1.5"
              icon={
                <span className="grid size-8 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-soft">
                  {getInitials(b.name || "?")}
                </span>
              }
            >
              {b.name}
            </FilterChip>
          ))}
        </div>
      )}

      {activeBarberName && showBarberPicker && <h2 className="sr-only">{activeBarberName}</h2>}

      {body}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        destructive
        title={pending?.kind === "no_show" ? t.dashboard.noShowConfirmTitle : t.dashboard.cancelConfirmTitle}
        description={pending ? `${pending.appt.client_name} · ${serviceOf(pending.appt)} · ${formatTime(pending.appt.start_time)}` : undefined}
        confirmLabel={pending?.kind === "no_show" ? t.dashboard.markNoShow : t.dashboard.cancelAppointment}
        cancelLabel={t.dashboard.keepAppointment}
      />
      <CheckoutDialog target={checkout} onClose={() => setCheckout(null)} onConfirm={confirmCheckout} />
    </motion.div>
  );
}
