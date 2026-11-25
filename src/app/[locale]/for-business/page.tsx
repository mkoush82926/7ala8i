// For-business (shop-owner) landing page (§6.10), moved from /landing by
// WS-1B — a Server Component. All copy is rendered on the server from the
// locale dictionary (SEO, no copy shipped as JS); only the nav, reveal
// wrapper, photos and background video are client islands.
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Link2,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  Star,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import en, { type TranslationKeys } from "@/i18n/en";
import ar from "@/i18n/ar";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber, JOD_LABELS, localizeDigits } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { containerClasses } from "@/components/ui/recipes";
import { SiteFooter } from "@/components/search/site-footer";
import { LandingNav, LandingShell } from "./landing-client";

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
      canonical: `/${locale}/for-business`,
      languages: { en: "/en/for-business", ar: "/ar/for-business", "x-default": "/en/for-business" },
    },
    openGraph: { url: `/${locale}/for-business`, title: t.landing.metaTitle, description: t.landing.metaDescription },
  };
}

// ─── Presentational helpers (server) ────────────────────────────────────────

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("reveal", className)} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <Reveal>
      <div className={cn("mb-10 max-w-2xl md:mb-14", align === "center" ? "mx-auto text-center" : "text-start")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 id={id} className="text-h1 text-balance text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-body-lg mt-4 text-ink-muted">{subtitle}</p>}
      </div>
    </Reveal>
  );
}

/** Splits "The future of {accent} management" around the accent word (solid teal, no gradient). */
function Headline({ template, accent }: { template: string; accent: string }) {
  const [before, after = ""] = template.split("{accent}");
  return (
    <>
      {before}
      <span className="text-brand-text">{accent}</span>
      {after}
    </>
  );
}

type PreviewCopy = TranslationKeys["landing"]["preview"];

/**
 * Product preview built from real product UI: a day-view calendar with named
 * barbers and booked services, and the phone shop page a client books from.
 * Decorative (aria-hidden) — the copy beside it says the same thing.
 */
