// Marketing footer (§5.9) for the marketplace home and the for-business
// page. Server-safe (no hooks): pass the locale, dictionary and, when known,
// the same page in the other language for the language link.

import React from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import type { TranslationKeys } from "@/i18n/en";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/recipes";

/** The Halaqy wordmark: teal mark + name. Always LTR (it is a logo). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn("inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-ink", className)}
      style={{ fontFamily: "var(--font-bdo-grotesk), system-ui, sans-serif" }}
    >
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-brand text-[15px] leading-none text-on-brand">
        H
      </span>
      Halaqy
    </span>
  );
}

const linkCls = cn("rounded-sm text-sm leading-8 text-ink-muted transition-colors hover:text-ink", focusRing);

export function SiteFooter({
  locale,
  t,
  languageHref,
  className,
}: {
  locale: "en" | "ar";
  t: TranslationKeys;
  /** This page in the other language (shows the language link). */
  languageHref?: string;
  className?: string;
}) {
  const S = t.search;
  const L = t.landing;
  const href = (path: string) => `/${locale}${path}`;
  const year = new Date().getFullYear();
  const other = locale === "ar" ? "en" : "ar";

  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: S.footerCustomers,
      links: [
        { href: href("/explore"), label: L.navFindBarber },
        { href: href("/customer"), label: t.explore.myBookings },
        { href: href("/customer/login"), label: t.explore.signIn },
      ],
    },
    {
      title: S.forBusinessNav,
      links: [
        { href: href("/for-business"), label: S.forBusinessNav },
        { href: href("/start"), label: L.heroOwnerCta },
        { href: `${href("/for-business")}#pricing`, label: L.navPricing },
        { href: href("/auth/login"), label: L.navLogin },
      ],
    },
    {
      title: L.legal,
      links: [
        { href: href("/privacy"), label: L.privacy },
        { href: href("/terms"), label: L.terms },
        { href: href("/policy"), label: L.cancellationPolicy },
      ],
    },
  ];

  return (
    <footer className={cn("mt-16 border-t border-line bg-card", className)}>
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div className="space-y-4">
          <Link href={href("/landing")} aria-label={S.homeLink} className={cn("inline-block rounded-lg", focusRing)}>
            <Wordmark />
          </Link>
          <p className="max-w-xs text-sm text-ink-muted">{S.footerTagline}</p>
          {languageHref && (
            <Link
              href={languageHref}
              hrefLang={other}
              lang={other}
              aria-label={L.switchLanguage}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink hover:border-ink hover:bg-sunken",
                focusRing,
              )}
            >
              <Globe size={16} aria-hidden="true" />
              {t.topbar.language}
            </Link>
          )}
        </div>
        {columns.map((col, i) => (
          <nav key={i} aria-label={col.title}>
            <h2 className="mb-3 text-sm font-semibold text-ink">{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[13px] text-ink-muted sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            <span dir="ltr">© {year} Halaqy.</span> {L.allRightsReserved}
          </p>
          <p>{S.footerLocation}</p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
