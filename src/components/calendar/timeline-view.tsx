"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, List, Clock } from "lucide-react";
import { appointments } from "@/lib/mock-data";
import { useWorkspaceStore } from "@/store/workspace-store";

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
};

export function TimelineView() {
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [now, setNow] = useState(new Date());

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

  const { barbers, currentView } = useWorkspaceStore();
  const displayBarbers =
    currentView === "master"
      ? barbers
      : barbers.filter((b) => b.id === currentView);

  const filteredAppointments =
    currentView === "master"
      ? appointments
      : appointments.filter((a) => a.barberId === currentView);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
            Calendar
          </h2>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <button className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-medium text-[var(--text-primary)] min-w-[120px] text-center">
              March 10, 2026
            </span>
            <button className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-[var(--bg-surface)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "relative px-2.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer z-10",
                view === "timeline"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]",
              )}
            >
              {view === "timeline" && (
                <motion.div
                  layoutId="calendar-view-pill"
                  className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Clock size={14} className="relative z-10" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "relative px-2.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer z-10",
                view === "list"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]",
              )}
            >
              {view === "list" && (
                <motion.div
                  layoutId="calendar-view-pill"
                  className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <List size={14} className="relative z-10" />
            </button>
          </div>

          <GlassButton variant="primary" size="sm" icon={<Plus size={14} />}>
            New Booking
          </GlassButton>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex items-center gap-4">
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

      {/* Timeline View */}
      {view === "timeline" ? (
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
                    className="flex-1 p-3 text-center text-[11px] text-[var(--text-muted)] font-light border-l border-[var(--border-primary)]"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            {/* Barber rows */}
            {displayBarbers.map((barber, barberIdx) => {
              const barberAppts = filteredAppointments.filter(
                (a) => a.barberId === barber.id,
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
                          className="flex-1 border-l border-[var(--border-primary)]"
                        />
                      ))}
                    </div>

                    {/* Current time indicator */}
                    {currentPosition >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-[1px] bg-[var(--accent-mint)]/50 z-20 pointer-events-none"
                        style={{ left: `${currentPosition}%` }}
                      >
                        <div className="absolute top-0 -translate-x-1/2 -mt-1 w-2 h-2 rounded-full bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]" />
                      </div>
                    )}
                    {/* Appointment blocks */}
                    {barberAppts.map((appt) => {
                      const hour = parseInt(appt.time.split(":")[0]);
                      const minute = parseInt(appt.time.split(":")[1]);
                      const startSlot = hour - 8 + minute / 60;
                      const widthSlots = appt.duration / 60;
                      const colors = statusColors[appt.status];

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
                            appt.status === "confirmed"
                              ? "hover:shadow-glow-blue"
                              : appt.status === "completed"
                                ? "hover:shadow-glow-mint"
                                : appt.status === "no-show"
                                  ? "hover:shadow-glow-rose"
                                  : "",
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
                            {appt.clientName}
                          </p>
                          <p className="text-[9px] text-[var(--text-muted)] truncate">
                            {appt.service}
                          </p>

                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max min-w-[140px] p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all z-50 flex flex-col gap-1">
                            <p className="text-[12px] text-[var(--text-primary)] font-medium">
                              {appt.clientName}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {appt.service} • {appt.duration} min
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
        /* List View */
        <GlassCard hoverable={false} padding="md">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  {[
                    "Time",
                    "Client",
                    "Service",
                    "Barber",
                    "Price",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt, i) => {
                  const colors = statusColors[appt.status];
                  return (
                    <motion.tr
                      key={appt.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-light tabular-nums">
                        {appt.time}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-light">
                        {appt.clientName}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] font-light">
                        {appt.service}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] font-light">
                        {appt.barberName}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                        {appt.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize transition-shadow",
                            colors.bg,
                            colors.border,
                            colors.text,
                            appt.status === "confirmed"
                              ? "hover:shadow-glow-blue"
                              : appt.status === "completed"
                                ? "hover:shadow-glow-mint"
                                : appt.status === "no-show"
                                  ? "hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                                  : "",
                          )}
                        >
                          {appt.status === "no-show" ? "No Show" : appt.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
