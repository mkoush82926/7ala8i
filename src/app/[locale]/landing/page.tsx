// Marketing landing page — a Server Component. All copy is rendered on the
// server from the locale dictionary (SEO, no copy shipped as JS); only the
// nav, scroll container and background videos are client islands.
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  Link2,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import en, { type TranslationKeys } from "@/i18n/en";
import ar from "@/i18n/ar";
import { formatCurrency } from "@/lib/utils";
import { BackgroundVideo, LandingNav, LandingShell } from "./landing-client";

type Props = { params: Promise<{ locale: string }> };

/** Listed price per barber per month (JOD). */
const PRICE_PER_BARBER = 1.5;

function resolve(raw: string | undefined): { locale: "en" | "ar"; t: TranslationKeys; isRTL: boolean } {
  const locale = raw === "ar" ? "ar" : "en";
  return { locale, t: locale === "ar" ? ar : en, isRTL: locale === "ar" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = resolve((await params).locale);
  return {
    title: { absolute: t.landing.metaTitle },
    description: t.landing.metaDescription,
    alternates: {
      canonical: `/${locale}/landing`,
      languages: { en: "/en/landing", ar: "/ar/landing", "x-default": "/en/landing" },
    },
    openGraph: { url: `/${locale}/landing`, title: t.landing.metaTitle, description: t.landing.metaDescription },
  };
}

// ─── Presentational helpers (server) ────────────────────────────────────────

const headingTracking = (isRTL: boolean, latin: string) => (isRTL ? "normal" : latin);

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  // .eyebrow = AA brass (#7c5a26 on light); the dark variant sits on ink.
  return (
    <p className="eyebrow" style={{ marginBottom: 16, ...(dark ? { color: "#d8b88a" } : {}) }}>
      {children}
    </p>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  isRTL,
  dark = false,
  marginBottom = 64,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  isRTL: boolean;
  dark?: boolean;
  marginBottom?: number;
}) {
  return (
    <Reveal>
      <div style={{ textAlign: "center", maxWidth: 560, margin: `0 auto ${marginBottom}px` }}>
        <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        <h2
          id={id}
          style={{
            fontWeight: 800,
            fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)",
            letterSpacing: headingTracking(isRTL, "0.014em"),
            color: dark ? "#ffffff" : "var(--text-primary)",
            marginBottom: subtitle ? 16 : 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: dark ? "rgba(255,255,255,0.75)" : "var(--text-secondary)", fontSize: 16, fontWeight: 300, lineHeight: 1.7 }}>
            {subtitle}
          </p>
        )}
      </div>
    </Reveal>
  );
}

function Statement({
  align,
  eyebrow,
  title,
  body,
  isRTL,
}: {
  align: "start" | "end";
  eyebrow: string;
  title: string;
  body: string;
  isRTL: boolean;
}) {
  return (
    <Reveal>
      <div className={`landing-statement${align === "end" ? " landing-statement--end" : ""}`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3
          style={{
            fontWeight: 800,
            fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)",
            letterSpacing: headingTracking(isRTL, "0.014em"),
            color: "var(--text-primary)",
            marginBottom: 20,
          }}
        >
          {title}
        </h3>
        <div className="landing-statement-rule" aria-hidden="true" style={{ width: 56, height: 2, background: "var(--accent-brass)", marginBottom: 20 }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 16, fontWeight: 300, lineHeight: 1.75 }}>{body}</p>
      </div>
    </Reveal>
  );
}

