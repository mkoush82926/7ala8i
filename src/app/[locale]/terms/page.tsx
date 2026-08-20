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

export default function TermsPage() {
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
            {isRTL ? "شروط الخدمة" : "Terms of Service"}
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, color: T.mid, fontSize: 16, fontWeight: 300, lineHeight: 1.8 }}>
            <p>
              {isRTL
                ? "حلاقي لا تزال قيد التطوير النشط. هذه الصفحة هي نسخة مبدئية وستُستبدل بشروط الخدمة الكاملة قبل إتاحة المنصة للجمهور."
                : "Halaqy is currently in active development. This page is a placeholder and will be replaced with our complete Terms of Service before the platform is made available to the public."}
            </p>
            <p>
              {isRTL
                ? "في هذه الأثناء: بإنشائك حساباً أو حجزك لموعد عبر حلاقي، فإنك توافق على تقديم معلومات دقيقة واستخدام المنصة باحترام. كل صالون حلاقة مدرج على حلاقي مسؤول بشكل مستقل عن خدماته وأسعاره وسياسة الإلغاء الخاصة به — يرجى التأكد من هذه التفاصيل مباشرة مع الصالون عند الحجز."
                : "In the meantime: by creating an account or booking an appointment through Halaqy, you agree to provide accurate information and to use the platform respectfully. Each barbershop listed on Halaqy is independently responsible for its own services, pricing, and cancellation policy — please confirm those details directly with the shop when booking."}
            </p>
            <p>
              {isRTL
                ? "لديك أسئلة حول هذه الشروط؟ سيتم نشر معلومات التواصل مع فريق حلاقي هنا قبل الإطلاق الرسمي."
                : "Questions about these terms? Contact details for the Halaqy team will be published here before public launch."}
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
