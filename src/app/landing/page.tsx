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
import { cn } from "@/lib/utils";

// ─── Scroll-reveal wrapper ───
function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
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
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.8, delay, ease: [0.25, 1, 0.5, 1] },
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden selection:bg-[var(--accent-mint-muted)] selection:text-[var(--accent-mint)]">
      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 inset-x-0 z-[100] backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-primary)] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center shadow-lg shadow-mint/20 group-hover:scale-105 transition-transform">
              <Scissors size={20} className="text-[#0A0A0A]" />
            </div>
            <span className="text-[20px] font-medium tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Lumina
            </span>
          </Link>

          <div className="flex items-center gap-2 md:gap-4 ms-auto">
            <button
              onClick={toggleLang}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all cursor-pointer grow-0 shrink-0"
            >
              {isRTL ? "EN" : "AR"}
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <Link
                href="/explore"
                className="h-10 font-medium px-4 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)]"
              >
                {isRTL ? "استكشف الصالونات" : "Explore Shops"}
              </Link>
              <Link
                href="/"
                className="h-10 font-medium px-4 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)]"
              >
                {t.sidebar.dashboard}
              </Link>
            </div>
            <Link
              href="/book"
              className="h-10 px-6 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] grow-0 shrink-0 whitespace-nowrap shadow-lg shadow-mint/10"
            >
              {t.landing.getStarted}
              <ArrowRight size={14} className={isRTL ? "rotate-180" : ""} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[92vh] flex items-center justify-center gradient-mesh noise-overlay pt-20">
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-[var(--accent-mint)] opacity-[0.06] blur-[100px] float" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-[var(--accent-lavender)] opacity-[0.07] blur-[120px] float-delay-1" />
          <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full bg-[var(--accent-blue)] opacity-[0.04] blur-[80px] float-delay-2" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-surface)] mb-8 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-mint)] animate-pulse" />
              <span className="text-[12px] text-[var(--text-tertiary)] font-light tracking-wide">
                {t.landing.trustedBy}
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
            className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.05] tracking-tight mb-8"
          >
            <span className="gradient-text">{t.landing.heroTitle}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="text-[18px] md:text-[20px] text-[var(--text-secondary)] font-light max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            {t.landing.heroSubtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 1, 0.5, 1] }}
            className="flex flex-col md:flex-row items-center justify-center gap-5"
          >
            <Link
              href="/explore"
              className="w-full md:w-auto h-14 px-10 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[15px] font-medium flex items-center justify-center gap-2 hover:opacity-95 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-mint/10"
            >
              {isRTL ? "استكشف الصالونات" : "Explore Shops"}
              <ArrowRight size={18} className={isRTL ? "rotate-180" : ""} />
            </Link>
            <Link
              href="/"
              className="w-full md:w-auto h-14 px-10 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)] text-[15px] font-light flex items-center justify-center gap-2 hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all bg-white/5 backdrop-blur-sm"
            >
              {t.landing.getStarted}
            </Link>
          </motion.div>

          {/* Floating dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className="mt-20 mx-auto max-w-4xl px-4"
          >
            <div className="relative rounded-2xl border border-[var(--border-primary)] bg-[var(--glass-bg)] backdrop-blur-2xl p-2 shadow-2xl">
              <div className="rounded-xl bg-[var(--bg-secondary)] p-6 md:p-8 overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Bookings", val: "12", color: "var(--accent-mint)" },
                    { label: "Revenue", val: "84.5", color: "var(--accent-lavender)" },
                    { label: "Clients", val: "347", color: "var(--accent-blue)" },
                    { label: "Rating", val: "4.8", color: "var(--accent-amber)" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] p-4 text-start">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{m.label}</p>
                      <p className="text-[24px] font-medium" style={{ color: m.color }}>{m.val}</p>
                    </div>
                  ))}
                </div>
                <div className="h-32 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-end p-4 gap-1.5">
                  {[30, 45, 35, 55, 65, 50, 70, 85, 60, 75, 90, 80, 70, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-[4px]"
                      style={{
                        background: `linear-gradient(to top, var(--accent-mint), var(--accent-lavender))`,
                        opacity: 0.7,
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 1, delay: 1 + i * 0.05, ease: "easeOut" }}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[var(--accent-mint)]/20 via-transparent to-[var(--accent-lavender)]/20 -z-10 blur-xl opacity-50" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-light tracking-tight mb-6">
                {t.landing.featuresTitle}
              </h2>
              <p className="text-[16px] text-[var(--text-secondary)] font-light max-w-xl mx-auto leading-relaxed">
                {t.landing.featuresSubtitle}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="glass-card-premium p-10 h-full flex flex-col justify-between group">
                  <div className="mb-12">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 shadow-inner"
                      style={{ background: `color-mix(in srgb, ${f.color} 15%, transparent)` }}
                    >
                      <f.icon size={28} style={{ color: f.color }} />
                    </div>
                    <h3 className="text-[22px] text-[var(--text-primary)] font-medium mb-4 relative z-10 transition-colors group-hover:text-white">
                      {f.title}
                    </h3>
                    <p className="text-[15px] text-[var(--text-secondary)] font-light leading-[1.7] relative z-10">
                      {f.desc}
                    </p>
                  </div>
                  <div className="w-full h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden mt-auto">
                     <div className="h-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] transition-all duration-700 ease-out group-hover:w-full" style={{ width: '0%', direction: 'ltr' }} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-24 md:py-32 px-6 bg-[var(--bg-secondary)]/50 border-y border-[var(--border-primary)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-light tracking-tight mb-4">
                {t.landing.howItWorksTitle}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative items-start">
            {/* Connecting line */}
            <div className={cn(
              "hidden md:block absolute top-[2.75rem] left-[15%] right-[15%] h-px bg-gradient-to-r from-[var(--accent-mint)]/30 via-[var(--accent-lavender)]/30 to-[var(--accent-blue)]/30 z-0",
              isRTL && "scale-x-[-1]"
            )} />

            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.2}>
                <div className="text-center relative group">
                  <div className="w-16 h-16 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center mx-auto mb-8 relative z-10 shadow-lg group-hover:border-[var(--accent-mint)]/30 transition-colors">
                    <span className="gradient-text text-[22px] font-medium">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-[18px] text-[var(--text-primary)] font-medium mb-3">
                    {step.title}
                  </h3>
                  <p className="text-[14px] text-[var(--text-secondary)] font-light leading-relaxed max-w-[280px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-light tracking-tight mb-6">
                {t.landing.pricingTitle}
              </h2>
              <p className="text-[16px] text-[var(--text-secondary)] font-light leading-relaxed">
                {t.landing.pricingSubtitle}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="glass-card-premium p-10 md:p-14 text-center">
              <div className="mb-10 relative z-10">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-[56px] font-light gradient-text leading-none">
                    1.5
                  </span>
                  <span className="text-[20px] text-[var(--text-secondary)] font-light uppercase tracking-widest">
                    {t.common.jod}
                  </span>
                </div>
                <p className="text-[14px] text-[var(--text-tertiary)] font-light tracking-wide uppercase">
                  {t.landing.pricingPerBarber}
                </p>
              </div>

              <div className="w-full h-px bg-[var(--border-primary)] mb-10" />

              <p className="text-[12px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-8 font-medium relative z-10">
                {t.landing.pricingIncludes}
              </p>

              <div className="space-y-5 mb-12 relative z-10 px-4">
                {pricingFeatures.map((feat, i) => (
                  <div key={i} className="flex items-start gap-5 text-start max-w-[320px] mx-auto group">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-[var(--accent-mint)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--accent-mint)]/20 transition-colors">
                      <Check size={14} className="text-[var(--accent-mint)]" />
                    </div>
                    <span className="text-[15px] text-[var(--text-secondary)] font-light leading-snug">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/auth/signup"
                className="relative z-10 w-full h-14 rounded-full bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[15px] font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-xl shadow-mint/10"
              >
                {t.landing.startFreeTrial}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[var(--border-primary)] py-20 px-6 bg-[var(--bg-secondary)]/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center shadow-lg shadow-mint/10">
                  <Scissors size={18} className="text-[#0A0A0A]" />
                </div>
                <span className="text-[18px] font-medium tracking-tight">Lumina</span>
              </div>
              <p className="text-[14px] text-[var(--text-tertiary)] font-light leading-relaxed max-w-[320px]">
                {t.landing.heroSubtitle}
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
                <h4 className="text-[12px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-6 font-medium">
                  {col.title}
                </h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link}>
                      <span className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer font-light">
                        {link}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-[var(--border-primary)] gap-6">
            <p className="text-[12px] text-[var(--text-muted)] font-light tracking-wide">
              © 2026 Lumina. {t.landing.allRightsReserved}
            </p>
            <button
              onClick={toggleLang}
              className="px-4 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-2"
            >
              <Globe size={14} />
              {isRTL ? "English" : "العربية"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
