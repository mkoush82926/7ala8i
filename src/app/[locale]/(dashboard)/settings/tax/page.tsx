"use client";

import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { BusinessSettingsShell } from "../hours/settings-shell";
import { TaxSettings } from "./tax-settings";

export default function TaxSettingsRoute() {
  const { t } = useTranslation();
  return (
    <BusinessSettingsShell page="tax" title={t.taxSettings.pageTitle} subtitle={t.taxSettings.pageSubtitle}>
      <TaxSettings />
    </BusinessSettingsShell>
  );
}
