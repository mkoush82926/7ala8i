"use client";

import React, { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Scissors, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center"><Loader2 className="animate-spin text-[var(--text-muted)]" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (next && next.startsWith("/")) {
      router.push(next);
    } else {
      const role = data.user?.user_metadata?.role;
      if (role === "customer") {
        router.push("/customer");
      } else {
        router.push("/");
      }
    }
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-mint)] opacity-[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-lavender)] opacity-[0.05] blur-[120px] pointer-events-none" />

      <div className="w-full relative z-10" style={{ maxWidth: 420 }}>
        <div className="glass-card-premium overflow-hidden" style={{ padding: "40px 32px" }}>
          <div className="text-center" style={{ marginBottom: 36 }}>
            <div
              className="rounded-2xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center mx-auto shadow-lg"
              style={{ width: 64, height: 64, marginBottom: 24 }}
            >
              <Scissors size={26} className="text-[#050507]" />
            </div>
            <h1 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 24, marginBottom: 10, letterSpacing: "-0.02em" }}>
              Welcome back
            </h1>
            <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Sign in to your dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-mint)]/40 transition-all outline-none"
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
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-mint)]/40 transition-all outline-none"
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

            <div className="flex justify-end" style={{ marginTop: -4 }}>
              <Link href="/auth/reset-password" className="text-[var(--text-muted)] hover:text-[var(--accent-mint)] text-[12px] font-medium transition-colors">
                Forgot password?
              </Link>
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
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[var(--text-tertiary)]" style={{ fontSize: 13, marginTop: 28 }}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-[var(--accent-mint)] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
