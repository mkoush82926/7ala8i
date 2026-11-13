"use client";

import { useMemo } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { LEAD_STAGES, type LeadStage } from "@/lib/types";

export interface StageMeta {
  id: LeadStage;
  label: string;
  color: string;
}

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: "var(--accent-blue)",
  contacted: "var(--accent-lavender)",
  booked: "var(--accent-amber)",
  completed: "var(--accent-mint)",
  regular: "var(--accent-rose)",
};

/** Pill classes for a stage badge (text + tinted background tokens). */
export const STAGE_PILL: Record<LeadStage, string> = {
  new: "text-[var(--accent-blue)] bg-[var(--accent-blue-muted)]",
  contacted: "text-[var(--accent-lavender)] bg-[var(--accent-lavender-muted)]",
  booked: "text-[var(--accent-amber)] bg-[var(--accent-amber-muted)]",
  completed: "text-[var(--accent-mint)] bg-[var(--accent-mint-muted)]",
  regular: "text-[var(--accent-rose)] bg-[var(--accent-rose-muted)]",
};

/** Pipeline stages in order, with localised labels. */
export function useStages(): StageMeta[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const labels: Record<LeadStage, string> = {
      new: t.leads.newLead,
      contacted: t.leads.contacted,
      booked: t.leads.bookedPackage,
      completed: t.leads.completedStage,
      regular: t.leads.loyal,
    };
    return LEAD_STAGES.map((id) => ({ id, label: labels[id], color: STAGE_COLORS[id] }));
  }, [t]);
}