function ProductPreview({ p, bookLabel, locale }: { p: PreviewCopy; bookLabel: string; locale: string }) {
  const time = (h: number, m = 0) => localizeDigits(`${h}:${String(m).padStart(2, "0")}`, locale);
  const lanes: { name: string; seed: string; events: { tone: string; top: number; h: number; title: string; at: string }[] }[] = [
    {
      name: p.barber1,
      seed: "b1",
      events: [
        { tone: "bg-brand-soft border-brand text-ink", top: 4, h: 22, title: p.svcFade, at: time(9, 30) },
        { tone: "bg-success-soft border-success text-ink", top: 30, h: 16, title: p.svcBeard, at: time(10, 30) },
        { tone: "bg-brand text-on-brand border-brand-pressed", top: 58, h: 30, title: p.svcCombo, at: time(11, 30) },
      ],
    },
    {
      name: p.barber2,
      seed: "b2",
      events: [
        { tone: "bg-warning-soft border-warning border-dashed text-ink", top: 12, h: 20, title: p.svcCut, at: time(10) },
        { tone: "bg-brand-soft border-brand text-ink", top: 42, h: 26, title: p.svcFade, at: time(11) },
      ],
    },
    {
      name: p.barber3,
      seed: "b3",
      events: [
        { tone: "bg-brand-soft border-brand text-ink", top: 2, h: 18, title: p.svcKids, at: time(9, 15) },
        { tone: "bg-sunken border-line-strong text-ink-soft", top: 26, h: 22, title: p.svcBreak, at: time(10, 15) },
        { tone: "bg-brand-soft border-brand text-ink", top: 54, h: 22, title: p.svcCut, at: time(11, 15) },
      ],
    },
  ];
  const hours = [9, 10, 11, 12];
  const slots = [time(10), time(10, 30), time(11, 15), time(12), time(13, 30), time(16, 45)];
  return (
    <div aria-hidden="true" className="relative">
      <div className="relative overflow-hidden rounded-3xl bg-brand-soft p-5 sm:p-8 lg:p-10">
        <div className="bg-hatch-ink absolute inset-0 opacity-60" />
        {/* Calendar day view */}
        <div className="relative w-full rounded-2xl border border-line bg-card p-4 shadow-float sm:w-[88%]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">{p.calendarTitle}</span>
            <span className="rounded-full bg-sunken px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{p.today}</span>
          </div>
          <div className="grid grid-cols-[32px_repeat(3,minmax(0,1fr))] gap-2">
            <span />
            {lanes.map((lane) => (
              <span key={lane.seed} className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-ink">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-text">
                  {Array.from(lane.name)[0]}
                </span>
                <span className="truncate">{lane.name}</span>
              </span>
            ))}
            <div className="flex flex-col justify-between py-1 text-[10px] text-ink-muted">
              {hours.map((h) => (
                <span key={h}>{time(h)}</span>
              ))}
            </div>
            {lanes.map((lane) => (
              <div key={lane.seed} className="relative h-48 rounded-lg bg-sunken/60">
                <span className="absolute inset-x-1 top-[36%] h-px bg-danger/60" />
                {lane.events.map((ev, j) => (
                  <span
                    key={j}
                    className={cn("absolute inset-x-1 overflow-hidden rounded-xs border-s-[3px] px-1.5 py-1 shadow-xs", ev.tone)}
                    style={{ top: `${ev.top}%`, height: `${ev.h}%` }}
                  >
                    <span className="block truncate text-[10px] font-semibold leading-tight">{ev.title}</span>
                    <span className="block truncate text-[9px] leading-tight opacity-80">{ev.at}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Phone: the shop page a client books from */}
        <div className="relative -mt-10 ms-auto w-[64%] max-w-[260px] rounded-[28px] border border-line bg-card p-3 shadow-float sm:-mt-24">
          <PhotoFrame src="/videos/1-poster.jpg" alt="" ratio="4/3" rounded="2xl" sizes="260px" fallbackName={p.shopName} className="mb-3" />
          <p className="truncate text-[13px] font-bold text-ink">{p.shopName}</p>
          <div className="mb-3 mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
            <Star className="size-3 fill-accent text-accent" />
            <span className="font-semibold text-ink">{localizeDigits("4.9", locale)}</span>
            <span>· {p.area}</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {slots.map((slot, i) => (
              <span
                key={slot}
                className={cn(
                  "grid h-7 place-items-center rounded-full border text-[10px] font-semibold",
                  i === 2 ? "border-brand bg-brand text-on-brand" : "border-line-strong text-ink",
                )}
              >
                {slot}
              </span>
            ))}
          </div>
          <span className="grid h-9 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand">{bookLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ForBusinessPage({ params }: Props) {
  const { locale, t, isRTL } = resolve((await params).locale);
  const L = t.landing;
  const Forward = isRTL ? ArrowLeft : ArrowRight;
  const href = (path: string) => (path === "/" ? `/${locale}` : `/${locale}${path}`);
  // Owners go straight to the shop setup wizard (WS-1G).
  const ownerSignup = href("/start");
  const otherLocale = locale === "ar" ? "en" : "ar";

  const features: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: CalendarDays, title: L.featureCalendar, desc: L.featCalendarDesc },
    { icon: Workflow, title: L.featureCrm, desc: L.featCrmDesc },
    { icon: Link2, title: L.featureBooking, desc: L.featBookingDesc },
    { icon: BarChart3, title: L.featInsights, desc: L.featInsightsDesc },
    { icon: ShieldCheck, title: L.featReviews, desc: L.featReviewsDesc },
    { icon: MonitorSmartphone, title: L.featAnyDevice, desc: L.featAnyDeviceDesc },
  ];

  // "How it works" carries the Manage / Book / Grow story (no separate trio).
  const steps = [
    { title: L.stepSetupTitle, desc: L.stepSetupDesc },
    { title: L.stepShareTitle, desc: L.stepShareDesc },
    { title: L.pillarGrow, desc: L.stepGrowDesc },
  ];

  const planFeatures = [L.pricingFeature1, L.pricingFeature2, L.pricingFeature3, L.pricingFeature4, L.planFeatureTeam, L.featAnyDevice];

  const trust = [L.trustNoContract, L.trustBilingual, L.trustSetup];

  return (
    <LandingShell>
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>
      <LandingNav />

      <main id="main" tabIndex={-1} className="outline-none">
        {/* ═══ HERO — two clear paths: shop owners and customers ═══ */}
        <section aria-labelledby="hero-title" className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(55%_50%_at_10%_0%,var(--color-brand-soft),transparent)] rtl:bg-[radial-gradient(55%_50%_at_90%_0%,var(--color-brand-soft),transparent)]"
          />
          <div className={cn(containerClasses, "grid items-center gap-12 py-10 md:py-14 lg:grid-cols-2 lg:gap-16 lg:py-16")}>
            <div className="fade-slide-up text-center lg:text-start">
              <p className="eyebrow mb-4">{L.heroEyebrow}</p>
              <h1 id="hero-title" className="text-display text-balance text-ink">
                <Headline template={L.heroHeadline} accent={L.heroHeadlineAccent} />
              </h1>
              <p className="text-body-lg mx-auto mt-5 max-w-xl text-ink-soft lg:mx-0">{L.heroLead}</p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <ButtonLink href={ownerSignup} size="xl" iconEnd={<Forward />}>
                  {L.heroOwnerCta}
                </ButtonLink>
                <ButtonLink href={href("/explore")} variant="secondary" size="xl" icon={<Search />}>
                  {L.heroCustomerCta}
                </ButtonLink>
              </div>

              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-ink-soft lg:justify-start">
                {trust.map((item, i) => (
                  <li key={i} className="inline-flex items-center gap-1.5">
                    <Check aria-hidden="true" className="size-4 text-brand-text" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-meta text-ink-muted">{L.heroAudienceNote}</p>
            </div>

            <div className="fade-slide-up fade-slide-up-delay-2 mx-auto w-full max-w-xl lg:max-w-none">
              <ProductPreview p={L.preview} bookLabel={t.primitives.bookNow} locale={locale} />
            </div>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-y border-line bg-card py-14 md:py-20">
          <div className={containerClasses}>
            <SectionHeading id="features-title" title={L.featuresHeading} subtitle={L.featuresLead} />
            <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <li key={f.title}>
                    <Reveal delay={Math.min(i, 3) * 0.04} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text"
                      >
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-title text-ink">{f.title}</h3>
                        <p className="mt-1.5 text-[15px] leading-6 text-ink-muted">{f.desc}</p>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ═══ MISSION — one photo ↔ copy row ═══ */}
        <section aria-labelledby="mission-title" className="py-14 md:py-20">
          <div className={containerClasses}>
            <Reveal>
              <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                <PhotoFrame
                  src="/videos/1-poster.jpg"
                  alt=""
                  ratio="4/3"
                  rounded="2xl"
                  sizes="(min-width: 768px) 600px, 100vw"
                  fallbackName="Halaqy"
                  className="shadow-raised"
                />
                <div>
                  <h2 id="mission-title" className="text-h1 text-balance text-ink">
                    {L.missionTitle}
                  </h2>
                  <p className="text-body-lg mt-4 text-ink-muted">{L.missionBody}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section aria-labelledby="how-title" className="border-y border-line bg-card py-14 md:py-20">
          <div className={containerClasses}>
            <SectionHeading id="how-title" title={L.howHeading} subtitle={L.howLead} />
            <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 0.04} className="h-full">
                    <div className="flex h-full flex-col gap-3 rounded-xl border border-line bg-page p-6">
                      <span
                        aria-hidden="true"
                        className="grid size-10 place-items-center rounded-full bg-brand-soft font-bold tabular-nums text-brand-text"
                      >
                        {formatLocalizedNumber(i + 1, locale)}
                      </span>
                      <h3 className="text-h3 mt-1 text-ink">{step.title}</h3>
                      <p className="text-body text-ink-muted">{step.desc}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-14 md:py-20">
          <div className={containerClasses}>
            <SectionHeading id="pricing-title" title={L.pricingHeading} subtitle={L.pricingLead} />

            <Reveal delay={0.04}>
              <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-6 shadow-raised sm:p-10">
                <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
                  <div>
                    <h3 className="text-h2 text-ink">{L.planName}</h3>
                    <p className="mt-1 text-[15px] text-ink-muted">{L.planTagline}</p>
                  </div>
                  <div className="text-start sm:text-end">
                    <p className="text-[40px] font-bold leading-none tabular-nums text-ink">
                      {formatLocalizedNumber(PRICE_PER_BARBER, locale, "auto", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{" "}
                      <span className="text-2xl">{JOD_LABELS[locale]}</span>
                    </p>
                    <p className="mt-2 text-sm font-medium text-ink-muted">{L.pricingPerBarber}</p>
                  </div>
                </div>

                <ul className="my-8 grid gap-4 sm:grid-cols-2">
                  {planFeatures.map((feat) => (
                    <li key={feat} className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-text"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </span>
                      <span className="text-[15px] font-medium text-ink">{feat}</span>
                    </li>
                  ))}
                </ul>

                <ButtonLink href={ownerSignup} size="xl" fullWidth iconEnd={<Forward />}>
                  {L.heroOwnerCta}
                </ButtonLink>
                <p className="mt-4 text-center text-sm text-ink-muted">{L.planNote}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ FINAL CTA band (photo-backed; photos don't theme, so the band is always dark) ═══ */}
        <section aria-labelledby="contact-title" className={cn(containerClasses, "pb-4")}>
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-3xl bg-[#0B1514] px-6 py-14 text-center text-white sm:px-10 md:py-20">
              <div aria-hidden="true" className="bg-hatch-ink absolute inset-0 -z-10 opacity-40" />
              <div className="relative z-[1] mx-auto max-w-2xl">
                <p className="mb-3 text-sm font-semibold text-[#5EEAD4]">{L.contactEyebrow}</p>
                <h2 id="contact-title" className="text-h1 text-balance">
                  {L.contactHeading}
                </h2>
                <p className="text-body-lg mx-auto mt-4 max-w-xl text-white/80">{L.contactLead}</p>
                <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <ButtonLink
                    href={ownerSignup}
                    size="xl"
                    iconEnd={<Forward />}
                    className="bg-white text-[#0F172A] hover:bg-[#F1EFEA] active:bg-[#E7E4DD]"
                  >
                    {L.heroOwnerCta}
                  </ButtonLink>
                  <ButtonLink
                    href={href("/explore")}
                    variant="ghost"
                    size="xl"
                    icon={<Search />}
                    className="border border-white/40 text-white hover:bg-white/10 hover:text-white"
                  >
                    {L.heroCustomerCta}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter locale={locale} t={t} languageHref={`/${otherLocale}/for-business`} />
    </LandingShell>
  );
}
