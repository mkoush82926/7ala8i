"use client";

import React from "react";
import { Armchair, Check, CheckCheck, Clock, DoorOpen, Hourglass, UserX, XCircle } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { AppointmentStatus } from "@/lib/types";
import { useStatusLabel } from "./status-label";

/** §5.5 status tones: confirmed → brand, pending → warning, done → success, no-show → danger. */
const TONE: Record<AppointmentStatus, PillTone> = {
  pending: "warning",
  confirmed: "brand",
  awaiting_deposit: "accent",
  arrived: "brand",
  in_chair: "ink",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
};

const ICON: Record<AppointmentStatus, React.ComponentType<{ size?: number }>> = {
  pending: Clock,
  confirmed: Check,
  awaiting_deposit: Hourglass,
  arrived: DoorOpen,
  in_chair: Armchair,
  completed: CheckCheck,
  no_show: UserX,
  cancelled: XCircle,
};

/** Status always pairs colour with an icon and a label (never colour alone). */
export function StatusPill({ status, size = "sm" }: { status: AppointmentStatus; size?: "sm" | "md" }) {
  const label = useStatusLabel()(status);
  const Icon = ICON[status];
  return (
    <Pill tone={TONE[status]} size={size} icon={<Icon size={12} />}>
      {label}
    </Pill>
  );
}

export function StatusIcon({ status, size = 12 }: { status: AppointmentStatus; size?: number }) {
  const Icon = ICON[status];
  return (
    <span aria-hidden="true" className="inline-flex">
      <Icon size={size} />
    </span>
  );
}
