"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation, headingTracking } from "@/hooks/use-translation";

const FF = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";
const T = {
  dark:    "#1c1611",
  muted:   "#5a5147",
  outline: "#ede3cd",
  surfLow: "#ffffff",
  white:   "#ffffff",
  black:   "#1c1611",
  accent:  "#7c4a1e",
  error:   "#ba1a1a",
  errBg:   "#ffdad6",
  green:   "#a67c3d",
  greenBg: "rgba(166,124,61,0.1)",
};

export default function ResetPasswordPage() {
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const redirectTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { t, dir, isRTL, FFD } = useTranslation();

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setTokenReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setTokenReady(true);
    });
    return () => {
      subscription.unsubscribe();
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError(t.auth.passwordRules); return; }
    if (password !== confirm) { setError(isRTL ? "كلمتا المرور غير متطابقتين." : "Passwords do not match."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }

    setSuccess(true);
    setLoading(false);
    redirectTimer.current = setTimeout(() => router.push("/auth/login"), 3000);
  }

  const strength = (() => {
    if (!password.length) return 0;
    let s = 0;
    if (password.length >= 8)        s++;
    if (/[A-Z]/.test(password))      s++;
    if (/[0-9]/.test(password))      s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = (isRTL ? ["", "ضعيفة", "مقبولة", "جيدة", "قوية"] : ["", "Weak", "Fair", "Good", "Strong"])[strength];
  const strengthColor = ["", "#ba1a1a", "#a67c3d", "#a67c3d", "#7c4a1e"][strength];

  return (
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF, direction: dir }}>
      <nav className="auth-nav" style={{ background: T.white, borderBottom: `1px solid ${T.outline}` }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-intervar), sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "0.012em", color: T.dark }}>Halaqy</span>
        </Link>
      </nav>

      <main className="auth-main" style={{ background: T.white }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }} style={{ width: "100%", maxWidth: 480 }}>
          <div className="auth-card" style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.outline}` }}>

            {success ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <CheckCircle size={28} style={{ color: T.green }} />
                </div>
                <h1 style={{ fontFamily: FFD, fontSize: 24, fontWeight: 700, color: T.dark, margin: 0 }}>{isRTL ? "تم تحديث كلمة المرور!" : "Password updated!"}</h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  {isRTL ? "تم تغيير كلمة مرورك. جارٍ تحويلك لتسجيل الدخول…" : "Your password has been changed. Redirecting you to sign in…"}
                </p>
                <Link href="/auth/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 52, background: T.accent, color: T.white, borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", marginTop: 12 }}>
                  {isRTL ? "الذهاب لتسجيل الدخول" : "Go to Sign In"}
                </Link>
              </div>
            ) : !tokenReady ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: T.errBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <XCircle size={28} style={{ color: T.error }} />
                </div>
                <h1 style={{ fontFamily: FFD, fontSize: 22, fontWeight: 700, color: T.dark, margin: 0 }}>{isRTL ? "الرابط غير صالح أو منتهي الصلاحية" : "Invalid or expired link"}</h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  {isRTL ? "انتهت صلاحية رابط إعادة التعيين هذا. الرجاء طلب رابط جديد." : "This reset link has expired. Please request a new one."}
                </p>
                <Link href="/auth/forgot-password" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 52, background: T.accent, color: T.white, borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", marginTop: 12 }}>
                  {isRTL ? "طلب رابط جديد" : "Request New Link"}
                </Link>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
                  <div style={{ width: 44, height: 44, background: T.black, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                    <span style={{ color: T.white, fontSize: 20 }}>🔒</span>
                  </div>
                  <h1 style={{ fontFamily: FFD, fontSize: 28, fontWeight: 300, letterSpacing: headingTracking(isRTL, "0.016em"), color: T.dark, marginBottom: 10 }}>{isRTL ? "كلمة مرور جديدة" : "New password"}</h1>
                  <p style={{ fontSize: 14, color: T.muted, fontWeight: 300, textAlign: "center" }}>{isRTL ? "اختر كلمة مرور قوية لحسابك." : "Choose a strong password for your account."}</p>
                </div>

                {error && (
                  <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 12, background: T.errBg, color: T.error, fontSize: 14, fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* New Password */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label htmlFor="password" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.2em"), color: T.muted }}>{isRTL ? "كلمة المرور الجديدة" : "New Password"}</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password" type={showPw ? "text" : "password"} required autoComplete="new-password"
                        placeholder={t.auth.passwordRules} value={password} onChange={(e) => setPassword(e.target.value)}
                        style={{ height: 52, width: "100%", padding: "0 48px 0 18px", borderRadius: 8, border: `1px solid ${T.outline}`, background: T.surfLow, fontFamily: FF, fontSize: 14, color: T.dark, outline: "none", transition: "all 0.15s", boxSizing: "border-box" }}
                        onFocus={(e) => { e.currentTarget.style.background = T.white; e.currentTarget.style.border = "1px solid #a67c3d"; e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
                        onBlur={(e) => { e.currentTarget.style.background = T.surfLow; e.currentTarget.style.border = `1px solid ${T.outline}`; e.currentTarget.style.boxShadow = "none"; }}
                      />
                      <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ display: "flex", gap: 4, flex: 1 }}>
                          {[1, 2, 3, 4].map((level) => (
                            <div key={level} style={{ flex: 1, height: 3, borderRadius: 9999, background: level <= strength ? strengthColor : T.outline, transition: "background 0.3s" }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor }}>{strengthLabel}</span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label htmlFor="confirm" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.2em"), color: T.muted }}>{isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}</label>
                    <input
                      id="confirm" type="password" required autoComplete="new-password"
                      placeholder={isRTL ? "أعد إدخال كلمة المرور" : "Repeat your password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      style={{ height: 52, width: "100%", padding: "0 18px", borderRadius: 8, border: `1px solid ${confirm && confirm !== password ? T.error : T.outline}`, background: T.surfLow, fontFamily: FF, fontSize: 14, color: T.dark, outline: "none", transition: "all 0.15s", boxSizing: "border-box" }}
                      onFocus={(e) => { e.currentTarget.style.background = T.white; e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
                      onBlur={(e) => { e.currentTarget.style.background = T.surfLow; e.currentTarget.style.boxShadow = "none"; }}
                    />
                    {confirm && confirm !== password && (
                      <p style={{ fontSize: 12, color: T.error, margin: 0 }}>{isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match"}</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 52, width: "100%", marginTop: 8, opacity: loading ? 0.7 : 1 }}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : (isRTL ? "تحديث كلمة المرور" : "Update Password")}
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
