"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { endOfDay, startOfDay } from "date-fns";
import { CheckCircle, UserX, XCircle, Loader2, Sun, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { usePos, useDashboardVersion, errorMessageFor, type PaymentMethod } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { CheckoutDialog, type CheckoutTarget } from "@/components/dashboard/checkout-dialog";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const { t, isRTL, FFD, href, formatDate, formatTime, formatCurrency } = useTranslation();
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
    body = <ListSkeleton rows={4} />;
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
      <ul className={cn("m-0 flex list-none flex-col gap-4 p-0 transition-opacity", refreshing && "opacity-70")}>
        {appointments.map((appt) => {
          const resolved = isResolved(appt);
          const busy = loadingId === appt.id;
          const time = formatTime(appt.start_time);
          return (
            <li
              key={appt.id}
              className={cn(
                "flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5",
                resolved && "opacity-75",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="m-0 truncate text-[18px] font-extrabold text-[var(--text-primary)]"
                    style={{ fontFamily: FFD }}
                  >
                    {appt.client_name}
                  </p>
                  <p className="m-0 mt-1 text-[14px] text-[var(--text-secondary)]">{serviceOf(appt)}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="m-0 text-[20px] font-extrabold tabular-nums text-[var(--text-primary)]">{time}</p>
                  <p className="m-0 mt-1 text-[14px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {formatCurrency(appt.price, currency)}
                  </p>
                </div>
              </div>

              {resolved ? (
                <StatusBadge
                  status={appt.status}
                  paid={appt.payment_status === "paid" || appt.status === "completed"}
                  className="self-start"
                />
              ) : (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setCheckout({
                        id: appt.id,
                        clientName: appt.client_name,
                        serviceName: serviceOf(appt),
                        amount: appt.price,
                        currency,
                        whenLabel: time,
                      })
                    }
                    className="btn flex-1 min-h-[52px] rounded-xl border-0 bg-[var(--accent-mint)] text-[14px] font-bold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle size={18} aria-hidden="true" />
                    )}
                    {t.dashboard.markPaid}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPending({ kind: "no_show", appt })}
                    aria-label={`${t.dashboard.markNoShow}: ${appt.client_name}`}
                    title={t.dashboard.markNoShow}
                    className="grid min-h-[52px] min-w-[52px] place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-60"
                  >
                    <UserX size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPending({ kind: "cancel", appt })}
                    aria-label={`${t.dashboard.cancelAppointment}: ${appt.client_name}`}
                    title={t.dashboard.cancelAppointment}
                    className="grid min-h-[52px] min-w-[52px] place-items-center rounded-xl border border-[var(--accent-rose)] bg-[var(--accent-rose-muted)] text-[var(--accent-rose)] transition-opacity hover:opacity-85 disabled:opacity-60"
                  >
                    <XCircle size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.4, 1] }}
      className="mx-auto flex max-w-[560px] flex-col gap-6"
    >
      <header>
        <h1
          className="m-0 text-[28px] font-extrabold text-[var(--text-primary)]"
          style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.014em") }}
        >
          {t.sidebar.myDay}
        </h1>
        <p className="m-0 mt-1.5 text-[14px] text-[var(--text-secondary)]">
          {formatDate(new Date(), "long")}
          {appointments.length > 0 && (
            <>
              {" · "}
              <span className="font-semibold">
                {remaining > 0 ? interpolate(t.dashboard.remainingToday, { count: remaining }) : t.dashboard.allDone}
              </span>
            </>
          )}
        </p>
      </header>

      {showBarberPicker && barbers.length > 0 && (
        <div
          role="group"
          aria-label={t.calendar.barber}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {barbers.map((b) => {
            const active = b.id === activeBarberId;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedBarberId(b.id)}
                className={cn(
                  "min-h-11 shrink-0 whitespace-nowrap rounded-full border px-[18px] text-[13px] font-bold transition-colors",
                  active
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]",
                )}
              >
                {b.name}
              </button>
            );
          })}
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
