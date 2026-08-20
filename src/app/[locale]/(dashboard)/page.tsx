"use client";

import React, { useState, useEffect } from "react";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { DailyReceipt } from "@/components/dashboard/daily-receipt";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  CheckCircle,
  UserX,
  XCircle,
  Loader2,
  CalendarCheck,
} from "lucide-react";
import { usePos } from "@/hooks/use-pos";
import { formatCurrency } from "@/lib/utils";

/* ────────────────────────────────────────────────────
   Upcoming Appointments — full table matching Stitch
   10-dashboard.html exactly
──────────────────────────────────────────────────── */
interface Appt {
  id: string;
  client: string;
  service: string;
  barber: string;
  time: string;
  price: number;
  status: string;
  paymentStatus: string;
}

function statusBadge(status: string, paymentStatus: string) {
  if (paymentStatus === "paid") {
    return (
      <span className="px-3 py-1.5 rounded-full bg-[#f7f1e4] text-[#a67c3d] text-[10px] font-black uppercase tracking-wider">
        Paid
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black uppercase tracking-wider">
        In Progress
      </span>
    );
  }
  return (
    <span className="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-black uppercase tracking-wider">
      Confirmed
    </span>
  );
}

function UpcomingAppointments() {
  const { t, isRTL, locale, FF } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const role = useWorkspaceStore((s) => s.role);
  const { markPaid, markNoShow, cancelAppointment, loadingId } = usePos();
  const [supabase] = useState(() => createClient());
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!shopId) { setLoading(false); return; }
      try {
        const now = new Date();
        const { data } = await supabase
          .from("appointments")
          .select("id, client_name, start_time, barber_id, status, price, payment_status, service_name")
          .eq("shop_id", shopId)
          .gte("start_time", now.toISOString())
          .neq("status", "cancelled")
          .neq("status", "completed")
          .order("start_time")
          .limit(8);

        if (data) {
          setAppointments(data.map((a) => ({
            id: a.id,
            client: a.client_name,
            service: a.service_name || (isRTL ? "موعد" : "Appointment"),
            barber: barbers.find((b) => b.id === a.barber_id)?.name?.split(" ").map((w: string, i: number) => i === 0 ? w : w[0] + ".").join(" ") || (isRTL ? "أي" : "Any"),
            time: format(new Date(a.start_time), "HH:mm"),
            price: a.price || 0,
            status: a.status || "confirmed",
            paymentStatus: a.payment_status || "unpaid",
          })));
        }
      } catch { /* fallback to empty */ }
      setLoading(false);
    }
    fetchData();
  }, [supabase, shopId, barbers, isRTL]);

  const cols = isRTL
    ? ["الإجراءات", "الحالة", "السعر", "الوقت", "الحلاق", "الخدمة", "العميل"]
    : ["Client", "Service", "Barber", "Time", "Price", "Status", "Actions"];

  return (
    <section style={{ marginTop: 8 }}>
      {/* Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: FF, fontSize: 22, fontWeight: 800, letterSpacing: headingTracking(isRTL, "0.012em"), color: "#1c1611", margin: 0 }}>
          {isRTL ? "المواعيد القادمة" : "Upcoming Appointments"}
        </h3>
        <a
          href={`/${locale}/calendar`}
          className="nav-link"
          style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: headingTracking(isRTL, "0.15em"), color: "#1c1611",
          }}
        >
          {isRTL ? "عرض الجدول" : "View All Schedule"} →
        </a>
      </div>

      {/* Table — consistent card styling matching rest of dashboard */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ede3cd", overflow: "hidden" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-on-surface-variant" size={24} />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: "#f7f1e4",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CalendarCheck size={26} style={{ color: "#ede3cd" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#5a5147", margin: "0 0 6px" }}>
                {isRTL ? "لا مواعيد قادمة" : "No upcoming appointments"}
              </p>
              <p style={{ fontSize: 12, color: "#5a5147", margin: 0 }}>Your schedule is clear for now</p>
            </div>
            <a href={`/${locale}/calendar`} className="btn btn-primary" style={{ marginTop: 4, padding: "0 24px" }}>
              {isRTL ? "احجز الآن" : "+ Book Appointment"}
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Exact Stitch table structure */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary-container">
                  {cols.map((col) => (
                    <th
                      key={col}
                      className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="table-row-hover transition-colors group">
                    {/* Client */}
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary-container border border-outline flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-primary">
                            {apt.client.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <span className="font-extrabold text-sm text-primary">{apt.client}</span>
                      </div>
                    </td>
                    {/* Service */}
                    <td className="px-8 py-6 text-sm font-semibold text-primary">{apt.service}</td>
                    {/* Barber */}
                    <td className="px-8 py-6 text-sm font-semibold text-on-surface-variant">{apt.barber}</td>
                    {/* Time */}
                    <td className="px-8 py-6 text-sm font-black text-primary">{apt.time}</td>
                    {/* Price */}
                    <td className="px-8 py-6 text-sm font-extrabold text-primary">
                      {formatCurrency(apt.price)}
                    </td>
                    {/* Status Badge */}
                    <td className="px-8 py-6">
                      {statusBadge(apt.status, apt.paymentStatus)}
                    </td>
                    {/* Actions */}
                    <td className="px-8 py-6 text-right">
                      {role !== "client" && apt.paymentStatus !== "paid" && (
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Mark Paid */}
                          <button
                            disabled={loadingId === apt.id}
                            onClick={() =>
                              markPaid({
                                appointmentId: apt.id,
                                clientName: apt.client,
                                barberName: apt.barber,
                                serviceLabel: apt.service,
                                scheduledTime: apt.time,
                                amount: apt.price,
                                method: "cash",
                              })
                            }
                            title="Mark Paid"
                            className="w-8 h-8 flex items-center justify-center text-[#a67c3d] hover:bg-[#f7f1e4] rounded-lg transition-colors cursor-pointer"
                          >
                            <CheckCircle size={20} />
                          </button>
                          {/* No-show */}
                          <button
                            disabled={loadingId === apt.id}
                            onClick={() => markNoShow(apt.id)}
                            title="No-show"
                            className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-secondary-container rounded-lg transition-colors cursor-pointer"
                          >
                            <UserX size={20} />
                          </button>
                          {/* Cancel */}
                          <button
                            disabled={loadingId === apt.id}
                            onClick={() => cancelAppointment(apt.id)}
                            title="Cancel"
                            className="w-8 h-8 flex items-center justify-center text-[#ba1a1a] hover:bg-[rgba(186,26,26,0.08)] rounded-lg transition-colors cursor-pointer"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────
   Dashboard Page — matches Stitch 10-dashboard.html
──────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const { t, isRTL, locale, FF } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (!ready || !hydrated) return <DashboardSkeleton />;

  return (
    /* Matches Stitch main: min-h-screen p-10 lg:p-14 */
    <div className="page-enter">
      {/* Page Header */}
      <header style={{ display: "flex", flexDirection: "column", marginBottom: 32, gap: 16 }}>
        <div className="dashboard-header-flex">
          <div>
            <h2 style={{ fontFamily: FF, fontSize: 38, fontWeight: 800, letterSpacing: headingTracking(isRTL, "0.016em"), color: "#1c1611", lineHeight: 1.1, margin: 0 }}>
              {isRTL ? "نظرة عامة على الأتيليه" : "Atelier Overview"}
            </h2>
            <p style={{ color: "#5a5147", fontWeight: 400, marginTop: 10, fontSize: 14, letterSpacing: "0.01em" }}>
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>

          {/* Header action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href={`/${locale}/calendar`} className="btn btn-secondary">
              <CalendarCheck size={16} />
              <span>{isRTL ? "حجز جديد" : "New Booking"}</span>
            </a>
            <a href={`/${locale}/leads`} className="btn btn-secondary">
              <span>{isRTL ? "إضافة عميل" : "New Lead"}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div style={{ marginBottom: 32 }}>
        <MetricCards />
      </div>

      {/* Charts + Receipt — proper responsive 2/3 + 1/3 grid */}
      <div className="dashboard-main-grid">
        <SalesChart />
        <DailyReceipt />
      </div>

      {/* Appointments Table */}
      <UpcomingAppointments />
    </div>
  );
}
