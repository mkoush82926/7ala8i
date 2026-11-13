"use client";

import Link from "next/link";
import { Home, Search, SearchX } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

/**
 * 404 for every localized route. Most misses come from stale shop links, so
 * besides "home" (which middleware routes to the dashboard, the customer
 * portal or the landing page depending on who is signed in) we offer a direct
 * way back to browsing barbers.
 */
export default function LocaleNotFound() {
  const { t, dir, href } = useTranslation();

  return (
    <main
      id="main"
      dir={dir}
      aria-labelledby="not-found-title"
      className="min-h-[100dvh] flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)]"
    >
      <div className="w-full max-w-md text-center fade-slide-up">
        <p
          aria-hidden="true"
          dir="ltr"
          className="mb-4 text-[56px] font-extrabold leading-none tracking-tight text-[var(--border-subtle)] select-none"
        >
          404
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-secondary)]"
        >
          <SearchX size={28} className="text-[var(--accent-brass)]" />
        </div>
        <h1 id="not-found-title" className="mb-2 text-[22px] font-bold text-[var(--text-primary)]">
          {t.error.notFoundTitle}
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.error.notFoundMessage}
        </p>

        <div className="flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href={href("/explore")} className="btn btn-secondary">
            <Search size={16} aria-hidden="true" />
            {t.error.browseBarbers}
          </Link>
          <Link href={href("/")} className="btn btn-primary">
            <Home size={16} aria-hidden="true" />
            {t.error.goHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
