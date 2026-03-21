"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  Clock,
  CalendarX,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getAppointmentsByDateRange } from "@/lib/queries/appointments";
import { toast } from "@/components/ui/toast";
import { format, parseISO, addDays, subDays } from "date-fns";

const timeSlots = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 8; // 8 AM to 7 PM
  return `${hour.toString().padStart(2, "0")}:00`;
});

const statusColors: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  pending: {
    bg: "bg-[var(--text-muted)]/10",
    border: "border-[var(--text-muted)]/30",
    text: "text-[var(--text-tertiary)]",
  },
  confirmed: {
    bg: "bg-[var(--accent-blue-muted)]",
    border: "border-[var(--accent-blue)]/30",
    text: "text-[var(--accent-blue)]",
  },
  completed: {
    bg: "bg-[var(--accent-mint-muted)]",
    border: "border-[var(--accent-mint)]/30",
    text: "text-[var(--accent-mint)]",
  },
  "no-show": {
    bg: "bg-[var(--accent-rose-muted)]",
    border: "border-[var(--accent-rose)]/30",
    text: "text-[var(--accent-rose)]",
  },
  cancelled: {
    bg: "bg-[var(--text-muted)]/5",
    border: "border-[var(--text-muted)]/20",
    text: "text-[var(--text-muted)]",
  },
};

