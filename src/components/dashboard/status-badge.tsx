"use client";

import React from "react";
import { Armchair, Check, CheckCheck, Clock, DoorOpen, Hourglass, UserX, XCircle, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { Pill, type PillTone } from "@/components/ui/pill";
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/en";

/** v2 §5.5 tones: confirmed → brand, completed → success, pending → warning, no-show → danger, cancelled → neutral. */
const TONE: Record<AppointmentStatus, PillTone> = {
  pending: "warning",
  confirmed: "brand",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
  arrived: "brand",
  in_chair: "brand",
  awaiting_deposit: "warning",
};

/** Status is never colour alone: every tone carries an icon and a label. */
const ICON: Record<AppointmentStatus, LucideIcon> = {
  pending: Clock,
  confirmed: Check,
  completed: CheckCheck,
  no_show: UserX,
  cancelled: XCircle,
  arrived: DoorOpen,
  in_chair: Armchair,
  awaiting_deposit: Hourglass,
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
    case "arrived":
      return t.calendar.arrived;
    case "in_chair":
      return t.calendar.inChair;
    case "awaiting_deposit":
      return t.calendar.awaitingDeposit;
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
  const Icon = paid ? CheckCheck : ICON[s];
  return (
    <Pill tone={paid ? "success" : TONE[s]} icon={<Icon />} className={className}>
      {paid ? t.dashboard.paid : statusLabel(t, s)}
    </Pill>
  );
}
