"use client";

import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { BusinessSettingsShell } from "../hours/settings-shell";
import { PaymentsSettings } from "./payments-settings";

export default function PaymentsSettingsRoute() {
  const { t } = useTranslation();
  return (
    <BusinessSettingsShell page="payments" title={t.paymentSettings.pageTitle} subtitle={t.paymentSettings.pageSubtitle}>
      <PaymentsSettings />
    </BusinessSettingsShell>
  );
}
