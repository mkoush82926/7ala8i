"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

const FF = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";

const T = {
  dark:    "#191c1e",
  mid:     "#45464c",
  muted:   "#76777d",
  outline: "#e2e8f0",
  surfLow: "#f8fafc",
  white:   "#ffffff",
  black:   "#000000",
  error:   "#ba1a1a",
  errBg:   "#ffdad6",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

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
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF }}>
      {/* NavBar */}
      <nav className="auth-nav" style={{
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.outline}`,
      }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: T.dark }}>
            Halaqy
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            href="/auth/login"
            className="btn btn-secondary"
            style={{ borderRadius: 999, minHeight: 36, padding: "0 16px", fontSize: 12 }}
          >
            Back to Sign In
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
            background: T.white, borderRadius: 24,
            border: `1px solid ${T.outline}`,
          }}>
            {sent ? (
              /* ── Success State ── */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: "#d1fae5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 8,
                }}>
                  <CheckCircle size={28} style={{ color: "#059669" }} />
                </div>
                <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 700, color: T.dark, margin: 0 }}>
                  Check your email
                </h1>
                <p style={{ fontSize: 14, color: T.muted, maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
                  We sent a password reset link to <strong style={{ color: T.dark }}>{email}</strong>. 
                  Check your inbox and follow the instructions.
                </p>
                <div style={{ marginTop: 24, width: "100%" }}>
                  <Link
                    href="/auth/login"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", height: 52,
                      background: T.black, color: T.white,
                      borderRadius: 12, fontSize: 14, fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Sign In
                  </Link>
                </div>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                  Didn&apos;t receive the email?{" "}
                  <button
                    onClick={() => setSent(false)}
                    style={{ background: "none", border: "none", color: T.dark, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                  >
                    Try again
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
                  <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", color: T.dark, marginBottom: 10 }}>
                    Reset password
                  </h1>
                  <p style={{ fontSize: 14, color: T.muted, fontWeight: 300, letterSpacing: "0.01em", textAlign: "center" }}>
                    Enter your email address and we&apos;ll send you a reset link.
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
                      style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.muted }}
                    >
                      Email Address
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
                        borderRadius: 12, border: `1px solid ${T.outline}`,
                        background: T.surfLow, fontFamily: FF, fontSize: 14,
                        color: T.dark, outline: "none", transition: "all 0.15s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.background = T.white;
                        e.currentTarget.style.border = `1px solid ${T.black}`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${T.black}22`;
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
                        <span>Send Reset Link</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 32, textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: T.muted, opacity: 0.7 }}>
                    Remember your password?{" "}
                    <Link href="/auth/login" style={{ fontWeight: 700, color: T.dark, textDecoration: "none" }}>
                      Sign in
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
