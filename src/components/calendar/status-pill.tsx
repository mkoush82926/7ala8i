"use client";

import React from "react";
import { Armchair, Check, CheckCheck, Clock, DoorOpen, Hourglass, UserX, XCircle } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { AppointmentStatus } from "@/lib/types";
import { useStatusLabel } from "./status-label";

const TONE: Record<AppointmentStatus, PillTone> = {
  pending: "neutral",
  confirmed: "ink",
  awaiting_deposit: "brass",
  arrived: "brass",
  in_chair: "success",
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
