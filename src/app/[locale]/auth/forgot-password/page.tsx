"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation, headingTracking } from "@/hooks/use-translation";

const FF = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";

const T = {
  dark:    "#1c1611",
  mid:     "#5a5147",
  muted:   "#5a5147",
  outline: "#ede3cd",
  surfLow: "#ffffff",
  white:   "#ffffff",
  black:   "#1c1611",
  accent:  "#7c4a1e",
  error:   "#ba1a1a",
  errBg:   "#ffdad6",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const { t, dir, isRTL, FFD } = useTranslation();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF, direction: dir }}>
      {/* NavBar */}
      <nav className="auth-nav" style={{
        background: T.white,
        borderBottom: `1px solid ${T.outline}`,
      }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-intervar), sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "0.012em", color: T.dark }}>
            Halaqy
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            href="/auth/login"
            className="btn btn-secondary"
            style={{ borderRadius: 9999, minHeight: 36, padding: "0 16px", fontSize: 12 }}
          >
            {isRTL ? "العودة لتسجيل الدخول" : "Back to Sign In"}
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="auth-main" style={{ background: T.white }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          style={{ width: "100%", maxWidth: 480 }}
        >
          <div className="auth-card" style={{
            background: T.white, borderRadius: 12,
            border: `1px solid ${T.outline}`,
          }}>
            {sent ? (
              /* ── Success State ── */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 12,
                  background: "rgba(166,124,61,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 8,
                }}>
                  <CheckCircle size={28} style={{ color: "#a67c3d" }} />
                </div>
                <h1 style={{ fontFamily: FFD, fontSize: 24, fontWeight: 700, color: T.dark, margin: 0 }}>
                  {isRTL ? "تحقق من بريدك الإلكتروني" : "Check your email"}
                </h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  {isRTL ? "لقد أرسلنا رابط إعادة تعيين كلمة المرور إلى " : "We sent a password reset link to "}
                  <strong style={{ color: T.dark }}>{email}</strong>
                  {isRTL ? ". تحقق من بريدك الوارد واتبع التعليمات." : ". Check your inbox and follow the instructions."}
                </p>
                <div style={{ marginTop: 24, width: "100%" }}>
                  <Link
                    href="/auth/login"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", height: 52,
                      background: T.accent, color: T.white,
                      borderRadius: 8, fontSize: 14, fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <BackArrow size={16} /> {isRTL ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                  </Link>
                </div>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                  {isRTL ? "لم تستلم البريد الإلكتروني؟" : "Didn't receive the email?"}{" "}
                  <button
                    onClick={() => setSent(false)}
                    style={{ background: "none", border: "none", color: T.dark, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                  >
                    {isRTL ? "حاول مرة أخرى" : "Try again"}
                  </button>
                </p>
              </div>
            ) : (
              /* ── Form State ── */
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
                  <div style={{
                    width: 44, height: 44, background: T.black, borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: T.white, fontVariationSettings: "'FILL' 1" }}>
                      lock_reset
                    </span>
                  </div>
                  <h1 style={{ fontFamily: FFD, fontSize: 28, fontWeight: 300, letterSpacing: headingTracking(isRTL, "0.016em"), color: T.dark, marginBottom: 10 }}>
                    {isRTL ? "إعادة تعيين كلمة المرور" : "Reset password"}
                  </h1>
                  <p style={{ fontSize: 14, color: T.muted, fontWeight: 300, letterSpacing: headingTracking(isRTL, "0.01em"), textAlign: "center" }}>
                    {isRTL ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين." : "Enter your email address and we'll send you a reset link."}
                  </p>
                </div>

                {error && (
                  <div style={{
                    marginBottom: 24, padding: "12px 16px",
                    borderRadius: 12, background: T.errBg,
                    color: T.error, fontSize: 14, fontWeight: 500,
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label
                      htmlFor="email"
                      style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.2em"), color: T.muted }}
                    >
                      {t.auth.emailAddress}
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        height: 52, padding: "0 18px",
                        borderRadius: 8, border: `1px solid ${T.outline}`,
                        background: T.surfLow, fontFamily: FF, fontSize: 14,
                        color: T.dark, outline: "none", transition: "all 0.15s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.background = T.white;
                        e.currentTarget.style.border = "1px solid #a67c3d";
                        e.currentTarget.style.boxShadow = "var(--shadow-focus)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.background = T.surfLow;
                        e.currentTarget.style.border = `1px solid ${T.outline}`;
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ height: 52, width: "100%", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? (
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <>
                        <span>{isRTL ? "إرسال رابط إعادة التعيين" : "Send Reset Link"}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isRTL ? "arrow_back" : "arrow_forward"}</span>
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 32, textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: T.muted, opacity: 0.7 }}>
                    {isRTL ? "تتذكر كلمة مرورك؟" : "Remember your password?"}{" "}
                    <Link href="/auth/login" style={{ fontWeight: 700, color: T.dark, textDecoration: "none" }}>
                      {t.auth.signInBtn}
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
