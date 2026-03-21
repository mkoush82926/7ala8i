"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

type UserType = "shop_admin" | "customer" | "barber";

const roles: { id: UserType; icon: string; title: string; desc: string }[] = [
  {
    id: "shop_admin",
    icon: "storefront",
    title: "Shop Manager",
    desc: "Directing operations, managing staff, and scaling your business.",
  },
  {
    id: "customer",
    icon: "person",
    title: "Customer",
    desc: "Booking appointments and curating your personal grooming journey.",
  },
  {
    id: "barber",
    icon: "content_cut",
    title: "Professional",
    desc: "Managing your individual schedule, clients, and creative portfolio.",
  },
];

const inputStyle = (isFocused = false): React.CSSProperties => ({
  width: "100%",
  height: 56,
  padding: "0 20px",
  borderRadius: 12,
  border: isFocused ? "1px solid #000" : "1px solid #f1f5f9",
  background: isFocused ? "#ffffff" : "#f8fafc",
  color: "#0f172a",
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  transition: "all 0.2s ease",
  boxShadow: isFocused ? "0 0 0 1px #000000" : "none",
});

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={inputStyle(focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

export default function SignupPage() {
  const [step, setStep] = useState<"role" | "form">("role");
  const [selectedRole, setSelectedRole] = useState<UserType>("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const metadata: Record<string, string> = {
      full_name: fullName,
      role: selectedRole,
    };

    if (selectedRole === "shop_admin" && shopName) {
      metadata.shop_name = shopName;
    }
    if (phone) {
      metadata.phone = phone;
    }

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  const navBar = (
    <nav className="auth-nav"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <Link href="/landing" style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", fontFamily: "'Manrope', sans-serif", textDecoration: "none" }}>
        Halaqy
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>language</span>
        </button>
        <Link href="/auth/login" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0f172a", textDecoration: "none" }}>
          Sign In
        </Link>
      </div>
    </nav>
  );

  if (success) {
    return (
      <div style={{ minHeight: "100dvh", background: "#ffffff", display: "flex", flexDirection: "column" }}>
        {navBar}
        <div className="auth-main">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ maxWidth: 480, width: "100%", textAlign: "center" }}
          >
            <div className="auth-card" style={{
              background: "#ffffff", borderRadius: 24, border: "1px solid #f1f5f9",
            }}>
              <div style={{ width: 56, height: 56, background: "#000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#fff", fontVariationSettings: "'FILL' 1" }}>check</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#000", marginBottom: 12, fontFamily: "'Manrope', sans-serif" }}>
                Check your email
              </h2>
              <p style={{ color: "#64748b", fontSize: 14, fontWeight: 300, lineHeight: 1.7, marginBottom: 40 }}>
                We&apos;ve sent a confirmation link to <strong style={{ color: "#000" }}>{email}</strong>. Click the link to activate your account.
              </p>
              <Link href="/auth/login" style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 52, padding: "0 32px", background: "#000", color: "#fff",
                borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: "100dvh", background: "#ffffff", color: "#000000", fontFamily: "'Manrope', 'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
      {navBar}

      {/* Step 1 — Role Selection */}
      {step === "role" && (
        <main className="auth-main">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            style={{ textAlign: "center", marginBottom: 72, maxWidth: 640 }}
          >
            <h1 style={{ fontSize: 48, fontWeight: 300, fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.03em", color: "#000000", marginBottom: 20 }}>
              How will you use Halaqy?
            </h1>
            <p style={{ color: "#666666", fontSize: 18, fontWeight: 300, maxWidth: 400, margin: "0 auto" }}>
              Select the role that best describes your daily operations and goals.
            </p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, width: "100%", maxWidth: 960 }}>
            {roles.map((role, i) => (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 1, 0.5, 1] }}
                onClick={() => { setSelectedRole(role.id); setStep("form"); }}
                style={{
                  display: "flex", flexDirection: "column", padding: 48,
                  border: "1px solid #e5e5e5", borderRadius: 16, textAlign: "left",
                  background: "#ffffff", cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#000"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ marginBottom: 56 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 30, color: "#aaaaaa" }}>{role.icon}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: "#000000", marginBottom: 12 }}>{role.title}</h3>
                  <p style={{ fontSize: 14, color: "#666666", fontWeight: 300, lineHeight: 1.7 }}>{role.desc}</p>
                </div>
                <div style={{ marginTop: 40, display: "flex", alignItems: "center", color: "#000000", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em" }}>
                  Select{" "}
                  <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 8 }}>arrow_forward</span>
                </div>
              </motion.button>
            ))}
          </div>

          <div style={{ marginTop: 64, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#666666", fontWeight: 300 }}>
              Already have an account?{" "}
              <Link href="/auth/login" style={{ color: "#000000", fontWeight: 600, marginLeft: 4, textDecoration: "none", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                Sign in
              </Link>
            </p>
          </div>
        </main>
      )}

      {/* Step 2 — Account Details */}
      {step === "form" && (
        <main className="auth-main">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            style={{ width: "100%", maxWidth: 520 }}
          >
            <button
              onClick={() => setStep("role")}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#666666", fontSize: 13, fontWeight: 600, marginBottom: 40, padding: 0 }}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "#f5f5f5", marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#666" }}>
                  {roles.find((r) => r.id === selectedRole)?.icon}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666" }}>
                  {roles.find((r) => r.id === selectedRole)?.title}
                </span>
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.03em", color: "#000000", marginBottom: 10 }}>
                Create your account
              </h1>
              <p style={{ color: "#666666", fontSize: 15, fontWeight: 300 }}>Start managing your barbershop with Halaqy</p>
            </div>

            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 22 }}>

              {/* Full Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.8)" }}>
                  Full Name
                </label>
                <StyledInput type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
              </div>

              {/* Shop Name (admin only) */}
              {selectedRole === "shop_admin" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.8)" }}>
                    Barbershop Name
                  </label>
                  <StyledInput type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. The Gentlemen's Den" required />
                </div>
              )}

              {/* Phone (customer only) */}
              {selectedRole === "customer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.8)" }}>
                    Phone Number
                  </label>
                  <StyledInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+962 7X XXX XXXX" />
                </div>
              )}

              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.8)" }}>
                  Email Address
                </label>
                <StyledInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" required />
              </div>

              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.8)" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <StyledInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    style={{ ...inputStyle(), paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.4)", display: "flex", alignItems: "center" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, color: "#dc2626", fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 8, width: "100%", height: 56, background: loading ? "#555" : "#000000",
                  color: "#ffffff", border: "none", borderRadius: 12, fontFamily: "'Manrope', sans-serif",
                  fontWeight: 700, fontSize: 14, letterSpacing: "0.04em",
                  cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    <span>Create Account</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: 32, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "rgba(100,116,139,0.6)" }}>
                Already have an account?{" "}
                <Link href="/auth/login" style={{ color: "#000000", fontWeight: 700, marginLeft: 4, textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      )}

      <footer className="auth-footer" style={{ borderTop: "1px solid #f8fafc" }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(100,116,139,0.4)" }}>
          © 2026 Halaqy Digital.
        </p>
      </footer>
    </div>
  );
}
