"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Error boundary for dashboard pages. It renders inside the shell (sidebar
 * and topbar stay usable), never shows raw `error.message`, and exposes the
 * digest as a support reference that matches the server log line.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, href } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error("[ui:dashboard-error]", { digest: error.digest, name: error.name, message: error.message });
    headingRef.current?.focus();
  }, [error]);

  return (
    <section aria-labelledby="dashboard-error-title" className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <div className="fade-slide-up w-full max-w-md text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-[var(--accent-rose-muted)]"
        >
          <AlertTriangle size={28} className="text-[var(--accent-rose)]" />
        </div>
        <h1
          id="dashboard-error-title"
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-[20px] font-bold text-[var(--text-primary)] outline-none"
        >
          {t.error.title}
        </h1>
        <p role="alert" className="mb-6 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {t.error.message}
        </p>
        <div className="flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href={href("/my-day")} className="btn btn-secondary">
            <LayoutDashboard size={16} aria-hidden="true" />
            {t.sidebar.myDay}
          </Link>
          <button type="button" onClick={reset} className="btn btn-primary">
            <RefreshCw size={16} aria-hidden="true" />
            {t.error.tryAgain}
          </button>
        </div>
        {error.digest && (
          <p className="mt-8 text-[12px] text-[var(--text-muted)]">
            {t.error.reference}: <code dir="ltr" className="select-all font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </section>
  );
}
