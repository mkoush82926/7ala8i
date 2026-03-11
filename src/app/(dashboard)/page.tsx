"use client";

import React, { useState, useEffect, useRef } from "react";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { DailyReceipt } from "@/components/dashboard/daily-receipt";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  CalendarPlus,
  UserPlus,
  FileDown,
  Clock,
  User,
  Scissors,
  ArrowRight,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { usePos } from "@/hooks/use-pos";
import { formatCurrency } from "@/lib/utils";

function QuickActions() {
  const t = useTranslation();

  const actions = [
    { icon: CalendarPlus, label: t.calendar.newBooking, color: "var(--accent-mint)", href: "/calendar" },
    { icon: UserPlus, label: t.leads.addNewLead, color: "var(--accent-lavender)", href: "/leads" },
    { icon: FileDown, label: `${t.common.export} ${t.common.pdf}`, color: "var(--accent-blue)", href: "/analytics" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 20 }}>
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className="glass-card-premium group cursor-pointer"
        >
          <div className="flex items-center" style={{ padding: "20px 24px", gap: 16 }}>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${action.color} 15%, transparent)` }}
            >
              <action.icon size={19} style={{ color: action.color }} />
            </div>
            <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors relative z-10 font-medium">
              {action.label}
            </span>
            <ArrowRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--text-tertiary)] ms-auto relative z-10 transition-all group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </div>
        </a>
      ))}
    </div>
  );
}

interface UpcomingAppt {
  id: string;
  client: string;
  service: string;
  barber: string;
  time: string;
  price: number;
  paymentStatus: string;
  color: string;
}

function UpcomingAppointments() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const role = useWorkspaceStore((s) => s.role);
  const { markPaid, markNoShow, cancelAppointment, loadingId } = usePos();
  const supabase = useRef(createClient()).current;
  const [appointments, setAppointments] = useState<UpcomingAppt[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = ["var(--accent-mint)", "var(--accent-lavender)", "var(--accent-blue)", "var(--accent-amber)", "var(--accent-rose)"];

  useEffect(() => {
    async function fetch() {
      if (!shopId) { setLoading(false); return; }
      try {
        const now = new Date();
        const { data } = await supabase
          .from("appointments")
          .select("id, client_name, start_time, barber_id, status, price, payment_status")
          .eq("shop_id", shopId)
          .gte("start_time", now.toISOString())
          .neq("status", "cancelled")
          .neq("status", "completed")
          .order("start_time")
          .limit(5);

        if (data && data.length > 0) {
          setAppointments(data.map((a, i) => ({
            id: a.id,
            client: a.client_name,
            service: isRTL ? "موعد" : "Appointment",
            barber: barbers.find((b) => b.id === a.barber_id)?.name?.split(" ")[0] || (isRTL ? "أي" : "Any"),
            time: format(new Date(a.start_time), "h:mm a"),
            price: a.price || 0,
            paymentStatus: a.payment_status || "unpaid",
            color: colors[i % colors.length],
          })));
        }
      } catch { /* empty state */ }
      setLoading(false);
    }
    fetch();
  }, [supabase, shopId, barbers, isRTL]);

  return (
    <div className="glass-card-premium">
      <div style={{ padding: 26 }}>
        <div className="flex items-center relative z-10" style={{ gap: 14, marginBottom: 24 }}>
          <div className="flex items-center justify-center rounded-xl bg-[var(--accent-lavender-muted)]" style={{ width: 44, height: 44 }}>
            <Clock size={17} className="text-[var(--accent-lavender)]" />
          </div>
          <span className="text-[var(--text-secondary)] font-semibold" style={{ fontSize: 15 }}>
            {isRTL ? "المواعيد القادمة" : "Upcoming"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-[var(--text-muted)]" size={20} />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center relative z-10" style={{ padding: "40px 20px" }}>
            <Calendar size={28} className="text-[var(--text-muted)]" style={{ marginBottom: 12 }} />
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 13 }}>
              {isRTL ? "لا مواعيد قادمة" : "No upcoming appointments"}
            </p>
            <a
              href="/book"
              className="mt-4 px-4 py-2 rounded-lg font-medium text-[13px] transition-all hover:opacity-90"
              style={{ background: "var(--accent-mint)", color: "#0A0A0A" }}
            >
              {isRTL ? "احجز الآن" : "Book Now"}
            </a>
          </div>
        ) : (
          <div className="relative z-10" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {appointments.map((apt) => {
              const isPaid = apt.paymentStatus === "paid";
              return (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:border-[var(--border-hover)] transition-all group"
                  style={{ padding: "14px 16px", gap: 12 }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${apt.color} 12%, transparent)` }}
                    >
                      <User size={16} style={{ color: apt.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-[var(--text-primary)] font-medium truncate">{apt.client}</p>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]" style={{ marginTop: 3 }}>
                        <Scissors size={10} />
                        <span className="truncate">{apt.service}</span>
                        <span className="opacity-40">·</span>
                        <span className="flex-shrink-0">{apt.barber}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0" style={{ gap: 10 }}>
                    <div className="text-right">
                      <p className="text-[13px] text-[var(--text-primary)] tabular-nums font-semibold">
                        {formatCurrency(apt.price || 0)}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {apt.time}
                      </p>
                    </div>
                    {role !== "client" && (
                      <div className="flex items-center" style={{ gap: 6 }}>
                        {isPaid ? (
                          <span className="inline-flex items-center rounded-lg bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] border border-[var(--accent-mint)]/30 px-2.5 h-7 text-[11px] font-semibold">
                            <CheckCircle2 size={13} className="me-1" /> Paid
                          </span>
                        ) : (
                          <>
                            <button
                              disabled={loadingId === apt.id}
                              onClick={() => markPaid({
                                appointmentId: apt.id,
                                clientName: apt.client,
                                barberName: apt.barber,
                                serviceLabel: apt.service,
                                scheduledTime: apt.time,
                                amount: apt.price || 0,
                                method: "cash",
                              })}
                              className="inline-flex items-center rounded-lg bg-[var(--accent-mint)] text-[#0A0A0A] font-semibold text-[11px] hover:opacity-90 transition-opacity cursor-pointer"
                              style={{ padding: "0 10px", height: 28, gap: 6 }}
                            >
                              <CheckCircle2 size={13} />
                              {isRTL ? "تم الدفع" : "Mark Paid"}
                            </button>
                            <button
                              disabled={loadingId === apt.id}
                              onClick={() => markNoShow(apt.id)}
                              className="inline-flex items-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[11px] hover:border-[var(--accent-rose)]/40 hover:text-[var(--accent-rose)] transition-all cursor-pointer"
                              style={{ padding: "0 8px", height: 28, gap: 4 }}
                            >
                              <AlertTriangle size={12} />
                              {isRTL ? "لم يحضر" : "No-show"}
                            </button>
                            <button
                              disabled={loadingId === apt.id}
                              onClick={() => cancelAppointment(apt.id)}
                              className="inline-flex items-center rounded-lg bg-transparent border border-[var(--border-primary)] text-[var(--text-muted)] hover:border-[var(--accent-rose)]/40 hover:text-[var(--accent-rose)] transition-all cursor-pointer"
                              style={{ width: 28, height: 28, justifyContent: "center" }}
                            >
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const hydrated = useWorkspaceStore((s) => s.hydrated);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !hydrated) return <DashboardSkeleton />;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <MetricCards />
      <div style={{ marginTop: 32 }}>
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 28, marginTop: 40 }}>
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <DailyReceipt />
          <UpcomingAppointments />
        </div>
      </div>
    </div>
  );
}
