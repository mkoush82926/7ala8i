"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Route-level error boundary for every localized page.
 * Never renders `error.message` (client-side Supabase/JS errors would leak raw
 * internals); shows a friendly message plus the `digest` support reference,
 * which matches the server log line written by src/instrumentation.ts.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, dir, href } = useTranslation();

  useEffect(() => {
    // Client-side report; server errors are already logged with the same digest.
    console.error("[ui:error-boundary]", { digest: error.digest, name: error.name, message: error.message });
  }, [error]);

  return (
    <main
      id="main"
      dir={dir}
      aria-labelledby="error-title"
      className="min-h-[100dvh] flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)]"
    >
      <div className="w-full max-w-md text-center fade-slide-up">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-rose-muted)]"
        >
          <AlertTriangle size={28} className="text-[var(--accent-rose)]" />
        </div>
        <h1 id="error-title" className="mb-2 text-[22px] font-bold text-[var(--text-primary)]">
          {t.error.title}
        </h1>
        <p role="alert" className="mb-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.error.message}
        </p>

        <div className="flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href={href("/")} className="btn btn-secondary">
            <Home size={16} aria-hidden="true" />
            {t.error.goHome}
          </Link>
          <Link href={href("/explore")} className="btn btn-secondary">
            <Search size={16} aria-hidden="true" />
            {t.error.browseBarbers}
          </Link>
          <button type="button" onClick={reset} className="btn btn-primary">
            <RefreshCw size={16} aria-hidden="true" />
            {t.error.tryAgain}
          </button>
        </div>

        {error.digest && (
          <p className="mt-8 text-[12px] text-[var(--text-muted)]">
            {t.error.reference}:{" "}
            <code dir="ltr" className="select-all font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
