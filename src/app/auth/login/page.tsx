"use client";

import React, { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const FF = "'Inter', 'Manrope', system-ui, sans-serif";

const T = {
  dark:    "#191c1e",
  mid:     "#45464c",
  muted:   "#76777d",
  outline: "#e2e8f0",
  surfLow: "#f8fafc",
  surf:    "#f1f5f9",
  black:   "#000000",
  white:   "#ffffff",
  error:   "#ba1a1a",
  errBg:   "#ffdad6",
};

export default function LoginPage() {
  return (
    <div style={{ background: T.white, minHeight: "100dvh", fontFamily: FF }}>
      <Suspense
        fallback={
          <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: T.white }}>
            <Loader2 style={{ animation: "spin 1s linear infinite", color: T.muted }} />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (next && next.startsWith("/")) {
      router.push(next);
    } else {
      const role = data.user?.user_metadata?.role;
      router.push(role === "customer" ? "/customer" : "/");
    }
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: T.white, fontFamily: FF }}>

      {/* ── NavBar ── */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 48px", height: 80,
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.outline}`,
      }}>
        <Link href="/landing" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: T.dark }}>
            Halaqy
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", opacity: 0.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>language</span>
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", opacity: 0.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>light_mode</span>
          </button>
          <Link
            href="/auth/signup"
            style={{ fontFamily: FF, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: T.dark, textDecoration: "none", opacity: 0.7 }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48, background: T.white }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          style={{ width: "100%", maxWidth: 480 }}
        >
          {/* Card */}
          <div style={{
            background: T.white, borderRadius: 24,
            border: `1px solid ${T.outline}`,
            padding: "64px 64px",
            boxShadow: "0 32px 64px -16px rgba(0,0,0,0.06)",
          }}>
            {/* Brand anchor */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 56 }}>
              <div style={{
                width: 44, height: 44,
                background: T.black,
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 28,
              }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, color: T.white, fontVariationSettings: "'FILL' 1" }}
                >
                  diamond
                </span>
              </div>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", color: T.dark, marginBottom: 10 }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 14, color: T.muted, fontWeight: 300, letterSpacing: "0.01em" }}>
                Enter your details to access your studio.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                marginBottom: 24, padding: "12px 16px",
                borderRadius: 12, background: T.errBg,
                color: T.error, fontSize: 14, fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {/* Email */}
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

              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label
                    htmlFor="password"
                    style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.muted }}
                  >
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: T.muted, textDecoration: "none", opacity: 0.6 }}
                  >
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      height: 52, padding: "0 48px 0 18px",
                      borderRadius: 12, border: `1px solid ${T.outline}`,
                      background: T.surfLow, fontFamily: FF, fontSize: 14,
                      color: T.dark, outline: "none", width: "100%",
                      boxSizing: "border-box", transition: "all 0.15s",
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: T.muted, opacity: 0.5,
                      display: "flex", alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: T.black }}
                />
                <label htmlFor="remember" style={{ fontSize: 12, color: T.muted, cursor: "pointer" }}>
                  Keep me signed in
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  height: 52, background: T.black, color: T.white,
                  borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: FF, fontWeight: 600, fontSize: 14, letterSpacing: "0.02em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
                }}
              >
                {loading ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div style={{ marginTop: 40, textAlign: "center" }}>
              <p style={{ fontSize: 12, color: T.muted, opacity: 0.7 }}>
                New to Halaqy?{" "}
                <Link href="/auth/signup" style={{ fontWeight: 700, color: T.dark, textDecoration: "none" }}>
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ padding: "48px 48px", background: T.white, borderTop: `1px solid ${T.outline}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, maxWidth: 900, margin: "0 auto" }}>
          <div>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", color: T.dark }}>
              Halaqy
            </span>
            <p style={{ fontFamily: FF, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: T.muted, opacity: 0.6, marginTop: 16 }}>
              © 2026 Halaqy Digital.
            </p>
          </div>
          {[
            { title: "Product", links: ["Features", "Solutions"] },
            { title: "Company", links: ["About", "Legal"] },
            { title: "Connect", links: ["Help Center", "Contact"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, color: T.dark, marginBottom: 24, fontFamily: FF }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" style={{ fontFamily: FF, fontSize: 11, color: T.muted, textDecoration: "none", opacity: 0.7 }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
