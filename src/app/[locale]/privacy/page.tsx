import type { Metadata } from "next";
import { LegalPage, legalMetadata, resolveLegalLocale } from "./legal-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolveLegalLocale((await params).locale);
  return legalMetadata(locale, "privacy", t.landing.privacy, t.legal.privacyIntro);
}

export default async function PrivacyPage({ params }: Props) {
  const { locale, t } = resolveLegalLocale((await params).locale);
  const l = t.legal;

  return (
    <LegalPage
      locale={locale}
      t={t}
      slug="privacy"
      title={t.landing.privacy}
      badge={l.draftNotice}
      intro={l.privacyIntro}
      sections={[
        { title: l.privacyCollectTitle, body: l.privacyCollectBody },
        { title: l.privacyUseTitle, body: l.privacyUseBody },
        { title: l.privacyShareTitle, body: l.privacyShareBody },
        { title: l.privacyCookiesTitle, body: l.privacyCookiesBody },
        { title: l.privacyRetentionTitle, body: l.privacyRetentionBody },
        { title: l.privacyRightsTitle, body: l.privacyRightsBody },
      ]}
      closing={l.contactPending}
    />
  );
}
