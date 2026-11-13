import type { Metadata } from "next";
import { LegalPage, legalMetadata, resolveLegalLocale } from "../privacy/legal-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolveLegalLocale((await params).locale);
  return legalMetadata(locale, "terms", t.landing.terms, t.legal.termsIntro);
}

export default async function TermsPage({ params }: Props) {
  const { locale, t } = resolveLegalLocale((await params).locale);
  const l = t.legal;

  return (
    <LegalPage
      locale={locale}
      t={t}
      slug="terms"
      title={t.landing.terms}
      badge={l.draftNotice}
      intro={l.termsIntro}
      sections={[
        { title: l.termsAccountTitle, body: l.termsAccountBody },
        { title: l.termsBookingsTitle, body: l.termsBookingsBody },
        { title: l.termsShopsTitle, body: l.termsShopsBody },
        { title: l.termsUseTitle, body: l.termsUseBody },
        { title: l.termsServiceTitle, body: l.termsServiceBody },
      ]}
      closing={l.contactPending}
    />
  );
}
