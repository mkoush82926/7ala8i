"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const FF = "'Inter', 'Manrope', system-ui, sans-serif";
const T = {
  dark:    "#191c1e",
  muted:   "#76777d",
  outline: "#e2e8f0",
  surfLow: "#f8fafc",
  white:   "#ffffff",
  black:   "#000000",
  error:   "#ba1a1a",
  errBg:   "#ffdad6",
  green:   "#059669",
  greenBg: "#d1fae5",
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
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

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
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ba1a1a", "#f59e0b", "#3b82f6", "#059669"][strength];

  return (
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF }}>
      <nav className="auth-nav" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.outline}` }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: T.dark }}>Halaqy</span>
        </Link>
      </nav>

      <main className="auth-main" style={{ background: T.white }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }} style={{ width: "100%", maxWidth: 480 }}>
          <div className="auth-card" style={{ background: T.white, borderRadius: 24, border: `1px solid ${T.outline}` }}>

            {success ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <CheckCircle size={28} style={{ color: T.green }} />
                </div>
                <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 700, color: T.dark, margin: 0 }}>Password updated!</h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  Your password has been changed. Redirecting you to sign in…
                </p>
                <Link href="/auth/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 52, background: T.black, color: T.white, borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", marginTop: 12 }}>
                  Go to Sign In
                </Link>
              </div>
            ) : !tokenReady ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: T.errBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <XCircle size={28} style={{ color: T.error }} />
                </div>
                <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 700, color: T.dark, margin: 0 }}>Invalid or expired link</h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  This reset link has expired. Please request a new one.
                </p>
                <Link href="/auth/forgot-password" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 52, background: T.black, color: T.white, borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", marginTop: 12 }}>
                  Request New Link
                </Link>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
                  <div style={{ width: 44, height: 44, background: T.black, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                    <span style={{ color: T.white, fontSize: 20 }}>🔒</span>
                  </div>
                  <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", color: T.dark, marginBottom: 10 }}>New password</h1>
                  <p style={{ fontSize: 14, color: T.muted, fontWeight: 300, textAlign: "center" }}>Choose a strong password for your account.</p>
                </div>

                {error && (
                  <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 12, background: T.errBg, color: T.error, fontSize: 14, fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* New Password */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label htmlFor="password" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.muted }}>New Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password" type={showPw ? "text" : "password"} required autoComplete="new-password"
                        placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)}
                        style={{ height: 52, width: "100%", padding: "0 48px 0 18px", borderRadius: 12, border: `1px solid ${T.outline}`, background: T.surfLow, fontFamily: FF, fontSize: 14, color: T.dark, outline: "none", transition: "all 0.15s", boxSizing: "border-box" }}
                        onFocus={(e) => { e.currentTarget.style.background = T.white; e.currentTarget.style.border = `1px solid ${T.black}`; e.currentTarget.style.boxShadow = `0 0 0 2px ${T.black}22`; }}
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
                            <div key={level} style={{ flex: 1, height: 3, borderRadius: 99, background: level <= strength ? strengthColor : T.outline, transition: "background 0.3s" }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor }}>{strengthLabel}</span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label htmlFor="confirm" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.muted }}>Confirm Password</label>
                    <input
                      id="confirm" type="password" required autoComplete="new-password"
                      placeholder="Repeat your password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      style={{ height: 52, width: "100%", padding: "0 18px", borderRadius: 12, border: `1px solid ${confirm && confirm !== password ? T.error : T.outline}`, background: T.surfLow, fontFamily: FF, fontSize: 14, color: T.dark, outline: "none", transition: "all 0.15s", boxSizing: "border-box" }}
                      onFocus={(e) => { e.currentTarget.style.background = T.white; e.currentTarget.style.boxShadow = `0 0 0 2px ${T.black}22`; }}
                      onBlur={(e) => { e.currentTarget.style.background = T.surfLow; e.currentTarget.style.boxShadow = "none"; }}
                    />
                    {confirm && confirm !== password && (
                      <p style={{ fontSize: 12, color: T.error, margin: 0 }}>Passwords do not match</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 52, width: "100%", marginTop: 8, opacity: loading ? 0.7 : 1 }}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Update Password"}
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
