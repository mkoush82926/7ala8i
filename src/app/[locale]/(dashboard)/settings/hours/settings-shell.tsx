"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsSubpageHeader } from "@/components/settings/settings-subpage-header";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type BusinessSettingsPage = "hours" | "payments" | "tax";

/**
 * Frame shared by /settings/hours, /settings/payments and /settings/tax:
 * back link, heading, a sub-navigation between the three pages, and the
 * shop-admin gate (the dashboard layout already guards /settings/*; this
 * keeps a direct render safe while the workspace hydrates).
 */
export function BusinessSettingsShell({
  page,
  title,
  subtitle,
  children,
}: {
  page: BusinessSettingsPage;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { t, href } = useTranslation();
  const tn = t.settingsPages;
  const pathname = usePathname();
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);

  const links: { id: BusinessSettingsPage; label: string }[] = [
    { id: "hours", label: tn.hours },
    { id: "payments", label: tn.payments },
    { id: "tax", label: tn.tax },
  ];

  return (
    <div className="page-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24 lg:gap-6">
      <SettingsSubpageHeader
        title={title}
        subtitle={subtitle}
        backHref={href("/settings")}
        backLabel={tn.back}
      />

      <nav aria-label={tn.navLabel} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul role="list" className="m-0 flex w-max list-none gap-1 rounded-full bg-sunken p-1">
          {links.map((l) => {
            const target = href(`/settings/${l.id}`);
            const active = l.id === page || pathname === target;
            return (
              <li key={l.id}>
                <Link
                  href={target}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-150",
                    active
                      ? "bg-card text-ink shadow-xs"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!hydrated ? (
        <ListSkeleton rows={4} />
      ) : role !== "shop_admin" ? (
        <EmptyState icon={Lock} title={tn.adminOnly} description={tn.adminOnlyHint} action={{ label: tn.back, href: href("/settings") }} />
      ) : (
        children
      )}
    </div>
  );
}
