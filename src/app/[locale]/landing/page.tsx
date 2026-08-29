"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useTranslation, headingTracking, FONT_EN_DISPLAY } from "@/hooks/use-translation";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Design tokens ("Data Observatory on Cloud Paper") ───
const T = {
  black:   "#1c1611", // Midnight Ink — structural dark ink
  white:   "#ffffff", // Paper
  dark:    "#1c1611", // Midnight Ink
  mid:     "#5a5147", // Slate — secondary/muted text
  outline: "#ede3cd", // Frost Border
  surfLow: "#f7f1e4", // Lavender Wash — section-level tint zone
  surfCont:"#ede3cd", // Frost Border
  accent:  "#a67c3d", // Brass — the sole chromatic note
};

// ─── Reduced-motion guard for scroll-linked parallax ───
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ─── Looping ambient background video (the real barbershop-tool footage from
// /public/videos), dimmed under a tinted overlay so foreground text and
// controls stay legible. Paused (first-frame only) when the visitor prefers
// reduced motion. ───
function BackgroundVideo({ src, overlay }: { src: string; overlay: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // The `autoPlay` attribute isn't reliably honored once React owns the
  // element (it's applied as a property post-hydration rather than at parse
  // time), so drive playback explicitly instead of trusting the attribute.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reducedMotion) return;
    el.play().catch(() => {});
  }, [reducedMotion]);

  return (
    <>
      {/* Blurred + slightly scaled up (to hide the blur's edge falloff) so the
          footage reads as soft ambient texture instead of a sharp photo that
          competes with the foreground heading/body text for attention. */}
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        aria-hidden
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0,
          filter: "blur(4px) saturate(0.8)", transform: "scale(1.08)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: overlay, zIndex: 0 }} />
    </>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Small uppercase brand-accent label used above every section heading —
// centralized so the eyebrow treatment can never drift out of sync between
// sections (weight, tracking, and color were previously duplicated ad hoc).
function Eyebrow({ children, isRTL, dark = false }: { children: React.ReactNode; isRTL: boolean; dark?: boolean }) {
  return (
    <div style={{
      fontWeight: 700, fontSize: 12, textTransform: "uppercase",
      letterSpacing: headingTracking(isRTL, "0.14em"),
      color: dark ? "#d8b88a" : T.accent,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// Centered eyebrow + title + subtitle — the standard section header used by
// Features, How It Works, Pricing, and Contact so every page introduces
// itself the same way instead of jumping straight into content.
function SectionHeading({
  eyebrow, title, subtitle, FFD, isRTL, dark = false, marginBottom = 64,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  FFD: string;
  isRTL: boolean;
  dark?: boolean;
  marginBottom?: number;
}) {
  return (
    <Reveal>
      <div style={{ textAlign: "center", maxWidth: 560, margin: `0 auto ${marginBottom}px` }}>
        <Eyebrow isRTL={isRTL} dark={dark}>{eyebrow}</Eyebrow>
        <h2 style={{
          fontFamily: FFD, fontWeight: 800, fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)",
          letterSpacing: headingTracking(isRTL, "0.014em"),
          color: dark ? T.white : T.dark, marginBottom: subtitle ? 16 : 0,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: dark ? "rgba(255,255,255,0.6)" : T.mid, fontSize: 16, fontWeight: 300, lineHeight: 1.7 }}>
            {subtitle}
          </p>
        )}
      </div>
    </Reveal>
  );
}

// A large heading + thin rule + paragraph, alternately aligned — the Nodenza "statement block" motif
function Statement({
  align, eyebrow, title, body, FFD, isRTL,
}: {
  align: "start" | "end";
  eyebrow?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  FFD: string;
  isRTL: boolean;
}) {
  return (
    <Reveal>
      <div className={`landing-statement${align === "end" ? " landing-statement--end" : ""}`}>
        {eyebrow && <Eyebrow isRTL={isRTL}>{eyebrow}</Eyebrow>}
        <h2 style={{ fontFamily: FFD, fontWeight: 800, fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", letterSpacing: headingTracking(isRTL, "0.014em"), color: T.dark, marginBottom: 20 }}>
          {title}
        </h2>
        <div className="landing-statement-rule" style={{ width: 56, height: 2, background: T.accent, marginBottom: 20 }} />
        <p style={{ color: T.mid, fontSize: 16, fontWeight: 300, lineHeight: 1.75 }}>
          {body}
        </p>
      </div>
    </Reveal>
  );
}

export default function LandingPage() {
  const { FF, FFD, isRTL, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const snapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  // Full-page scroll-snap: this page owns its own scroll container (rather
  // than the document), so lock the document body's scroll for as long as
  // we're mounted and restore it on the way out.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Keyboard paging (Space / Page Down / arrows) — the document itself no
  // longer scrolls, so without this the browser's default "scroll the page"
  // key handling would have nothing to act on.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const container = snapContainerRef.current;
      if (!container) return;
      const isTypingTarget = document.activeElement instanceof HTMLElement
        && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
      if (isTypingTarget) return;
      if (e.key === " " && document.activeElement !== document.body) return; // don't hijack a focused button's activation

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        container.scrollBy({ top: container.clientHeight, behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        container.scrollBy({ top: -container.clientHeight, behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navLinks = isLoggedIn
    ? [
        { label: isRTL ? "لوحة التحكم" : "Dashboard", href: "/" },
        { label: isRTL ? "التقويم" : "Calendar", href: "/calendar" },
        { label: isRTL ? "العملاء المحتملين" : "Leads", href: "/leads" },
      ]
    : [
        { label: isRTL ? "الميزات" : "Features", href: "#features" },
        { label: isRTL ? "التسعير" : "Pricing", href: "#pricing" },
        { label: isRTL ? "الخصوصية" : "Privacy", href: "/privacy" },
        { label: isRTL ? "الشروط" : "Terms", href: "/terms" },
      ];

  const ctaHref = isLoggedIn ? "/" : "/auth/signup";
  const ctaLabel = isLoggedIn
    ? (isRTL ? "لوحة التحكم" : "Dashboard")
    : (isRTL ? "ابدأ الآن" : "Get Started");

  const handleToggleLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath || `/${newLocale}`);
  };

  const pillars = [
    { icon: "calendar_month", title: isRTL ? "أدر" : "Manage", desc: isRTL ? "شغّل تقويمك وفريقك وسجل عملائك من لوحة تحكم واحدة مصممة للاستخدام اليومي." : "Run your calendar, team, and client history from one dashboard built for daily use." },
    { icon: "event_available", title: isRTL ? "احجز" : "Book", desc: isRTL ? "امنح عملاءك بوابة حجز بعلامتك التجارية، متاحة في أي وقت ومن أي جهاز." : "Give clients a branded booking page they can use anytime, from any device." },
    { icon: "trending_up", title: isRTL ? "انمُ" : "Grow", desc: isRTL ? "حوّل الرؤى إلى قرارات، واحتفظ بعملائك عبر طلبات مراجعة تلقائية." : "Turn insights into decisions, and keep clients coming back with automated review requests." },
  ];

  const features = [
    { icon: "schedule",      title: isRTL ? "تقويم ذكي"        : "Smart Calendar",     desc: isRTL ? "إدارة جداول زمنية متكيفة تتزامن مع سير عمل فريقك."             : "Adaptive scheduling that fits your team's natural rhythm." },
    { icon: "account_tree",  title: isRTL ? "مسار إدارة العملاء": "CRM Pipeline",       desc: isRTL ? "تصور رحلة عميلك من الاكتشاف إلى الولاء طويل الأمد."           : "Follow every client from first visit to long-term loyalty." },
    { icon: "link",          title: isRTL ? "الحجز الإلكتروني"  : "Online Booking",    desc: isRTL ? "بوابة حجز بسيطة تعيش على منصاتك الاجتماعية وموقعك."           : "A simple booking page that lives on your socials and site." },
    { icon: "insights",      title: isRTL ? "تقارير وتحليلات"   : "Insights",          desc: isRTL ? "أطر تحليلية لفهم الاحتفاظ بالعملاء وأوقات الذروة."             : "Clear reporting on retention and your busiest hours." },
    { icon: "thumb_up",      title: isRTL ? "مركز السمعة"       : "Reputation",        desc: isRTL ? "تذكيرات تلقائية تعزز حضورك في نتائج البحث المحلية."           : "Automated review requests that build your local reputation." },
    { icon: "smartphone",    title: isRTL ? "تجربة متحركة"      : "Mobile App",        desc: isRTL ? "تطبيقات iOS و Android لإدارة عملك من أي مكان."                : "iOS and Android apps for managing things on the go." },
  ];

  const steps = [
    { num: "01", title: isRTL ? "أنشئ"  : "Set up",    desc: isRTL ? "أدخل موظفيك وخدماتك وأسعارك."                                 : "Add your team, services, and pricing." },
    { num: "02", title: isRTL ? "وزّع"  : "Share",     desc: isRTL ? "شارك رابط الحجز الخاص بك عبر التواصل الاجتماعي والويب."       : "Share your booking link across social and web." },
    { num: "03", title: isRTL ? "حسّن"  : "Grow",      desc: isRTL ? "استخدم الأتمتة لتحسين الاحتفاظ بالعملاء وزيادة الإيرادات."      : "Use automation to improve retention and revenue." },
  ];

  const pricingFeats = [
    isRTL ? "حجوزات لا محدودة"   : "Unlimited bookings",
    isRTL ? "مجموعة CRM الكاملة" : "Full CRM suite",
    isRTL ? "رؤى متقدمة"         : "Advanced insights",
    isRTL ? "بوابة حجز مخصصة"   : "Branded booking page",
    isRTL ? "أتمتة المراجعات"    : "Review automation",
    isRTL ? "وصول للتطبيق"       : "Mobile app access",
  ];

  return (
    <div
      ref={snapContainerRef}
      className="landing-snap-container"
      style={{ fontFamily: FF, background: T.white, color: T.dark, overflowX: "hidden", position: "relative" }}
    >

      {/* ═══ FLOATING PILL NAV — fixed above the snapped pages ═══ */}
      <div style={{ position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, top: 16, zIndex: 50, padding: "0 16px" }}>
        <nav
          style={{
            maxWidth: 1100, margin: "0 auto", display: "flex",
            alignItems: "center", justifyContent: "space-between",
            background: T.white, borderRadius: 16,
            border: `1px solid ${T.surfCont}`,
            boxShadow: `0 0 24px 0 ${T.accent}26`,
            padding: "15px 15px 15px 20px",
          }}
        >
          <span dir="ltr" style={{ fontFamily: FONT_EN_DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: "0.008em", color: T.dark }}>
            Halaqy.
          </span>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={isRTL ? "فتح القائمة" : "Toggle menu"}
            aria-expanded={menuOpen}
            style={{
              width: 44, height: 44, borderRadius: 9999, border: "none", cursor: "pointer",
              background: T.dark, color: T.white,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
        </nav>

        {/* Dropdown menu panel */}
        {menuOpen && (
          <div style={{ maxWidth: 1100, margin: "12px auto 0" }}>
            <div style={{
              background: T.white, borderRadius: 24, border: `1px solid ${T.surfCont}`,
              boxShadow: "0 24px 60px -20px rgba(28,22,17,0.22)",
              padding: 24, display: "flex", flexDirection: "column", gap: 4,
            }}>
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ padding: "12px 8px", fontSize: 16, fontWeight: 500, color: T.dark, textDecoration: "none", borderRadius: 8 }}
                >
                  {item.label}
                </Link>
              ))}
              <div style={{ height: 1, background: T.outline, margin: "8px 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <button onClick={handleToggleLocale} className="nav-link" style={{ fontSize: 14 }}>
                  {isRTL ? "English" : "العربية"}
                </button>
                <Link
                  href={ctaHref}
                  className="btn btn-primary"
                  style={{ borderRadius: 9999, minHeight: 48, padding: "0 28px", fontSize: 14, fontWeight: 700 }}
                  onClick={() => setMenuOpen(false)}
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ HERO ═══ */}
      <section className="landing-snap-page" style={{
        position: "relative", overflow: "hidden",
        alignItems: "center",
        background: `linear-gradient(180deg, ${T.surfLow} 0%, ${T.white} 100%)`,
        padding: "96px 24px 120px",
      }}>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          style={{ position: "relative", zIndex: 1, maxWidth: 760, textAlign: "center" }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Eyebrow isRTL={isRTL}>{isRTL ? "المعيار الرائد في الأردن" : "Jordan's Standard for Barbers"}</Eyebrow>
          </div>

          <h1 style={{
            fontFamily: FFD, fontWeight: 800,
            fontSize: "clamp(2.6rem, 6.5vw, 4.6rem)",
            lineHeight: 1.06, letterSpacing: headingTracking(isRTL, "0.014em"),
            color: T.dark, marginBottom: 28,
          }}>
            {isRTL ? (
              <>مستقبل إدارة <span style={{ color: T.accent }}>الحرف</span></>
            ) : (
              <>The future of <span style={{ color: T.accent }}>craft</span> management</>
            )}
          </h1>

          <p style={{ fontSize: 18, color: T.mid, fontWeight: 300, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 40px" }}>
            {isRTL
              ? "الحجز والتحليلات وإدارة العملاء، معادة تصورها لمشغلك."
              : "Booking, analytics, and CRM — reimagined for the modern atelier."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
            <Link
              href="/auth/signup"
              className="btn btn-primary"
              style={{ minHeight: 56, padding: "0 36px", borderRadius: 9999, fontSize: 15, fontWeight: 700 }}
            >
              {isRTL ? "ابدأ البناء" : "Get started now"}
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {isRTL ? "arrow_back" : "arrow_forward"}
              </span>
            </Link>
            <Link
              href="/auth/signup"
              className="btn"
              style={{
                minHeight: 56, padding: "0 36px", borderRadius: 9999, fontSize: 15, fontWeight: 700,
                background: T.white, color: T.dark, border: `1px solid ${T.surfCont}`,
              }}
            >
              {isRTL ? "احجز عرضاً تجريبياً" : "Book a demo"}
            </Link>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 1,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.14em"), color: T.mid, borderBottom: `1px solid ${T.mid}`, paddingBottom: 4 }}>
            {isRTL ? "مرر للأسفل" : "Scroll"}
          </span>
        </div>
      </section>

      {/* ═══ VALUE PILLARS — Manage / Book / Grow ═══ */}
      <section className="landing-snap-page" style={{ background: T.white, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <SectionHeading
            FFD={FFD}
            isRTL={isRTL}
            eyebrow={isRTL ? "لماذا حلاقي" : "Why Halaqy"}
            title={isRTL ? "منصة واحدة، كل ما يحتاجه مشغلك." : "One platform, everything your shop needs."}
            marginBottom={72}
          />
          <div className="card-grid-3">
            {pillars.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 9999, background: T.surfLow,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: T.accent }}>{p.icon}</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, color: T.dark, marginBottom: 10 }}>{p.title}</h3>
                  <p style={{ color: T.mid, fontSize: 14, lineHeight: 1.7, fontWeight: 300 }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="landing-snap-page" style={{ background: T.surfLow, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <SectionHeading
            FFD={FFD}
            isRTL={isRTL}
            eyebrow={isRTL ? "الميزات" : "Features"}
            title={isRTL ? "كل ما يحتاجه مشغلك، في مكان واحد." : "Everything your shop needs, in one place."}
            subtitle={isRTL
              ? "من أول حجز إلى آخر مراجعة، صُممت هذه الأدوات لتعمل معًا بلا احتكاك."
              : "From the first booking to the last review, these tools are built to work together."}
          />
          <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${T.surfCont}`, background: T.surfCont, boxShadow: "0 32px 70px -32px rgba(28,22,17,0.12)" }}>
            <div className="landing-feature-grid">
              {features.map((f, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="landing-feature-cell">
                    <div className="landing-feature-icon">
                      <span className="material-symbols-outlined">{f.icon}</span>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, color: T.dark, marginBottom: 10 }}>
                      {f.title}
                    </h3>
                    <p style={{ color: T.mid, fontSize: 14, lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="landing-snap-page" style={{ background: T.white, padding: "96px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionHeading
            FFD={FFD}
            isRTL={isRTL}
            eyebrow={isRTL ? "كيف يعمل" : "How It Works"}
            title={isRTL ? "من الإعداد إلى النمو." : "From setup to growth."}
            subtitle={isRTL
              ? "أنشئ بوابة حجزك واقبل أول موعد رقمي خلال دقائق."
              : "Set up your booking page and take your first digital appointment in minutes."}
            marginBottom={56}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, flexShrink: 0, paddingTop: 3 }}>
                    {step.num}
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: 16, color: T.dark, marginBottom: 8 }}>
                      {step.title}
                    </h4>
                    <p style={{ color: T.mid, fontWeight: 300, lineHeight: 1.7, fontSize: 15 }}>{step.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MISSION / APPROACH — alternating statement blocks ═══ */}
      <section className="landing-snap-page" style={{ position: "relative", overflow: "hidden", padding: "120px 24px" }}>
        <BackgroundVideo
          src="/videos/1.mp4"
          overlay={`linear-gradient(180deg, ${T.white}f2 0%, ${T.surfLow}ee 50%, ${T.white}f2 100%)`}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 96 }}>
          <Statement
            align="start"
            eyebrow={isRTL ? "مهمتنا" : "Our Mission"}
            FFD={FFD}
            isRTL={isRTL}
            title={isRTL ? "أدوات مصقولة لمحترفين مصقولين." : "Refined tools for refined masters."}
            body={isRTL
              ? "كل ما هو مطلوب لتقليل الاحتكاك التشغيلي والتركيز على حرفتك."
              : "Everything you need to cut operational friction and focus on your craft."}
          />
          <Statement
            align="end"
            eyebrow={isRTL ? "نهجنا" : "Our Approach"}
            FFD={FFD}
            isRTL={isRTL}
            title={isRTL ? "نُبنى مع الحلاقين، لا لهم فقط." : "Built with barbers, not just for them."}
            body={isRTL
              ? "نعمل مباشرة مع مشاغل حقيقية لتشكيل كل ميزة — فلا شيء يُطلق ما لم يصمد أمام ازدحام يوم السبت."
              : "We work directly with working shops to shape every feature — nothing ships that doesn't survive a Saturday rush."}
          />
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="landing-snap-page" style={{ background: T.surfLow, padding: "96px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <SectionHeading
            FFD={FFD}
            isRTL={isRTL}
            eyebrow={isRTL ? "التسعير" : "Pricing"}
            title={isRTL ? "تسعير شفاف." : "Honest pricing."}
            subtitle={isRTL ? "مسار واحد شفاف لكل متجر." : "One simple plan for every shop."}
          />

          <Reveal delay={0.1}>
            <div style={{ padding: 48, borderRadius: 24, background: T.white, border: `1px solid ${T.surfCont}`, boxShadow: "0 32px 70px -32px rgba(28,22,17,0.22)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24, marginBottom: 40, paddingBottom: 40, borderBottom: `1px solid ${T.surfCont}` }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 22, color: T.dark, marginBottom: 6 }}>Professional</h3>
                  <p style={{ color: T.mid, fontWeight: 300, fontSize: 14 }}>{isRTL ? "حرية تشغيل كاملة." : "Total operational freedom."}</p>
                </div>
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontWeight: 800, fontSize: 40, color: T.dark, lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums" }}>1.5 JOD</div>
                  <div style={{ fontWeight: 500, fontSize: 12, color: T.mid, marginTop: 6 }}>
                    {isRTL ? "لكل حلاق / شهر" : "per barber / month"}
                  </div>
                </div>
              </div>

              <div className="card-grid-2" style={{ marginBottom: 40 }}>
                {pricingFeats.map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.accent }}>check</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.dark }}>{feat}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/auth/signup"
                className="btn btn-primary"
                style={{ width: "100%", minHeight: 52, borderRadius: 9999, fontSize: 15, fontWeight: 700 }}
              >
                {isRTL ? "ابدأ تجربة 14 يوم" : "Start 14-day trial"}
              </Link>
              <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.mid }}>
                {isRTL ? "لا يتطلب التزامًا." : "No commitment required."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ CONTACT + FOOTER — the final "page" ═══ */}
      <section className="landing-snap-page" style={{ position: "relative", overflow: "hidden", background: T.dark, color: T.white, padding: "96px 24px 32px" }}>
        <BackgroundVideo
          src="/videos/2.mp4"
          overlay={`linear-gradient(180deg, ${T.dark}c8 0%, ${T.dark}dc 55%, ${T.dark}ea 100%)`}
        />

        <Reveal>
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <Eyebrow isRTL={isRTL} dark>{isRTL ? "تواصل" : "Get In Touch"}</Eyebrow>
            <h2 style={{ fontFamily: FFD, fontWeight: 800, fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", letterSpacing: headingTracking(isRTL, "0.014em"), marginBottom: 16 }}>
              {isRTL ? "نرحب بك للتواصل." : "We'd love to hear from you."}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 300, marginBottom: 40 }}>
              {isRTL ? "ابدأ اليوم أو تحدث معنا حول احتياجات مشغلك." : "Start today, or talk to us about your shop's needs."}
            </p>
            <Link
              href="/auth/signup"
              className="btn"
              style={{ minHeight: 52, padding: "0 36px", borderRadius: 9999, fontSize: 15, fontWeight: 700, background: T.white, color: T.dark }}
            >
              {isRTL ? "ابدأ الآن" : "Get started"}
            </Link>
          </div>
        </Reveal>

        {/* Footer bar */}
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 1100, margin: "96px auto 0", width: "100%",
          borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 32,
          display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 24,
        }}>
          <span dir="ltr" style={{ fontFamily: FONT_EN_DISPLAY, fontSize: 17, fontWeight: 700, color: T.white }}>Halaqy.</span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
            {navLinks.filter((l) => !l.href.startsWith("/customer") && !l.href.startsWith("/calendar") && !l.href.startsWith("/leads") && l.href !== "/").map((link) => (
              <Link key={link.label} href={link.href} style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
                {link.label}
              </Link>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>
            © 2026 Halaqy.
          </p>
        </div>
      </section>
    </div>
  );
}
