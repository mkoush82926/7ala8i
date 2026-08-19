"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, dir, FF } = useTranslation();

  return (
    <div
      dir={dir}
      style={{ fontFamily: FF }}
      className="min-h-screen flex items-center justify-center p-8"
    >
      <div className="text-center" style={{ maxWidth: 400 }}>
        <div
          className="rounded-2xl bg-[var(--accent-rose-muted)] flex items-center justify-center mx-auto"
          style={{ width: 64, height: 64, marginBottom: 24 }}
        >
          <AlertTriangle size={28} className="text-[var(--accent-rose)]" />
        </div>
        <h2 className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 20, marginBottom: 8 }}>
          {t.error.title}
        </h2>
        <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          {error.message || t.error.message}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 h-11 px-6 rounded bg-[var(--accent-mint)] text-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={16} /> {t.error.tryAgain}
        </button>
      </div>
    </div>
  );
}
