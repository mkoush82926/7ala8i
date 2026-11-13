"use client";

import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { BusinessSettingsShell } from "./settings-shell";
import { HoursSettings } from "./hours-settings";

export default function HoursSettingsRoute() {
  const { t } = useTranslation();
  return (
    <BusinessSettingsShell page="hours" title={t.shifts.hoursPageTitle} subtitle={t.shifts.hoursPageSubtitle}>
      <HoursSettings />
    </BusinessSettingsShell>
  );
}
