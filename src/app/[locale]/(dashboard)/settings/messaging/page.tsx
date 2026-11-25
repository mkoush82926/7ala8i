"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
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
  const { t, isRTL, FFD, href } = useTranslation();
  const tm = t.messaging;
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
      <header className="flex items-start gap-3">
        <Link
          href={href("/settings")}
          aria-label={t.settingsPages.back}
          className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1
            className="m-0 text-[24px] font-extrabold text-[var(--text-primary)] sm:text-[28px]"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.014em") }}
          >
            {tm.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{tm.pageSubtitle}</p>
        </div>
      </header>

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