export function TimelineView() {
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    appointmentId: string;
    status: string;
    label: string;
  }>({ open: false, appointmentId: "", status: "", label: "" });

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  let currentPosition = -1;
  if (currentHour >= 8 && currentHour < 20) {
    currentPosition = ((currentHour - 8 + currentMinute / 60) / 12) * 100;
  }

  const { barbers, currentView, shopId } = useWorkspaceStore();
  const displayBarbers =
    currentView === "master"
      ? barbers
      : barbers.filter((b) => b.id === currentView);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const supabase = createClient();

  type Appointment = {
    id: string;
    shop_id: string;
    client_id: string | null;
    barber_id: string | null;
    service_ids: string[] | null;
    client_name: string;
    start_time: string;
    end_time: string;
    status: string | null;
    price: number;
  };

  const {
    data: appointments,
    loading,
    refetch,
  } = useSupabaseQuery<Appointment[]>(
    () => getAppointmentsByDateRange(supabase, shopId, dateStr, dateStr) as Promise<{ data: Appointment[] | null; error: { message: string } | null }>,
    [shopId, dateStr],
    { enabled: !!shopId },
  );

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [] as Appointment[];
    if (currentView === "master") return appointments;
    return appointments.filter((a) => a.barber_id === currentView);
  }, [appointments, currentView]);

  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    try {
      const res = await fetch("/api/booking/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId, status }),
      });

      const result = await res.json();
      if (!result.success) {
        toast("error", result.error || "Failed to update status");
        return;
      }

      toast("success", `Appointment marked as ${status}`);
      refetch();
    } catch {
      toast("error", "Failed to update appointment");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
            Calendar
          </h2>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <button
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              className="w-11 h-11 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[13px] font-medium text-[var(--text-primary)] min-w-[120px] text-center">
              {format(selectedDate, "MMMM d, yyyy")}
            </span>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="w-11 h-11 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-[12px] bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center justify-center px-4 min-w-[44px] min-h-[36px] rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                view === "timeline"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Clock size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center justify-center px-4 min-w-[44px] min-h-[36px] rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                view === "list"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          <div className="h-8 w-px bg-[var(--border-primary)] hidden md:block" />

          <button className="btn btn-primary" onClick={() => window.location.href = '/book'}>
            <Plus size={16} />
            New Booking
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                colors.bg,
                `border ${colors.border}`,
              )}
            />
            <span className="text-[11px] text-[var(--text-tertiary)] capitalize">
              {status === "no-show" ? "No Show" : status}
            </span>
          </div>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <GlassCard hoverable={false} padding="md">
          <div className="animate-pulse space-y-4 min-h-[200px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--bg-surface)]" />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {!loading && filteredAppointments.length === 0 && (
        <EmptyState
          icon={CalendarX}
          title="No appointments for this day"
          description="Appointments booked for this date will appear here."
        />
      )}

      {/* Timeline View */}
      {!loading && filteredAppointments.length > 0 && view === "timeline" ? (
        <GlassCard hoverable={false} padding="md" className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Time header */}
            <div className="flex border-b border-[var(--border-primary)]">
              <div className="w-32 flex-shrink-0 p-3 text-[11px] text-[var(--text-tertiary)] font-light">
                Barber
              </div>
              <div className="flex-1 flex">
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    className="flex-1 p-3 text-center text-[11px] text-[var(--text-muted)] font-light border-s border-[var(--border-primary)]"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            {/* Barber rows */}
            {displayBarbers.map((barber, barberIdx) => {
              const barberAppts = filteredAppointments.filter(
                (a) => a.barber_id === barber.id,
              );

              return (
                <motion.div
                  key={barber.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: barberIdx * 0.05 }}
                  className="flex border-b border-[var(--border-primary)] last:border-b-0"
                >
                  <div className="w-32 flex-shrink-0 p-3 flex items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center">
                        <span className="text-[9px] font-medium text-[#0A0A0A]">
                          {barber.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <span className="text-[12px] text-[var(--text-secondary)] font-light truncate">
                        {barber.name.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 relative min-h-[60px]">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeSlots.map((time) => (
                        <div
                          key={time}
                          className="flex-1 border-s border-[var(--border-primary)]"
                        />
                      ))}
                    </div>

                    {/* Current time indicator */}
                    {currentPosition >= 0 &&
                      format(selectedDate, "yyyy-MM-dd") ===
                        format(now, "yyyy-MM-dd") && (
                        <div
                          className="absolute top-0 bottom-0 w-[1px] bg-[var(--accent-mint)]/50 z-20 pointer-events-none"
                          style={{ left: `${currentPosition}%` }}
                        >
                          <div className="absolute top-0 -translate-x-1/2 -mt-1 w-2 h-2 rounded-full bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]" />
                        </div>
                      )}

                    {/* Appointment blocks */}
                    {barberAppts.map((appt) => {
                      const apptDate = parseISO(appt.start_time);
                      const hour = apptDate.getHours();
                      const minute = apptDate.getMinutes();
                      const startSlot = hour - 8 + minute / 60;

                      const endDate = parseISO(appt.end_time);
                      const durationMinutes =
                        (endDate.getTime() - apptDate.getTime()) / 60000;
                      const widthSlots = durationMinutes / 60;

                      const colors =
                        statusColors[appt.status ?? "pending"] ??
                        statusColors.pending;

                      return (
                        <motion.div
                          key={appt.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02, zIndex: 30 }}
                          className={cn(
                            "absolute top-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 cursor-pointer",
                            "border transition-all duration-200 group",
                            colors.bg,
                            colors.border,
                            "hover:shadow-[var(--shadow-md)]",
                          )}
                          style={{
                            left: `${(startSlot / 12) * 100}%`,
                            width: `${(widthSlots / 12) * 100}%`,
                            bottom: "6px",
                          }}
                        >
                          <p
                            className={cn(
                              "text-[10px] font-medium truncate",
                              colors.text,
                            )}
                          >
                            {appt.client_name}
                          </p>
                          <p className="text-[9px] text-[var(--text-muted)] truncate">
                            {format(apptDate, "h:mm a")} ·{" "}
                            {Math.round(durationMinutes)}m
                          </p>

                          {/* Tooltip with actions */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max min-w-[160px] p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-50 flex flex-col gap-2">
                            <p className="text-[12px] text-[var(--text-primary)] font-medium">
                              {appt.client_name}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {Math.round(durationMinutes)} min ·{" "}
                              {appt.price.toFixed(2)} JOD
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <div
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  colors.bg,
                                  `border ${colors.border}`,
                                )}
                              />
                              <span className="text-[9px] text-[var(--text-tertiary)] capitalize">
                                {appt.status === "no-show"
                                  ? "No Show"
                                  : appt.status}
                              </span>
                            </div>

                            {/* POS Actions */}
                            {(appt.status === "pending" ||
                              appt.status === "confirmed") && (
                              <div className="flex gap-1 mt-1 pt-2 border-t border-[var(--border-primary)]">
                                {appt.status === "pending" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusUpdate(
                                        appt.id,
                                        "confirmed",
                                      );
                                    }}
                                    className="flex-1 min-h-[36px] rounded text-[10px] uppercase font-bold bg-[var(--accent-blue-muted)] text-[var(--accent-blue)] hover:opacity-80 cursor-pointer transition-opacity"
                                  >
                                    Confirm
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(appt.id, "completed");
                                  }}
                                  className="flex-1 min-h-[36px] rounded text-[10px] uppercase font-bold bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] hover:opacity-80 cursor-pointer transition-opacity"
                                >
                                  Paid
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({
                                      open: true,
                                      appointmentId: appt.id,
                                      status: "no-show",
                                      label: "No Show",
                                    });
                                  }}
                                  className="flex-1 min-h-[36px] rounded text-[10px] uppercase font-bold bg-[var(--accent-rose-muted)] text-[var(--accent-rose)] hover:opacity-80 cursor-pointer transition-opacity"
                                >
                                  No Show
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({
                                      open: true,
                                      appointmentId: appt.id,
                                      status: "cancelled",
                                      label: "Cancel",
                                    });
                                  }}
                                  className="flex-1 min-h-[36px] rounded text-[10px] uppercase font-bold bg-[var(--text-muted)]/10 text-[var(--text-muted)] hover:opacity-80 cursor-pointer transition-opacity"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>
      ) : (
        !loading &&
        filteredAppointments.length > 0 && (
          /* List View */
          <GlassCard hoverable={false} padding="md">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    {[
                      "Time",
                      "Client",
                      "Duration",
                      "Price",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-start text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appt, i) => {
                    const colors =
                      statusColors[appt.status ?? "pending"] ??
                      statusColors.pending;
                    const apptDate = parseISO(appt.start_time);
                    const endDate = parseISO(appt.end_time);
                    const durationMinutes =
                      (endDate.getTime() - apptDate.getTime()) / 60000;

                    return (
                      <motion.tr
                        key={appt.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-light tabular-nums">
                          {format(apptDate, "h:mm a")}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-light">
                          {appt.client_name}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] font-light">
                          {Math.round(durationMinutes)} min
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                          {appt.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize",
                              colors.bg,
                              colors.border,
                              colors.text,
                            )}
                          >
                            {appt.status === "no-show"
                              ? "No Show"
                              : appt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(appt.status === "pending" ||
                            appt.status === "confirmed") && (
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  handleStatusUpdate(appt.id, "completed")
                                }
                                className="min-h-[36px] px-3 rounded text-[11px] font-bold uppercase bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                Paid
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    open: true,
                                    appointmentId: appt.id,
                                    status: "cancelled",
                                    label: "Cancel",
                                  })
                                }
                                className="min-h-[36px] px-3 rounded text-[11px] font-bold uppercase bg-[var(--text-muted)]/10 text-[var(--text-muted)] cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )
      )}

      {/* Confirm Dialog for destructive actions */}
      <ConfirmDialog
        open={confirmAction.open}
        onClose={() =>
          setConfirmAction({
            open: false,
            appointmentId: "",
            status: "",
            label: "",
          })
        }
        onConfirm={() =>
          handleStatusUpdate(confirmAction.appointmentId, confirmAction.status)
        }
        title={`Mark as ${confirmAction.label}?`}
        description={`This action cannot be undone. The appointment will be marked as "${confirmAction.label}".`}
        confirmLabel={confirmAction.label}
        destructive
      />
    </div>
  );
}
