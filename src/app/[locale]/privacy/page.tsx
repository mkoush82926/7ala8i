"use client";

import React from "react";
import Link from "next/link";
import { useTranslation, headingTracking, FONT_EN_DISPLAY } from "@/hooks/use-translation";

const T = {
  dark:    "#1c1611",
  mid:     "#5a5147",
  outline: "#ede3cd",
  white:   "#ffffff",
  surfLow: "#f7f1e4",
};

export default function PrivacyPage() {
  const { FF, FFD, dir, isRTL } = useTranslation();

  return (
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF, direction: dir, display: "flex", flexDirection: "column" }}>
      <nav className="auth-nav" style={{ background: T.white, borderBottom: `1px solid ${T.outline}` }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span dir="ltr" style={{ fontFamily: FONT_EN_DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: "0.012em", color: T.dark }}>
            Halaqy
          </span>
        </Link>
        <Link
          href="/landing"
          className="btn btn-secondary"
          style={{ borderRadius: 9999, minHeight: 36, padding: "0 16px", fontSize: 12 }}
        >
          {isRTL ? "العودة للرئيسية" : "Back to Home"}
        </Link>
      </nav>

      <main className="landing-section" style={{ flex: 1 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 9999,
            background: T.surfLow, color: T.mid,
            marginBottom: 24,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
            <span style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.15em") }}>
              {isRTL ? "نسخة مبدئية — قيد المراجعة القانونية النهائية" : "Placeholder — pending final legal review"}
            </span>
          </div>

          <h1 style={{
            fontFamily: FFD, fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 2.6rem)", letterSpacing: headingTracking(isRTL, "0.014em"),
            color: T.dark, marginBottom: 32,
          }}>
            {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, color: T.mid, fontSize: 16, fontWeight: 300, lineHeight: 1.8 }}>
            <p>
              {isRTL
                ? "حلاقي لا تزال قيد التطوير النشط. هذه الصفحة هي نسخة مبدئية وستُستبدل بسياسة الخصوصية الكاملة قبل إتاحة المنصة للجمهور."
                : "Halaqy is currently in active development. This page is a placeholder and will be replaced with our complete Privacy Policy before the platform is made available to the public."}
            </p>
            <p>
              {isRTL
                ? "في هذه الأثناء: تجمع حلاقي المعلومات التي تقدمها عند إنشاء حساب أو حجز موعد (مثل اسمك وبيانات التواصل وسجل مواعيدك) من أجل تشغيل ميزات الجدولة والحجز الموضحة في التطبيق. سيتم نشر وصف كامل لما نجمعه وكيفية استخدامه وحقوقك بشأنه هنا قبل الإطلاق الرسمي."
                : "In the meantime: Halaqy collects the information you provide when creating an account or booking an appointment (such as your name, contact details, and appointment history) in order to operate the scheduling and booking features described in the app. A complete description of what we collect, how it's used, and your rights will be published here before public launch."}
            </p>
            <p>
              {isRTL
                ? "لديك أسئلة حول هذه السياسة؟ سيتم نشر معلومات التواصل مع فريق حلاقي هنا قبل الإطلاق الرسمي."
                : "Questions about this policy? Contact details for the Halaqy team will be published here before public launch."}
            </p>
          </div>
        </div>
      </main>

      <footer className="auth-footer" style={{ borderTop: `1px solid ${T.outline}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#a89e8c" }}>
          © 2026 Halaqy Digital.
        </p>
      </footer>
    </div>
  );
}
