"use client";

import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/en";
import { cn } from "@/lib/utils";

const BADGE_CLASS: Record<AppointmentStatus, string> = {
  pending: "badge-pending",
  confirmed: "badge-upcoming",
  completed: "badge-completed",
  no_show: "badge-noshow",
  cancelled: "badge-cancelled",
};

export function statusLabel(t: TranslationKeys, status: AppointmentStatus): string {
  switch (status) {
    case "pending":
      return t.calendar.pending;
    case "confirmed":
      return t.calendar.confirmed;
    case "completed":
      return t.calendar.completed;
    case "no_show":
      return t.calendar.noShow;
    case "cancelled":
      return t.calendar.cancelled;
  }
}

/** Localised appointment status pill; accepts legacy values ("no-show"). */
export function StatusBadge({
  status,
  paid = false,
  className,
}: {
  status: string | null | undefined;
  /** Show "Paid" instead of the status (completed + paid). */
  paid?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const s = normalizeAppointmentStatus(status) ?? "confirmed";
  return (
    <span className={cn("badge font-bold", paid ? "badge-completed" : BADGE_CLASS[s], className)}>
      {paid ? t.dashboard.paid : statusLabel(t, s)}
    </span>
  );
}
