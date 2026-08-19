"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function LocaleNotFound() {
  const { t, dir, locale, FF } = useTranslation();

  return (
    <div
      dir={dir}
      style={{ fontFamily: FF }}
      className="min-h-screen flex items-center justify-center p-8"
    >
      <div className="text-center" style={{ maxWidth: 400 }}>
        <div
          className="rounded-2xl bg-[var(--accent-mint-muted)] flex items-center justify-center mx-auto"
          style={{ width: 64, height: 64, marginBottom: 24 }}
        >
          <SearchX size={28} className="text-[var(--accent-mint)]" />
        </div>
        <h2 className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 20, marginBottom: 8 }}>
          {t.error.notFoundTitle}
        </h2>
        <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          {t.error.notFoundMessage}
        </p>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 h-11 px-6 rounded bg-[var(--accent-mint)] text-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
        >
          {t.error.goHome}
        </Link>
      </div>
    </div>
  );
}