/** Splits "The future of {accent} management" around the accent word. */
function Headline({ template, accent }: { template: string; accent: string }) {
  const [before, after = ""] = template.split("{accent}");
  return (
    <>
      {before}
      <span style={{ color: "var(--accent-text)" }}>{accent}</span>
      {after}
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function LandingPage({ params }: Props) {
  const { locale, t, isRTL } = resolve((await params).locale);
  const L = t.landing;
  const Forward = isRTL ? ArrowLeft : ArrowRight;
  const year = new Date().getFullYear();
  const href = (path: string) => (path === "/" ? `/${locale}` : `/${locale}${path}`);
  const ownerSignup = `${href("/auth/signup")}?role=shop_admin`;

  const pillars: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: CalendarDays, title: L.pillarManage, desc: L.pillarManageDesc },
    { icon: CalendarCheck, title: L.pillarBook, desc: L.pillarBookDesc },
    { icon: TrendingUp, title: L.pillarGrow, desc: L.pillarGrowDesc },
  ];

  const features: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: CalendarDays, title: L.featureCalendar, desc: L.featCalendarDesc },
    { icon: Workflow, title: L.featureCrm, desc: L.featCrmDesc },
    { icon: Link2, title: L.featureBooking, desc: L.featBookingDesc },
    { icon: BarChart3, title: L.featInsights, desc: L.featInsightsDesc },
    { icon: ShieldCheck, title: L.featReviews, desc: L.featReviewsDesc },
    { icon: MonitorSmartphone, title: L.featAnyDevice, desc: L.featAnyDeviceDesc },
  ];

  const steps = [
    { num: "01", title: L.stepSetupTitle, desc: L.stepSetupDesc },
    { num: "02", title: L.stepShareTitle, desc: L.stepShareDesc },
    { num: "03", title: L.pillarGrow, desc: L.stepGrowDesc },
  ];

  const planFeatures = [
    L.pricingFeature1,
    L.pricingFeature2,
    L.pricingFeature3,
    L.pricingFeature4,
    L.planFeatureTeam,
    L.featAnyDevice,
  ];

  const footerLinks = [
    { href: href("/explore"), label: L.navFindBarber },
    { href: "#features", label: L.navFeatures },
    { href: "#pricing", label: L.navPricing },
    { href: href("/auth/login"), label: L.navLogin },
  ];
  const legalLinks = [
    { href: href("/privacy"), label: L.privacy },
    { href: href("/terms"), label: L.terms },
    { href: href("/policy"), label: L.cancellationPolicy },
  ];

  const pillCta = { minHeight: 56, padding: "0 32px", borderRadius: 9999, fontSize: 15, fontWeight: 700 } as const;

  return (
    <LandingShell>
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>
      <LandingNav />

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {/* ═══ HERO — two clear paths: shop owners and customers ═══ */}
        <section
          aria-labelledby="hero-title"
          className="landing-snap-page"
          style={{
            position: "relative",
            overflow: "hidden",
            alignItems: "center",
            background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
            padding: "128px 16px 112px",
          }}
        >
          <div className="fade-slide-up" style={{ position: "relative", zIndex: 1, maxWidth: 760, textAlign: "center" }}>
            <Eyebrow>{L.heroEyebrow}</Eyebrow>

            <h1
              id="hero-title"
              style={{
                fontWeight: 800,
                fontSize: "clamp(2.4rem, 6.5vw, 4.6rem)",
                lineHeight: 1.08,
                letterSpacing: headingTracking(isRTL, "0.014em"),
                color: "var(--text-primary)",
                marginBottom: 24,
              }}
            >
              <Headline template={L.heroHeadline} accent={L.heroHeadlineAccent} />
            </h1>

            <p style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 300, lineHeight: 1.7, maxWidth: 540, margin: "0 auto 40px" }}>
              {L.heroLead}
            </p>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link href={ownerSignup} className="btn btn-primary" style={pillCta}>
                {L.heroOwnerCta}
                <Forward size={18} aria-hidden="true" />
              </Link>
              <Link href={href("/explore")} className="btn btn-secondary" style={pillCta}>
                <Search size={18} aria-hidden="true" />
                {L.heroCustomerCta}
              </Link>
            </div>
            <p style={{ marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>{L.heroAudienceNote}</p>
          </div>

          <a
            href="#why"
            className="hidden md:block"
            style={{
              position: "absolute",
              bottom: 32,
              insetInline: 0,
              width: "fit-content",
              margin: "0 auto",
              zIndex: 1,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--text-muted)",
              paddingBottom: 4,
              textDecoration: "none",
            }}
          >
            {L.scrollHint}
          </a>
        </section>

        {/* ═══ VALUE PILLARS ═══ */}
        <section id="why" aria-labelledby="why-title" className="landing-snap-page" style={{ background: "var(--bg-primary)", padding: "96px 16px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
            <SectionHeading id="why-title" isRTL={isRTL} eyebrow={L.whyEyebrow} title={L.whyTitle} marginBottom={64} />
            <ul className="card-grid-3">
              {pillars.map((p, i) => {
                const Icon = p.icon;
                return (
                  <li key={p.title}>
                    <Reveal delay={i * 0.08}>
                      <div style={{ textAlign: "center" }}>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 9999,
                            background: "var(--bg-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 24px",
                          }}
                        >
                          <Icon size={24} className="text-[var(--accent-brass)]" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", marginBottom: 10 }}>{p.title}</h3>
                        <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.7, fontWeight: 300 }}>{p.desc}</p>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" aria-labelledby="features-title" className="landing-snap-page" style={{ background: "var(--bg-secondary)", padding: "96px 16px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
            <SectionHeading id="features-title" isRTL={isRTL} eyebrow={L.navFeatures} title={L.featuresHeading} subtitle={L.featuresLead} />
            <div
              style={{
                borderRadius: 20,
                overflow: "hidden",
                border: "1px solid var(--border-subtle)",
                background: "var(--border-subtle)",
                boxShadow: "0 32px 70px -32px rgba(28,22,17,0.12)",
              }}
            >
              <ul className="landing-feature-grid">
                {features.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <li key={f.title} className="h-full">
                      <Reveal delay={i * 0.05} className="h-full">
                        <div className="landing-feature-cell group">
                          <div className="landing-feature-icon" aria-hidden="true">
                            <Icon size={20} className="text-[var(--accent-brass)] transition-colors group-hover:text-[var(--on-accent)]" />
                          </div>
                          <h3 style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 10 }}>{f.title}</h3>
                          <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
                        </div>
                      </Reveal>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section aria-labelledby="how-title" className="landing-snap-page" style={{ background: "var(--bg-primary)", padding: "96px 16px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
            <SectionHeading id="how-title" isRTL={isRTL} eyebrow={L.howEyebrow} title={L.howHeading} subtitle={L.howLead} marginBottom={56} />
            <ol style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {steps.map((step, i) => (
                <li key={step.num}>
                  <Reveal delay={i * 0.08}>
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                      <span aria-hidden="true" dir="ltr" style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-text)", flexShrink: 0, paddingTop: 3 }}>
                        {step.num}
                      </span>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)", marginBottom: 8 }}>{step.title}</h3>
                        <p style={{ color: "var(--text-secondary)", fontWeight: 300, lineHeight: 1.7, fontSize: 15 }}>{step.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ MISSION / APPROACH ═══ */}
        <section aria-labelledby="mission-title" className="landing-snap-page" style={{ position: "relative", overflow: "hidden", padding: "112px 16px" }}>
          <BackgroundVideo
            src="/videos/1.mp4"
            poster="/videos/1-poster.jpg"
            overlay="linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,241,228,0.93) 50%, rgba(255,255,255,0.95) 100%)"
          />
          <h2 id="mission-title" className="sr-only">
            {L.missionEyebrow}
          </h2>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 88 }}>
            <Statement align="start" isRTL={isRTL} eyebrow={L.missionEyebrow} title={L.missionTitle} body={L.missionBody} />
            <Statement align="end" isRTL={isRTL} eyebrow={L.approachEyebrow} title={L.approachTitle} body={L.approachBody} />
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" aria-labelledby="pricing-title" className="landing-snap-page" style={{ background: "var(--bg-secondary)", padding: "96px 16px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
            <SectionHeading id="pricing-title" isRTL={isRTL} eyebrow={L.navPricing} title={L.pricingHeading} subtitle={L.pricingLead} />

            <Reveal delay={0.1}>
              <div
                className="p-6 sm:p-12"
                style={{
                  borderRadius: 24,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 32px 70px -32px rgba(28,22,17,0.22)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                    gap: 24,
                    marginBottom: 32,
                    paddingBottom: 32,
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", marginBottom: 6 }}>{L.planName}</h3>
                    <p style={{ color: "var(--text-secondary)", fontWeight: 300, fontSize: 15 }}>{L.planTagline}</p>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <p style={{ fontWeight: 800, fontSize: 40, color: "var(--text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums" }}>
                      {formatCurrency(PRICE_PER_BARBER, locale, "JOD", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </p>
                    <p style={{ fontWeight: 500, fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{L.pricingPerBarber}</p>
                  </div>
                </div>

                <ul className="card-grid-2" style={{ marginBottom: 36, gap: 16 }}>
                  {planFeatures.map((feat) => (
                    <li key={feat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Check size={18} aria-hidden="true" className="shrink-0 text-[var(--accent-brass)]" />
                      <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link href={ownerSignup} className="btn btn-primary" style={{ width: "100%", minHeight: 52, borderRadius: 9999, fontSize: 15, fontWeight: 700 }}>
                  {L.heroOwnerCta}
                </Link>
                <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "var(--text-muted)" }}>{L.planNote}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ CONTACT + FOOTER — the final "page" ═══ */}
        <section
          aria-labelledby="contact-title"
          className="landing-snap-page"
          style={{ position: "relative", overflow: "hidden", background: "#1c1611", color: "#ffffff", padding: "96px 16px 32px" }}
        >
          <BackgroundVideo
            src="/videos/2.mp4"
            poster="/videos/2-poster.jpg"
            overlay="linear-gradient(180deg, rgba(28,22,17,0.78) 0%, rgba(28,22,17,0.86) 55%, rgba(28,22,17,0.92) 100%)"
          />

          <Reveal>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
              <Eyebrow dark>{L.contactEyebrow}</Eyebrow>
              <h2
                id="contact-title"
                style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", letterSpacing: headingTracking(isRTL, "0.014em"), marginBottom: 16, color: "#ffffff" }}
              >
                {L.contactHeading}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, fontWeight: 300, lineHeight: 1.7, marginBottom: 36 }}>{L.contactLead}</p>
              <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href={ownerSignup}
                  className="btn"
                  style={{ ...pillCta, minHeight: 52, background: "#ffffff", color: "#1c1611" }}
                >
                  {L.heroOwnerCta}
                </Link>
                <Link
                  href={href("/explore")}
                  className="btn"
                  style={{ ...pillCta, minHeight: 52, background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
                >
                  <Search size={18} aria-hidden="true" />
                  {L.heroCustomerCta}
                </Link>
              </div>
            </div>
          </Reveal>

          <footer
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: 1100,
              margin: "80px auto 0",
              width: "100%",
              borderTop: "1px solid rgba(255,255,255,0.14)",
              paddingTop: 32,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
            }}
          >
            <span dir="ltr" style={{ fontFamily: "var(--font-bdo-grotesk), system-ui, sans-serif", fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
              Halaqy<span style={{ color: "#d8b88a" }}>.</span>
            </span>

            <nav aria-label={L.product}>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "12px 28px" }}>
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="hover:underline underline-offset-4" style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label={L.legal}>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "12px 28px" }}>
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:underline underline-offset-4" style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, flexBasis: "100%" }}>
              <span dir="ltr">© {year} Halaqy.</span> {L.allRightsReserved}
            </p>
          </footer>
        </section>
      </main>
    </LandingShell>
  );
}
