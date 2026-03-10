"use client";

import React, { useEffect } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Calendar,
  Users,
  Globe,
  BarChart3,
  Star,
  Smartphone,
  Check,
  ArrowRight,
  Scissors,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

// ─── Scroll-reveal wrapper ───
function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) controls.start("visible");
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, delay, ease: [0.25, 1, 0.5, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const t = useTranslation();
  const { direction, toggleLocale } = useThemeStore();
  const isRTL = direction === "rtl";

  const toggleLang = () => toggleLocale();

  useEffect(() => {
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", isRTL ? "ar" : "en");
  }, [direction, isRTL]);

  const features = [
    {
      icon: Calendar,
      title: t.landing.featureCalendar,
      desc: t.landing.featureCalendarDesc,
      color: "var(--accent-mint)",
    },
    {
      icon: Users,
      title: t.landing.featureCrm,
      desc: t.landing.featureCrmDesc,
      color: "var(--accent-lavender)",
    },
    {
      icon: Globe,
      title: t.landing.featureBooking,
      desc: t.landing.featureBookingDesc,
      color: "var(--accent-blue)",
    },
    {
      icon: BarChart3,
      title: t.landing.featureAnalytics,
      desc: t.landing.featureAnalyticsDesc,
      color: "var(--accent-amber)",
    },
    {
      icon: Star,
      title: t.landing.featureReviews,
      desc: t.landing.featureReviewsDesc,
      color: "var(--accent-rose)",
    },
    {
      icon: Smartphone,
      title: t.landing.featureMobile,
      desc: t.landing.featureMobileDesc,
      color: "var(--accent-mint)",
    },
  ];

  const steps = [
    { num: "01", title: t.landing.step1Title, desc: t.landing.step1Desc },
    { num: "02", title: t.landing.step2Title, desc: t.landing.step2Desc },
    { num: "03", title: t.landing.step3Title, desc: t.landing.step3Desc },
  ];

  const pricingFeatures = [
    t.landing.pricingFeature1,
    t.landing.pricingFeature2,
    t.landing.pricingFeature3,
    t.landing.pricingFeature4,
    t.landing.pricingFeature5,
    t.landing.pricingFeature6,
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden">
      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-primary)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center">
              <Scissors size={16} className="text-[#0A0A0A]" />
            </div>
            <span className="text-[16px] font-medium tracking-tight">
              Lumina
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLang}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              {isRTL ? "EN" : "عربي"}
            </button>
            <Link
              href="/"
              className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t.sidebar.dashboard}
            </Link>
            <Link
              href="/book"
              className="h-9 px-5 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[12px] font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {t.landing.getStarted}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[90vh] flex items-center justify-center gradient-mesh noise-overlay">
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[var(--accent-mint)] opacity-[0.04] blur-[80px] float" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-[var(--accent-lavender)] opacity-[0.05] blur-[100px] float-delay-1" />
          <div className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full bg-[var(--accent-blue)] opacity-[0.03] blur-[60px] float-delay-2" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-surface)] mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-mint)] animate-pulse" />
              <span className="text-[11px] text-[var(--text-tertiary)] font-light">
                {t.landing.trustedBy}
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
            className="text-[clamp(2.5rem,5vw,4rem)] font-light leading-[1.1] tracking-tight mb-6"
          >
            <span className="gradient-text">{t.landing.heroTitle}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="text-[18px] text-[var(--text-secondary)] font-light max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            {t.landing.heroSubtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 1, 0.5, 1] }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/"
              className="h-12 px-8 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[14px] font-medium flex items-center gap-2 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.landing.getStarted}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/book"
              className="h-12 px-8 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)] text-[14px] font-light flex items-center gap-2 hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all"
            >
              {t.landing.bookDemo}
            </Link>
          </motion.div>

          {/* Floating dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className="mt-16 mx-auto max-w-3xl"
          >
            <div className="relative rounded-2xl border border-[var(--border-primary)] bg-[var(--glass-bg)] backdrop-blur-xl p-1 shadow-2xl">
              <div className="rounded-xl bg-[var(--bg-secondary)] p-6">
                {/* Mini dashboard preview */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      label: "Bookings",
                      val: "12",
                      color: "var(--accent-mint)",
                    },
                    {
                      label: "Revenue",
                      val: "84.5",
                      color: "var(--accent-lavender)",
                    },
                    {
                      label: "Clients",
                      val: "347",
                      color: "var(--accent-blue)",
                    },
                    {
                      label: "Rating",
                      val: "4.8",
                      color: "var(--accent-amber)",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] p-3"
                    >
                      <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                        {m.label}
                      </p>
                      <p
                        className="text-[20px] font-light mt-1"
                        style={{ color: m.color }}
                      >
                        {m.val}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="h-24 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-end p-3 gap-1">
                  {[30, 45, 35, 55, 65, 50, 70, 85, 60, 75, 90, 80].map(
                    (h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          background: `linear-gradient(to top, var(--accent-mint), var(--accent-lavender))`,
                          opacity: 0.6,
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{
                          duration: 0.6,
                          delay: 0.8 + i * 0.05,
                          ease: [0.25, 1, 0.5, 1],
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[var(--accent-mint)]/10 via-transparent to-[var(--accent-lavender)]/10 -z-10 blur-sm" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="py-40 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-[clamp(1.8rem,3vw,2.5rem)] font-light tracking-tight mb-4">
                {t.landing.featuresTitle}
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] font-light max-w-lg mx-auto">
                {t.landing.featuresSubtitle}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="glass-card-premium p-10 h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: `color-mix(in srgb, ${f.color} 15%, transparent)`,
                    }}
                  >
                    <f.icon size={20} style={{ color: f.color }} />
                  </div>
                  <h3 className="text-[15px] text-[var(--text-primary)] font-medium mb-2 relative z-10">
                    {f.title}
                  </h3>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-light leading-relaxed relative z-10">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-40 px-6 border-t border-[var(--border-primary)]">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <h2 className="text-[clamp(1.8rem,3vw,2.5rem)] font-light tracking-tight mb-4">
                {t.landing.howItWorksTitle}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-[var(--accent-mint)]/30 via-[var(--accent-lavender)]/30 to-[var(--accent-blue)]/30" />

            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <div className="text-center relative">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="gradient-text text-[18px] font-medium">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-[16px] text-[var(--text-primary)] font-medium mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-light leading-relaxed max-w-[260px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="py-40 px-6 border-t border-[var(--border-primary)]">
        <div className="max-w-lg mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-[clamp(1.8rem,3vw,2.5rem)] font-light tracking-tight mb-4">
                {t.landing.pricingTitle}
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] font-light">
                {t.landing.pricingSubtitle}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="glass-card-premium p-12 text-center">
              <div className="mb-6 relative z-10">
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-[48px] font-light gradient-text">
                    1.5
                  </span>
                  <span className="text-[16px] text-[var(--text-secondary)] font-light">
                    {t.common.jod}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-tertiary)] font-light">
                  {t.landing.pricingPerBarber}
                </p>
              </div>

              <div className="w-full h-px bg-[var(--border-primary)] mb-6" />

              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-4 relative z-10">
                {t.landing.pricingIncludes}
              </p>

              <div className="space-y-3 mb-8 relative z-10">
                {pricingFeatures.map((feat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 justify-center"
                  >
                    <Check
                      size={14}
                      className="text-[var(--accent-mint)] flex-shrink-0"
                    />
                    <span className="text-[13px] text-[var(--text-secondary)] font-light">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              <button className="relative z-10 w-full h-12 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[14px] font-medium hover:opacity-90 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
                {t.landing.startFreeTrial}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[var(--border-primary)] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center">
                  <Scissors size={14} className="text-[#0A0A0A]" />
                </div>
                <span className="text-[14px] font-medium">Lumina</span>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)] font-light leading-relaxed max-w-[200px]">
                {t.landing.heroSubtitle.slice(0, 80)}...
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: t.landing.product,
                links: [
                  t.landing.featureCalendar,
                  t.landing.featureCrm,
                  t.landing.featureBooking,
                  t.landing.featureAnalytics,
                ],
              },
              {
                title: t.landing.company,
                links: [t.landing.about, t.landing.careers, t.landing.contact],
              },
              {
                title: t.landing.legal,
                links: [t.landing.privacy, t.landing.terms],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  {col.title}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <span className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer font-light">
                        {link}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-[var(--border-primary)]">
            <p className="text-[11px] text-[var(--text-muted)] font-light">
              © 2026 Lumina. {t.landing.allRightsReserved}
            </p>
            <button
              onClick={toggleLang}
              className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Globe size={12} />
              {isRTL ? "English" : "العربية"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
