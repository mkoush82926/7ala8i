// Shared server-rendered layout for the legal pages (privacy, terms,
// cancellation policy). No client JS: the copy comes from the dictionaries on
// the server, so these pages are fully static per locale.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, Languages } from "lucide-react";
import en, { type TranslationKeys } from "@/i18n/en";
import ar from "@/i18n/ar";
import { cn, formatDate } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { buttonClasses, containerClasses, focusRing } from "@/components/ui/recipes";

export type LegalLocale = "en" | "ar";
export type LegalSlug = "privacy" | "terms" | "policy";

/** Date the legal copy was last revised (YYYY-MM-DD). */
export const LEGAL_LAST_UPDATED = "2026-11-12";

/** The privacy notice was revised separately for the PDPL (Law No. 24 of 2023). */
export const PRIVACY_LAST_UPDATED = "2026-11-13";

export function resolveLegalLocale(raw: string | undefined): { locale: LegalLocale; t: TranslationKeys } {
  const locale: LegalLocale = raw === "ar" ? "ar" : "en";
  return { locale, t: locale === "ar" ? ar : en };
}

export function legalMetadata(locale: LegalLocale, slug: LegalSlug, title: string, description: string): Metadata {
  return {
    title, // the root layout template appends the brand
    description,
    alternates: {
      canonical: `/${locale}/${slug}`,
      languages: { en: `/en/${slug}`, ar: `/ar/${slug}`, "x-default": `/en/${slug}` },
    },
    openGraph: {
      title: `${title} — ${(locale === "ar" ? ar : en).sidebar.brand}`,
      description,
      url: `/${locale}/${slug}`,
    },
  };
}

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalAction {
  label: string;
  href: string;
}

export function LegalPage({
  locale,
  t,
  slug,
  title,
  badge,
  intro,
  sections,
  closing,
  lastUpdated = LEGAL_LAST_UPDATED,
  actions,
  actionsTitle,
}: {
  locale: LegalLocale;
  t: TranslationKeys;
  slug: LegalSlug;
  title: string;
  badge: string;
  intro: string;
  sections: LegalSection[];
  closing?: string;
  /** YYYY-MM-DD shown under the title. */
  lastUpdated?: string;
  /** Self-service links shown after the sections (e.g. export / delete). */
  actions?: LegalAction[];
  actionsTitle?: string;
}) {
  const isRTL = locale === "ar";
  const other: LegalLocale = isRTL ? "en" : "ar";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRTL ? ArrowLeft : ArrowRight;
  const year = new Date().getFullYear();

  const related: { slug: LegalSlug; label: string }[] = [
    { slug: "privacy", label: t.landing.privacy },
    { slug: "terms", label: t.landing.terms },
    { slug: "policy", label: t.landing.cancellationPolicy },
  ];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="flex min-h-[100dvh] flex-col bg-page text-ink">
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>

      <header className="sticky top-0 z-40 h-16 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className={cn(containerClasses, "flex h-full items-center justify-between gap-4")}>
          <Link
            href={`/${locale}/landing`}
            aria-label={t.landing.homeLink}
            dir="ltr"
            className={cn("rounded-md text-xl font-extrabold tracking-tight text-ink no-underline", focusRing)}
          >
            Halaqy<span className="text-brand-text">.</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href={`/${other}/${slug}`}
              hrefLang={other}
              lang={other}
              aria-label={t.landing.switchLanguage}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              <Languages aria-hidden="true" />
              {t.topbar.language}
            </Link>
            <Link href={`/${locale}/landing`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <BackIcon aria-hidden="true" />
              <span className="hidden sm:inline">{t.legal.backHome}</span>
              <span className="sm:hidden">{t.common.back}</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16 lg:px-8">
          <article className="min-w-0 max-w-3xl" aria-labelledby="legal-title">
            <Pill tone="brand" size="md" icon={<Info aria-hidden="true" />} className="mb-5">
              {badge}
            </Pill>

            <h1 id="legal-title" className="text-h1 mb-3 text-ink">
              {title}
            </h1>
            <p className="text-meta mb-8">
              {t.legal.lastUpdated}{" "}
              <time dateTime={lastUpdated}>{formatDate(lastUpdated, locale, "long")}</time>
            </p>

            <p className="text-body-lg mb-10 max-w-[65ch] text-ink-soft">{intro}</p>

            <div className="flex flex-col gap-10">
              {sections.map((section, i) => (
                <section key={i} id={`legal-section-${i}`} aria-labelledby={`legal-s${i}`} className="scroll-mt-24">
                  <h2 id={`legal-s${i}`} className="text-h3 mb-3 text-ink">
                    {section.title}
                  </h2>
                  <p className="text-body max-w-[65ch] text-ink-soft">{section.body}</p>
                </section>
              ))}
            </div>

            {actions && actions.length > 0 && (
              <section aria-labelledby="legal-actions" className="mt-12 rounded-xl border border-line bg-card p-5 shadow-card lg:p-6">
                {actionsTitle && (
                  <h2 id="legal-actions" className="text-h3 mb-4 text-ink">
                    {actionsTitle}
                  </h2>
                )}
                <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {actions.map((action) => (
                    <li key={action.href}>
                      <Link href={action.href} className={buttonClasses({ variant: "secondary", fullWidth: true, className: "sm:w-auto" })}>
                        {action.label}
                        <ForwardIcon aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {closing && (
              <section aria-labelledby="legal-questions" className="mt-12 rounded-xl bg-sunken p-5 lg:p-6">
                <h2 id="legal-questions" className="text-h3 mb-2 text-ink">
                  {t.legal.questionsTitle}
                </h2>
                <p className="text-body max-w-[65ch] text-ink-soft">{closing}</p>
              </section>
            )}
          </article>

          {sections.length > 2 && (
            <aside aria-labelledby="legal-toc" className="hidden lg:block">
              <nav className="sticky top-24">
                <h2 id="legal-toc" className="mb-3 text-xs font-semibold text-ink-muted">
                  {t.legal.onThisPage}
                </h2>
                <ol className="space-y-0.5 border-s border-line">
                  {sections.map((section, i) => (
                    <li key={i}>
                      <a
                        href={`#legal-section-${i}`}
                        className={cn(
                          "-ms-px block border-s-2 border-transparent py-1.5 ps-4 text-sm leading-5 text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink",
                          focusRing,
                        )}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-card">
        <div className={cn(containerClasses, "flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between")}>
          <nav aria-label={t.landing.legal}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${locale}/${item.slug}`}
                    aria-current={item.slug === slug ? "page" : undefined}
                    className={cn(
                      "rounded-sm",
                      focusRing,
                      item.slug === slug
                        ? "font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-[13px] text-ink-muted">
            <span dir="ltr">© {year} Halaqy.</span> {t.landing.allRightsReserved}
          </p>
        </div>
      </footer>
    </div>
  );
}
