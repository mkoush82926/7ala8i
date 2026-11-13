import type { Metadata } from "next";
import { LegalPage, legalMetadata, resolveLegalLocale } from "../privacy/legal-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolveLegalLocale((await params).locale);
  return legalMetadata(locale, "policy", t.legal.policyTitle, t.legal.policyIntro);
}

/**
 * Cancellation & no-show policy. Must stay consistent with the DB:
 * cancel_customer_booking() blocks online cancellation inside the shop's
 * `cancellation_policy_hours` window (default 24h), and Halaqy never charges
 * fees or takes payments.
 */
export default async function PolicyPage({ params }: Props) {
  const { locale, t } = resolveLegalLocale((await params).locale);
  const l = t.legal;

  return (
    <LegalPage
      locale={locale}
      t={t}
      slug="policy"
      title={l.policyTitle}
      badge={l.policyBadge}
      intro={l.policyIntro}
      sections={[
        { title: l.policyWindowTitle, body: l.policyWindowBody },
        { title: l.policyChangeTitle, body: l.policyChangeBody },
        { title: l.policyNoShowTitle, body: l.policyNoShowBody },
        { title: l.policyFeesTitle, body: l.policyFeesBody },
      ]}
      closing={l.policyQuestions}
    />
  );
}
