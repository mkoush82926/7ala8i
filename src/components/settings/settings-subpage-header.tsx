"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/ui/recipes";

/**
 * Header for a dedicated settings page (§6.18): round back button to the
 * settings hub, page title (H1) and a one-line description.
 */
export function SettingsSubpageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref: string;
  backLabel: string;
  /** Optional end slot (e.g. a status pill). */
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <Link
        href={backHref}
        aria-label={backLabel}
        title={backLabel}
        className={buttonClasses({ variant: "secondary", size: "icon", className: "mt-0.5" })}
      >
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-h2 text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 self-center">{action}</div>}
    </header>
  );
}

export default SettingsSubpageHeader;
