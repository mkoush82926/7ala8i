"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting";
import { Button, ButtonLink } from "@/components/ui/button";
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
    void reportError(error, { tags: { digest: error.digest, boundary: "locale" } });
  }, [error]);

  return (
    <main
      id="main"
      dir={dir}
      aria-labelledby="error-title"
      className="flex min-h-[100dvh] items-center justify-center bg-page px-4 py-12"
    >
      <div className="fade-slide-up w-full max-w-md rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-card sm:px-10">
        <div
          aria-hidden="true"
          className="bg-hatch-ink mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-danger-soft text-danger-text"
        >
          <AlertTriangle size={28} />
        </div>
        <h1 id="error-title" className="text-h2 mb-2 text-ink">
          {t.error.title}
        </h1>
        <p role="alert" className="text-body mx-auto mb-8 max-w-sm text-ink-soft">
          {t.error.message}
        </p>

        <div className="flex flex-col gap-3">
          <Button onClick={reset} size="lg" fullWidth icon={<RefreshCw aria-hidden="true" />}>
            {t.error.tryAgain}
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={href("/")} variant="secondary" className="flex-1" icon={<Home aria-hidden="true" />}>
              {t.error.goHome}
            </ButtonLink>
            <ButtonLink href={href("/explore")} variant="secondary" className="flex-1" icon={<Search aria-hidden="true" />}>
              {t.error.browseBarbers}
            </ButtonLink>
          </div>
        </div>

        {error.digest && (
          <p className="mt-8 border-t border-line pt-5 text-xs text-ink-muted">
            {t.error.reference}:{" "}
            <code dir="ltr" className="select-all font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
