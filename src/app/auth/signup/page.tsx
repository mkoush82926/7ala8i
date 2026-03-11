"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scissors, Eye, EyeOff, Loader2, CheckCircle, Store, User, Briefcase, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type UserType = "shop_admin" | "customer" | "barber";

const roles: { id: UserType; icon: React.ReactNode; title: string; desc: string; color: string }[] = [
  {
    id: "shop_admin",
    icon: <Store size={24} />,
    title: "Shop Manager",
    desc: "I own or manage a barbershop",
    color: "var(--accent-mint)",
  },
  {
    id: "customer",
    icon: <User size={24} />,
    title: "Customer",
    desc: "I want to book appointments",
    color: "var(--accent-lavender)",
  },
  {
    id: "barber",
    icon: <Briefcase size={24} />,
    title: "Barber / Staff",
    desc: "I work at a barbershop",
    color: "var(--accent-blue)",
  },
];

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

  if (success) {
    return (
      <div className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="w-full relative z-10" style={{ maxWidth: 420 }}>
          <div className="glass-card-premium overflow-hidden text-center" style={{ padding: "44px 32px" }}>
            <div className="rounded-full bg-[var(--accent-mint)] flex items-center justify-center mx-auto shadow-md" style={{ width: 64, height: 64, marginBottom: 24 }}>
              <CheckCircle size={28} className="text-[#0A0A0A]" />
            </div>
            <h2 className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 22, marginBottom: 10, letterSpacing: "-0.02em" }}>
              Check your email
            </h2>
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              We&apos;ve sent a confirmation link to <strong className="text-[var(--text-primary)]">{email}</strong>. Click the link to activate your account.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-surface-hover)] transition-colors"
              style={{ height: 44, paddingLeft: 24, paddingRight: 24, fontSize: 14 }}
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-mint)]/40 transition-all outline-none";

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-mint)] opacity-[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-lavender)] opacity-[0.05] blur-[120px] pointer-events-none" />

      <div className="w-full relative z-10" style={{ maxWidth: 460 }}>
        <div className="glass-card-premium overflow-hidden" style={{ padding: "40px 32px" }}>
          <div className="text-center" style={{ marginBottom: 36 }}>
            <div
              className="rounded-2xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center mx-auto shadow-lg"
              style={{ width: 64, height: 64, marginBottom: 24 }}
            >
              <Scissors size={26} className="text-[#050507]" />
            </div>
            <h1 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 24, marginBottom: 10, letterSpacing: "-0.02em" }}>
              {step === "role" ? "Join Lumina" : "Create your account"}
            </h1>
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {step === "role" ? "How will you use Lumina?" : `Signing up as ${roles.find((r) => r.id === selectedRole)?.title}`}
            </p>
          </div>

          {step === "role" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => { setSelectedRole(role.id); setStep("form"); }}
                  className={cn(
                    "w-full rounded-xl border flex items-center text-start transition-all hover:border-[var(--border-hover)]",
                    "border-[var(--border-primary)] bg-[var(--bg-surface)]",
                  )}
                  style={{ padding: "20px 24px", gap: 16 }}
                >
                  <div
                    className="rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ width: 48, height: 48, background: `color-mix(in srgb, ${role.color} 15%, transparent)`, color: role.color }}
                  >
                    {role.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 15, marginBottom: 3 }}>
                      {role.title}
                    </p>
                    <p className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>
                      {role.desc}
                    </p>
                  </div>
                </button>
              ))}

              <p className="text-center text-[var(--text-tertiary)]" style={{ fontSize: 13, marginTop: 16 }}>
                Already have an account?{" "}
                <Link href="/auth/login" className="text-[var(--accent-mint)] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={() => setStep("role")}
                className="flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors font-medium"
                style={{ marginBottom: 24, fontSize: 13, gap: 8 }}
              >
                <ArrowLeft size={14} /> Change role
              </button>

              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label className="text-[var(--text-tertiary)] font-semibold block" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className={inputClass}
                    style={{ height: 48, paddingLeft: 16, paddingRight: 16, fontSize: 14 }}
                  />
                </div>

                {selectedRole === "shop_admin" && (
                  <div>
                    <label className="text-[var(--text-tertiary)] font-semibold block" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Barbershop Name
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. The Gentlemen's Den"
                      required
                      className={inputClass}
                      style={{ height: 48, paddingLeft: 16, paddingRight: 16, fontSize: 14 }}
                    />
                  </div>
                )}

                {selectedRole === "customer" && (
                  <div>
                    <label className="text-[var(--text-tertiary)] font-semibold block" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+962 7X XXX XXXX"
                      className={inputClass}
                      style={{ height: 48, paddingLeft: 16, paddingRight: 16, fontSize: 14 }}
                    />
                  </div>
                )}

                <div>
                  <label className="text-[var(--text-tertiary)] font-semibold block" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className={inputClass}
                    style={{ height: 48, paddingLeft: 16, paddingRight: 16, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label className="text-[var(--text-tertiary)] font-semibold block" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      minLength={6}
                      className={inputClass}
                      style={{ height: 48, paddingLeft: 16, paddingRight: 48, fontSize: 14 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-[var(--accent-rose-muted)] border border-[var(--accent-rose)]/20" style={{ padding: 12 }}>
                    <p className="text-[var(--accent-rose)] text-center" style={{ fontSize: 13 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl font-semibold flex items-center justify-center bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] hover:opacity-90 transition-all shadow-md disabled:opacity-60"
                  style={{ height: 52, fontSize: 15, gap: 10, marginTop: 12 }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
                </button>
              </form>

              <p className="text-center text-[var(--text-tertiary)]" style={{ fontSize: 13, marginTop: 28 }}>
                Already have an account?{" "}
                <Link href="/auth/login" className="text-[var(--accent-mint)] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
