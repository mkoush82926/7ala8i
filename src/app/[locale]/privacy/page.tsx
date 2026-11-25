import type { Metadata } from "next";
import { LegalPage, PRIVACY_LAST_UPDATED, legalMetadata, resolveLegalLocale } from "./legal-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolveLegalLocale((await params).locale);
  return legalMetadata(locale, "privacy", t.landing.privacy, t.legal.privacyIntro);
}

/**
 * Privacy notice, aligned with Jordan's Personal Data Protection Law
 * (Law No. 24 of 2023). Arabic is the reference text. Still marked as a
 * draft until counsel signs it off (roadmap §3, owner action 4).
 */
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
      lastUpdated={PRIVACY_LAST_UPDATED}
      sections={[
        { title: l.privacyControllerTitle, body: l.privacyControllerBody },
        { title: l.privacyCollectTitle, body: l.privacyCollectBody },
        { title: l.privacyUseTitle, body: l.privacyUseBody },
        { title: l.privacyLegalBasisTitle, body: l.privacyLegalBasisBody },
        { title: l.privacyConsentTitle, body: l.privacyConsentBody },
        { title: l.privacyShareTitle, body: l.privacyShareBody },
        { title: l.privacyProcessorsTitle, body: l.privacyProcessorsBody },
        { title: l.privacyCookiesTitle, body: l.privacyCookiesBody },
        { title: l.privacyRetentionTitle, body: l.privacyRetentionBody },
        { title: l.privacyRightsTitle, body: l.privacyRightsBody },
        { title: l.privacyDeletionTitle, body: l.privacyDeletionBody },
        { title: l.privacySecurityTitle, body: l.privacySecurityBody },
        { title: l.privacyChildrenTitle, body: l.privacyChildrenBody },
        { title: l.privacyComplaintsTitle, body: l.privacyComplaintsBody },
      ]}
      actionsTitle={l.privacyActionsTitle}
      actions={[
        { label: l.privacyActionAccount, href: `/${locale}/customer/account` },
        { label: l.privacyActionPhoneLogin, href: `/${locale}/customer/login` },
      ]}
      closing={l.contactPending}
    />
  );
}
