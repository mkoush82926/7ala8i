"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import Link from "next/link";
import { useThemeStore } from "@/store/theme-store";

// ─── Design tokens (no Tailwind token dependency) ───
const T = {
  black:   "#000000",
  white:   "#ffffff",
  dark:    "#191c1e",
  mid:     "#45464c",
  muted:   "#76777d",
  outline: "#c6c6cc",
  surf:    "#f7f9fb",
  surfLow: "#f2f4f6",
  surfCont:"#eceef0",
  surfHigh:"#e0e3e5",
};

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const { direction, toggleLocale } = useThemeStore();
  const isRTL = direction === "rtl";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", isRTL ? "ar" : "en");
  }, [direction, isRTL]);

  const FF = "'Manrope', 'Inter', system-ui, sans-serif";

  const features = [
    { icon: "schedule",      title: isRTL ? "تقويم ذكي"        : "Smart Calendar",     desc: isRTL ? "إدارة جداول زمنية متكيفة تتزامن مع سير عمل فريقك الطبيعي."             : "Adaptive timeline management that synchronizes with your team's natural workflow." },
    { icon: "account_tree", title: isRTL ? "مسار إدارة العملاء": "CRM Pipeline",       desc: isRTL ? "تصور رحلة عميلك بشكل أنيق من الاكتشاف إلى الولاء طويل الأمد."         : "Elegantly visualize your client journey from discovery to long-term loyalty." },
    { icon: "link",          title: isRTL ? "الحجز الإلكتروني"  : "Online Booking",    desc: isRTL ? "بوابة حجز بسيطة مصممة للعيش على المنصات الاجتماعية وحضورك على الويب." : "A minimalist booking portal designed to live on social platforms and your web presence." },
    { icon: "insights",      title: isRTL ? "تقارير وتحليلات"   : "Insights",          desc: isRTL ? "أطر تحليلية عميقة لفك رموز الاحتفاظ وتحسين ساعات الذروة."              : "Deep analytical frameworks to decode retention and optimize peak performance hours." },
    { icon: "thumb_up",      title: isRTL ? "مركز السمعة"       : "Reputation Hub",    desc: isRTL ? "حلقات تغذية راجعة آلية تضخم حضورك في محركات الاكتشاف المحلية."          : "Automated feedback loops that amplify your presence in local discovery engines." },
    { icon: "smartphone",    title: isRTL ? "تجربة متحركة"      : "Native Experience", desc: isRTL ? "تطبيقات iOS و Android سلسة للإدارة خارج المكتب."                        : "Fluid iOS and Android applications for management beyond the desk." },
  ];

  const steps = [
    { num: "01", title: isRTL ? "أنشئ"  : "Construct", desc: isRTL ? "أدخل موظفيك وخدماتك والأسعار الديناميكية."                                           : "Input your personnel, services, and dynamic pricing. Define your atmosphere through visual assets." },
    { num: "02", title: isRTL ? "وزّع"  : "Distribute", desc: isRTL ? "ادمج بوابتك الفريدة عبر قنوات التواصل والملفات الشخصية الاجتماعية."               : "Integrate your unique portal across communication channels and social profiles." },
    { num: "03", title: isRTL ? "حسّن"  : "Optimize",   desc: isRTL ? "استفد من محركات التسويق الآلية لتطوير الاحتفاظ وتعظيم الإيرادات."                  : "Leverage automated marketing engines to cultivate retention and maximize revenue output." },
  ];

  const pricingFeats = [
    isRTL ? "حجوزات لا محدودة"   : "Infinite Bookings",
    isRTL ? "مجموعة CRM الكاملة" : "Full CRM Suite",
    isRTL ? "رؤى متقدمة"         : "Advanced Insights",
    isRTL ? "بوابة حجز مخصصة"   : "Branded Booking Portal",
    isRTL ? "أتمتة المراجعات"    : "Review Automation",
    isRTL ? "وصول للتطبيق"       : "Native App Access",
  ];

  const footerCols = [
    { title: isRTL ? "المنصة"  : "Platform", links: [isRTL ? "الميزات" : "Features", isRTL ? "التسعير" : "Pricing", isRTL ? "التطبيقات" : "Applications"] },
    { title: "Studio",                        links: [isRTL ? "من نحن"  : "About",    isRTL ? "الوظائف" : "Careers",  "Journal"] },
    { title: isRTL ? "القانوني": "Legal",     links: [isRTL ? "الخصوصية": "Privacy", isRTL ? "الشروط"  : "Terms",   "Support"] },
  ];

  return (
    <div style={{ fontFamily: FF, background: T.white, color: T.dark, overflowX: "hidden" }}>

      {/* ═══ NAVBAR ═══ */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 48px", height: 80,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.outline}33`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <span style={{ fontFamily: FF, fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: T.dark }}>
            Halaqy.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Dashboard", "Calendar", "Leads"].map((item) => (
              <Link
                key={item}
                href={item === "Dashboard" ? "/" : `/${item.toLowerCase()}`}
                style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: T.mid, textDecoration: "none" }}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button
            onClick={() => toggleLocale()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.mid }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>language</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em" }}>{isRTL ? "EN" : "عربي"}</span>
          </button>
          <Link
            href="/auth/signup"
            style={{
              padding: "10px 24px", background: T.black, color: T.white,
              borderRadius: 999, fontWeight: 700, fontSize: 11,
              textTransform: "uppercase", letterSpacing: "0.06em",
              textDecoration: "none", display: "inline-block",
            }}
          >
            {isRTL ? "ابدأ الآن" : "GET STARTED"}
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ paddingTop: 96, paddingBottom: 96, paddingLeft: 48, paddingRight: 48, background: T.white, position: "relative" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 96, alignItems: "center" }}>

          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 999,
              background: T.surfHigh, color: T.mid,
              marginBottom: 32,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                {isRTL ? "المعيار الرائد في الأردن" : "Jordan's Standard for Barbers"}
              </span>
            </div>

            <h1 style={{
              fontFamily: FF, fontWeight: 800,
              fontSize: "clamp(3rem, 5.5vw, 5rem)",
              lineHeight: 1, letterSpacing: "-0.03em",
              color: T.dark, marginBottom: 40,
            }}>
              {isRTL ? (
                <>مستقبل إدارة <span style={{ color: "#475569" }}>الحِرَف</span></>
              ) : (
                <>The Future of <span style={{ color: "#475569" }}>Craft</span> Management</>
              )}
            </h1>

            <p style={{ fontSize: 18, color: T.mid, fontWeight: 300, lineHeight: 1.7, maxWidth: 480, marginBottom: 48 }}>
              {isRTL
                ? "ارتقِ بمشغلك مع الحجز والتحليلات وإدارة العملاء المُعادة تصورها للعصر الحديث."
                : "Elevate your atelier with booking, analytics, and CRM reimagined for the modern era."}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              <Link
                href="/auth/signup"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "18px 40px", background: T.black, color: T.white,
                  borderRadius: 999, fontWeight: 800, fontSize: 14,
                  fontFamily: FF, textDecoration: "none",
                }}
              >
                {isRTL ? "ابدأ البناء" : "Start Building"}
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
              </Link>
              <Link
                href="/book"
                style={{
                  display: "flex", alignItems: "center",
                  padding: "18px 40px",
                  color: "#374151", fontSize: 14, fontWeight: 600,
                  borderRadius: 999, border: `1px solid ${T.outline}`,
                  fontFamily: FF, textDecoration: "none",
                }}
              >
                {isRTL ? "احجز عرضاً تجريبياً" : "Book Demo"}
              </Link>
            </div>
          </motion.div>

          {/* Right — Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
            style={{ position: "relative" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 16 }}>
              {/* Revenue Card */}
              <div style={{ gridColumn: "1 / -1", background: T.white, padding: 32, borderRadius: 24, border: `1px solid ${T.surfCont}`, boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: T.mid, margin: 0 }}>
                    {isRTL ? "الإيرادات" : "Revenue"}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.1em" }}>+12.4%</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
                  {[50, 75, 65, 100, 50, 80, 100].map((h, i) => (
                    <motion.div
                      key={i}
                      style={{ flex: 1, borderRadius: 999, background: i === 3 || i === 6 ? T.black : T.surfHigh }}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.7, delay: 0.5 + i * 0.07, ease: [0.25, 1, 0.5, 1] }}
                    />
                  ))}
                </div>
              </div>

              {/* Bookings Card */}
              <div style={{ background: "#171717", padding: 32, borderRadius: 24, color: T.white }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, marginBottom: 16, display: "block", opacity: 0.5 }}>calendar_month</span>
                <div style={{ fontFamily: FF, fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>1,284</div>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", opacity: 0.4, marginTop: 4 }}>
                  {isRTL ? "حجز" : "Bookings"}
                </div>
              </div>

              {/* Rating Card */}
              <div style={{ background: "#fef3c7", padding: 32, borderRadius: 24 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, marginBottom: 16, display: "block", color: "#92400e", fontVariationSettings: "'FILL' 1" }}>star</span>
                <div style={{ fontFamily: FF, fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#1a1a1a" }}>4.9/5</div>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#92400e", opacity: 0.6, marginTop: 4 }}>
                  {isRTL ? "تقييم" : "Rating"}
                </div>
              </div>
            </div>
            {/* Glow */}
            <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, background: "rgba(213,227,252,0.2)", borderRadius: "50%", filter: "blur(120px)", zIndex: -1 }} />
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section style={{ paddingTop: 96, paddingBottom: 96, paddingLeft: 48, paddingRight: 48, background: T.surfLow }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Reveal>
            <div style={{ marginBottom: 96 }}>
              <h2 style={{ fontFamily: FF, fontWeight: 800, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", letterSpacing: "-0.03em", color: T.dark, marginBottom: 24 }}>
                {isRTL ? "أدوات مصقولة لمحترفين مصقولين." : "Refined tools for refined masters."}
              </h2>
              <p style={{ color: T.mid, fontSize: 18, fontWeight: 300, lineHeight: 1.7, maxWidth: 500 }}>
                {isRTL
                  ? "كل ما هو مطلوب للقضاء على الاحتكاك التشغيلي، مما يتيح لك التركيز على فن حرفتك."
                  : "Everything needed to eliminate operational friction, allowing you to focus on the artistry of your craft."}
              </p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "64px 48px" }}>
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div>
                  <div style={{ marginBottom: 32, borderBottom: `2px solid ${T.surfCont}`, width: 40, height: 40, display: "flex", alignItems: "flex-end" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.black }}>{f.icon}</span>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: T.dark, marginBottom: 16 }}>
                    {f.title}
                  </h3>
                  <p style={{ color: T.mid, fontSize: 14, lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section style={{ paddingTop: 96, paddingBottom: 96, paddingLeft: 48, paddingRight: 48, background: T.white }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 128, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Left sticky */}
            <Reveal>
              <div style={{ maxWidth: 400, position: "sticky", top: 160 }}>
                <h2 style={{ fontFamily: FF, fontWeight: 800, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", letterSpacing: "-0.03em", color: T.dark, marginBottom: 32 }}>
                  {isRTL ? "من الإعداد إلى النمو." : "From setup to growth."}
                </h2>
                <p style={{ color: T.mid, fontSize: 18, fontWeight: 300, lineHeight: 1.7, marginBottom: 48 }}>
                  {isRTL
                    ? "فلسفة إعداد مبسّطة تتيح لك قبول أول حجز رقمي في غضون دقائق."
                    : "A streamlined onboarding philosophy allows you to accept your first digital booking within minutes."}
                </p>
                <div style={{ aspectRatio: "4/3", background: T.surfHigh, borderRadius: 24, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 80, color: "#9ca3af" }}>content_cut</span>
                </div>
              </div>
            </Reveal>

            {/* Right steps */}
            <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 96, paddingTop: 32 }}>
              {steps.map((step, i) => (
                <Reveal key={i} delay={i * 0.12}>
                  <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
                    <div style={{ fontFamily: FF, fontSize: 52, fontWeight: 900, color: T.surfHigh, lineHeight: 1, flexShrink: 0 }}>
                      {step.num}
                    </div>
                    <div>
                      <h4 style={{ fontFamily: FF, fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.12em", color: T.dark, marginBottom: 16 }}>
                        {step.title}
                      </h4>
                      <p style={{ color: T.mid, fontWeight: 300, lineHeight: 1.7 }}>{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section style={{ paddingTop: 96, paddingBottom: 96, paddingLeft: 48, paddingRight: 48, background: "#1a1a1a", color: T.white }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 96 }}>
              <h2 style={{ fontFamily: FF, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em", color: T.white, marginBottom: 16 }}>
                {isRTL ? "تسعير شفاف." : "Honest Pricing."}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: 300 }}>
                {isRTL ? "مسار واحد شفاف لكل متجر." : "A single, transparent path for every shop."}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div style={{ padding: 64, borderRadius: 32, background: T.white, color: "#121212", position: "relative", overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 48, marginBottom: 64, paddingBottom: 64, borderBottom: `1px solid ${T.surfCont}` }}>
                <div>
                  <h3 style={{ fontFamily: FF, fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", color: T.dark, marginBottom: 12 }}>Professional</h3>
                  <p style={{ color: T.mid, fontWeight: 300 }}>{isRTL ? "حرية تشغيل كاملة." : "Total operational freedom."}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FF, fontWeight: 900, fontSize: 52, letterSpacing: "-0.04em", color: T.dark, lineHeight: 1 }}>1.5 JOD</div>
                  <div style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: T.mid, opacity: 0.5, marginTop: 4 }}>
                    {isRTL ? "لكل حلاق / شهر" : "Per Barber / Mo"}
                  </div>
                </div>
              </div>

              {/* Features grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 64px", marginBottom: 64 }}>
                {pricingFeats.map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.black, fontVariationSettings: "'wght' 700" }}>check</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.dark }}>{feat}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/auth/signup"
                style={{
                  display: "block", width: "100%", padding: "24px 0",
                  textAlign: "center", fontWeight: 800, fontSize: 13,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  borderRadius: 999, background: T.black, color: T.white,
                  textDecoration: "none", boxSizing: "border-box",
                }}
              >
                {isRTL ? "ابدأ تجربة 14 يوم" : "Initiate 14-Day Trial"}
              </Link>
              <p style={{ textAlign: "center", marginTop: 32, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#6b7280", opacity: 0.5 }}>
                {isRTL ? "لا يتطلب التزامًا." : "No commitment required."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ paddingTop: 96, paddingBottom: 96, paddingLeft: 48, paddingRight: 48, background: T.white, borderTop: `1px solid ${T.surfCont}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 64 }}>
          <div>
            <span style={{ fontFamily: FF, fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em", color: T.dark }}>Halaqy.</span>
            <p style={{ marginTop: 24, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", lineHeight: 2, color: T.mid }}>
              The Digital Standard.
            </p>
            <button
              onClick={() => toggleLocale()}
              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 32, background: "none", border: "none", cursor: "pointer", color: T.mid }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>language</span>
              <span style={{ fontWeight: 900, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em" }}>{isRTL ? "EN / عربي" : "AR / EN"}</span>
            </button>
          </div>

          {footerCols.map((col) => (
            <div key={col.title}>
              <h5 style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: T.black, marginBottom: 32 }}>
                {col.title}
              </h5>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.mid, textDecoration: "none" }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ maxWidth: 1280, margin: "96px auto 0", paddingTop: 48, borderTop: `1px solid ${T.surfCont}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: T.mid, opacity: 0.5 }}>
            © 2026 Halaqy Digital Atelier.
          </p>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: T.mid, opacity: 0.3, cursor: "pointer" }}>share</span>
        </div>
      </footer>
    </div>
  );
}
