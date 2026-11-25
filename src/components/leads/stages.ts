"use client";

import { useMemo } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { LEAD_STAGES, type LeadStage } from "@/lib/types";

export interface StageMeta {
  id: LeadStage;
  label: string;
  color: string;
}

/**
 * Stage hues from the v2 chart palette (theme-aware CSS vars). Used for dots,
 * column accents and tints only — stage text is always ink, so contrast never
 * depends on the hue.
 */
export const STAGE_COLORS: Record<LeadStage, string> = {
  new: "var(--color-chart-2)",
  contacted: "var(--color-chart-3)",
  booked: "var(--color-chart-1)",
  completed: "var(--color-success)",
  regular: "var(--color-chart-4)",
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
