"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LinksSettings } from "@/components/links/links-settings";

/**
 * /settings/links: branded booking link, QR posters, website and social
 * snippets, link theme and the channel funnel. Shop admins only (the
 * dashboard layout guards /settings/*; this keeps a direct render safe).
 */
export default function LinksSettingsRoute() {
  const { t, isRTL, FFD, href } = useTranslation();
  const tn = t.settingsPages;
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
      <header className="flex items-start gap-3">
        <Link
          href={href("/settings")}
          aria-label={tn.back}
          className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1
            className="m-0 text-[24px] font-extrabold text-[var(--text-primary)] sm:text-[28px]"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.014em") }}
          >
            {t.links.settings.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t.links.settings.pageSubtitle}</p>
        </div>
      </header>

      {!hydrated ? (
        <ListSkeleton rows={4} />
      ) : role !== "shop_admin" ? (
        <EmptyState icon={Lock} title={tn.adminOnly} description={tn.adminOnlyHint} action={{ label: tn.back, href: href("/settings") }} />
      ) : (
        <LinksSettings />
      )}
    </div>
  );
}
