"use client";

import { useCallback } from "react";
import { useTranslation } from "@/hooks/use-translation";
import type { AppointmentStatus } from "@/lib/types";

/** Localised label for a canonical appointment status. */
export function useStatusLabel() {
  const { t } = useTranslation();
  return useCallback(
    (status: AppointmentStatus): string => {
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
    },
    [t],
  );
}
