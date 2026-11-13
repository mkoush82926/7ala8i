"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
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
  const { t, isRTL, FFD, href } = useTranslation();
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
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>
      </header>

      <nav aria-label={tn.navLabel} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul role="list" className="m-0 flex w-max list-none gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
          {links.map((l) => {
            const target = href(`/settings/${l.id}`);
            const active = l.id === page || pathname === target;
            return (
              <li key={l.id}>
                <Link
                  href={target}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
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
