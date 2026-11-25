"use client";

import { ButtonLink } from "@/components/ui/button";
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
      className="flex min-h-[100dvh] items-center justify-center bg-page px-4 py-12"
    >
      <div className="fade-slide-up w-full max-w-md rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-card sm:px-10">
        <div
          aria-hidden="true"
          className="bg-hatch-ink mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-text"
        >
          <SearchX size={28} />
        </div>
        <p aria-hidden="true" dir="ltr" className="mb-2 select-none text-sm font-semibold tabular-nums text-ink-muted">
          404
        </p>
        <h1 id="not-found-title" className="text-h2 mb-2 text-ink">
          {t.error.notFoundTitle}
        </h1>
        <p className="text-body mx-auto mb-8 max-w-sm text-ink-soft">{t.error.notFoundMessage}</p>

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <ButtonLink href={href("/explore")} size="lg" className="flex-1" icon={<Search aria-hidden="true" />}>
            {t.error.browseBarbers}
          </ButtonLink>
          <ButtonLink href={href("/")} variant="secondary" size="lg" className="flex-1" icon={<Home aria-hidden="true" />}>
            {t.error.goHome}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
