"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsSubpageHeader } from "@/components/settings/settings-subpage-header";
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
  const { t, href } = useTranslation();
  const tn = t.settingsPages;
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24 lg:gap-6">
      <SettingsSubpageHeader
        title={t.links.settings.pageTitle}
        subtitle={t.links.settings.pageSubtitle}
        backHref={href("/settings")}
        backLabel={tn.back}
      />

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
