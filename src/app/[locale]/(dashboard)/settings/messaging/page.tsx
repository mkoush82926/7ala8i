"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsSubpageHeader } from "@/components/settings/settings-subpage-header";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagingActivity } from "./messaging-activity";
import { MessagingSettingsForm } from "./messaging-settings";
import { TemplateDrafts } from "./template-drafts";

/**
 * /[locale]/settings/messaging (WS-1C): delivery status, this month's cost
 * against the plan allowance, wa.me click-to-send for messages that could
 * not go out automatically, and the reminder / quiet-hours / channel
 * settings. Shop admin only (the dashboard layout guards /settings/*).
 */
export default function MessagingSettingsRoute() {
  const { t, href } = useTranslation();
  const tm = t.messaging;
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24 lg:gap-6">
      <SettingsSubpageHeader
        title={tm.pageTitle}
        subtitle={tm.pageSubtitle}
        backHref={href("/settings")}
        backLabel={t.settingsPages.back}
      />

      {!hydrated ? (
        <ListSkeleton rows={4} />
      ) : role !== "shop_admin" ? (
        <EmptyState
          icon={Lock}
          title={t.settingsPages.adminOnly}
          description={t.settingsPages.adminOnlyHint}
          action={{ label: t.settingsPages.back, href: href("/settings") }}
        />
      ) : (
        <>
          <MessagingActivity />
          <MessagingSettingsForm />
          <TemplateDrafts />
        </>
      )}
    </div>
  );
}
