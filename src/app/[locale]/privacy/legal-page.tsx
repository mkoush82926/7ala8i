// Shared server-rendered layout for the legal pages (privacy, terms,
// cancellation policy). No client JS: the copy comes from the dictionaries on
// the server, so these pages are fully static per locale.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import en, { type TranslationKeys } from "@/i18n/en";
import ar from "@/i18n/ar";
import { formatDate } from "@/lib/utils";

export type LegalLocale = "en" | "ar";
export type LegalSlug = "privacy" | "terms" | "policy";

/** Date the legal copy was last revised (YYYY-MM-DD). */
export const LEGAL_LAST_UPDATED = "2026-11-12";

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

export function LegalPage({
  locale,
  t,
  slug,
  title,
  badge,
  intro,
  sections,
  closing,
}: {
  locale: LegalLocale;
  t: TranslationKeys;
  slug: LegalSlug;
  title: string;
  badge: string;
  intro: string;
  sections: LegalSection[];
  closing?: string;
}) {
  const isRTL = locale === "ar";
  const other: LegalLocale = isRTL ? "en" : "ar";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const year = new Date().getFullYear();

  const related: { slug: LegalSlug; label: string }[] = [
    { slug: "privacy", label: t.landing.privacy },
    { slug: "terms", label: t.landing.terms },
    { slug: "policy", label: t.landing.cancellationPolicy },
  ];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="flex min-h-[100dvh] flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>

      <header className="auth-nav border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]" style={{ height: 72 }}>
        <Link
          href={`/${locale}/landing`}
          aria-label={t.landing.homeLink}
          dir="ltr"
          className="rounded-md text-[20px] font-extrabold text-[var(--text-primary)] no-underline"
          style={{ fontFamily: "var(--font-bdo-grotesk), system-ui, sans-serif", letterSpacing: "0.012em" }}
        >
          Halaqy<span className="text-[var(--accent-brass)]">.</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/${other}/${slug}`}
            hrefLang={other}
            lang={other}
            aria-label={t.landing.switchLanguage}
            className="btn btn-ghost"
            style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}
          >
            {t.topbar.language}
          </Link>
          <Link
            href={`/${locale}/landing`}
            className="btn btn-secondary"
            style={{ borderRadius: 9999, minHeight: 40, padding: "0 16px", fontSize: 14 }}
          >
            <BackIcon size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.legal.backHome}</span>
            <span className="sm:hidden">{t.common.back}</span>
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="landing-section flex-1 outline-none">
        <article className="mx-auto max-w-[720px]" aria-labelledby="legal-title">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--bg-secondary)] px-4 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
            <Info size={14} aria-hidden="true" className="shrink-0 text-[var(--accent-brass)]" />
            {badge}
          </p>

          <h1
            id="legal-title"
            className="mb-3 font-extrabold text-[var(--text-primary)]"
            style={{ fontSize: "clamp(2rem, 4vw, 2.6rem)", letterSpacing: isRTL ? "normal" : "0.014em", lineHeight: 1.15 }}
          >
            {title}
          </h1>
          <p className="mb-10 text-[14px] text-[var(--text-muted)]">
            {t.legal.lastUpdated}{" "}
            <time dateTime={LEGAL_LAST_UPDATED}>{formatDate(LEGAL_LAST_UPDATED, locale, "long")}</time>
          </p>

          <p className="mb-10 text-[17px] leading-[1.8] text-[var(--text-secondary)]">{intro}</p>

          <div className="flex flex-col gap-9">
            {sections.map((section, i) => (
              <section key={i} aria-labelledby={`legal-s${i}`}>
                <h2 id={`legal-s${i}`} className="mb-3 text-[19px] font-bold text-[var(--text-primary)]">
                  {section.title}
                </h2>
                <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">{section.body}</p>
              </section>
            ))}
          </div>

          {closing && (
            <section aria-labelledby="legal-questions" className="mt-12 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
              <h2 id="legal-questions" className="mb-2 text-[17px] font-bold text-[var(--text-primary)]">
                {t.legal.questionsTitle}
              </h2>
              <p className="text-[15px] leading-[1.75] text-[var(--text-secondary)]">{closing}</p>
            </section>
          )}
        </article>
      </main>

      <footer className="auth-footer border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label={t.landing.legal}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${locale}/${item.slug}`}
                    aria-current={item.slug === slug ? "page" : undefined}
                    className={
                      item.slug === slug
                        ? "font-semibold text-[var(--text-primary)] underline underline-offset-4 decoration-[var(--accent-brass)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-[13px] text-[var(--text-muted)]">
            <span dir="ltr">© {year} Halaqy.</span> {t.landing.allRightsReserved}
          </p>
        </div>
      </footer>
    </div>
  );
}
