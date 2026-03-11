"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Scissors, Loader2, CheckCircle, ArrowLeft, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  const inputClass = "w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-mint)]/40 transition-all outline-none";

  if (success) {
    return (
      <div className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="w-full relative z-10" style={{ maxWidth: 420 }}>
          <div className="glass-card-premium overflow-hidden text-center" style={{ padding: "48px 36px" }}>
            <div className="rounded-full bg-[var(--accent-mint)] flex items-center justify-center mx-auto shadow-md" style={{ width: 64, height: 64, marginBottom: 28 }}>
              <Mail size={28} className="text-[#0A0A0A]" />
            </div>
            <h2 className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 22, marginBottom: 12, letterSpacing: "-0.02em" }}>
              Check your email
            </h2>
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
              We&apos;ve sent a password reset link to <strong className="text-[var(--text-primary)]">{email}</strong>
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-surface-hover)] transition-colors"
              style={{ height: 44, paddingLeft: 24, paddingRight: 24, fontSize: 14 }}
            >
              <ArrowLeft size={15} /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-mint)] opacity-[0.05] blur-[120px] pointer-events-none" />

      <div className="w-full relative z-10" style={{ maxWidth: 420 }}>
        <div className="glass-card-premium overflow-hidden" style={{ padding: "44px 36px" }}>
          <div className="text-center" style={{ marginBottom: 36 }}>
            <div
              className="rounded-2xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center mx-auto shadow-lg"
              style={{ width: 64, height: 64, marginBottom: 28 }}
            >
              <Scissors size={26} className="text-[#050507]" />
            </div>
            <h1 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 24, marginBottom: 10, letterSpacing: "-0.02em" }}>
              Reset password
            </h1>
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Link"}
            </button>
          </form>

          <p className="text-center text-[var(--text-tertiary)]" style={{ fontSize: 13, marginTop: 32 }}>
            <Link href="/auth/login" className="text-[var(--accent-mint)] hover:underline font-medium flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
