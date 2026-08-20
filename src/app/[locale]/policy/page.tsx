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

export default function PolicyPage() {
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
              {isRTL ? "يحدّدها كل صالون بشكل مستقل" : "Set independently by each shop"}
            </span>
          </div>

          <h1 style={{
            fontFamily: FFD, fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 2.6rem)", letterSpacing: headingTracking(isRTL, "0.014em"),
            color: T.dark, marginBottom: 32,
          }}>
            {isRTL ? "سياسة الإلغاء والتغيب" : "Cancellation & No-Show Policy"}
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, color: T.mid, fontSize: 16, fontWeight: 300, lineHeight: 1.8 }}>
            <p>
              {isRTL
                ? "حلاقي منصة تربط العملاء بصالونات حلاقة مستقلة. كل صالون مدرج على حلاقي هو نشاط تجاري مستقل، وهو من يحدد سياسته الخاصة بالإلغاء والتغيب — وليس هذه الصفحة. هذه الصفحة تشرح كيف تعمل هذه السياسات بشكل عام على المنصة."
                : "Halaqy is a platform that connects customers with independent barbershops. Each shop listed on Halaqy is its own business, and it is the shop — not this page — that sets its own cancellation and no-show policy. This page explains how those policies generally work on the platform."}
            </p>
            <p>
              {isRTL
                ? "يمكن لكل صالون تحديد مهلة إشعار قبل الموعد (بالساعات) يجب على العميل الإلغاء خلالها لتجنب أي رسوم، بالإضافة إلى رسوم اختيارية للإلغاء المتأخر أو التغيب، تُحسب كنسبة مئوية من سعر الخدمة. يظهر \"التغيب\" عندما لا يحضر العميل موعده ولا يقوم بإلغائه مسبقًا."
                : "Each shop can define a notice window (in hours) before an appointment within which a customer should cancel to avoid a fee, plus an optional fee for late cancellations or no-shows, calculated as a percentage of the service price. A \"no-show\" is recorded when a customer neither attends nor cancels an appointment in advance."}
            </p>
            <p>
              {isRTL
                ? "في الوقت الحالي، لا تقوم حلاقي بمعالجة أي مدفوعات أو خصم رسوم إلغاء تلقائيًا. أي رسوم يقررها الصالون تُحصَّل مباشرة بين العميل والصالون (عادةً نقدًا في المكان)، بنفس طريقة الدفع مقابل الخدمة نفسها."
                : "At this time, Halaqy does not automatically process payments or charge cancellation fees. Any fee a shop chooses to apply is collected directly between the customer and the shop (typically in person), the same way payment for the service itself is handled."}
            </p>
            <p>
              {isRTL
                ? "بما أن ضبط ساعات المهلة ونسبة الرسوم لكل صالون على حدة غير متاح بعد داخل التطبيق، فإن جميع الصالونات تتبع حاليًا الإعداد الافتراضي للمنصة: مهلة إشعار مدتها 24 ساعة بدون أي رسوم إلغاء. يرجى دائمًا تأكيد سياسة الإلغاء الفعلية مباشرة مع الصالون عند الحجز، لأن هذا قد يتغير مستقبلاً."
                : "Because per-shop customization of the notice window and fee percentage isn't available in the app yet, every shop currently follows the platform default: a 24-hour notice window with no cancellation fee. Please always confirm the exact cancellation policy directly with the shop when booking, as this may change in the future."}
            </p>
            <p>
              {isRTL
                ? "لديك أسئلة حول سياسة الإلغاء الخاصة بصالون معين؟ تواصل مع الصالون مباشرة عبر بيانات التواصل الظاهرة في صفحة حجزه."
                : "Questions about a specific shop's cancellation policy? Contact that shop directly using the contact details on its booking page."}
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
