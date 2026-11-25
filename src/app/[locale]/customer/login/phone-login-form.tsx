"use client";

// WS-1J · Phone-first sign-in for clients. One screen, two steps:
//   1. phone (+ optional name, terms) → a 6-digit code by SMS/WhatsApp
//   2. code → signed in; earlier guest bookings with that number attach.
// Works in both OTP modes from 1D; with the flag off it points to email login.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mail, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { TurnstileWidget } from "@/components/booking/turnstile-widget";
import type { PublicBookingSecurity } from "@/lib/otp/config";
import { maskForDisplay, toE164Digits } from "@/lib/otp/phone";
import {
  normalizeFullName,
  normalizeOtpCode,
  phoneLoginEnabled,
  safeCustomerNext,
  toPhoneLoginError,
  type PhoneLoginErrorCode,
  type PhoneLoginStep,
} from "@/lib/privacy/login";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy/account";
import { phoneLoginAction } from "./actions";

const RESEND_AFTER_SEC = 60;
const NEW_ACCOUNT_WINDOW_MS = 10 * 60_000;

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export function PhoneLoginForm({ security, next }: { security: PublicBookingSecurity; next: string | null }) {
  const router = useRouter();
  const { t, dir, isRTL, FF, FFD, href, locale } = useTranslation();
  const l = t.customerLogin;
  const [supabase] = useState(() => createClient());
  const ids = { phone: useId(), name: useId(), code: useId(), terms: useId(), err: useId() };

  const [step, setStep] = useState<PhoneLoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement | null>(null);

  const enabled = phoneLoginEnabled(security.otpMode);
  const e164 = useMemo(() => toE164Digits(phone), [phone]);
  const wait = sentAt ? Math.max(0, RESEND_AFTER_SEC - Math.floor((now - sentAt) / 1000)) : 0;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const emailLogin = href(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);

  // Already signed in → straight to the portal.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) router.replace(safeCustomerNext(next, locale));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supabase, router, next, locale]);

  useEffect(() => {
    if (!sentAt || wait <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sentAt, wait]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const messageFor = (code: PhoneLoginErrorCode): string => {
    const map: Record<PhoneLoginErrorCode, string> = {
      INVALID_PHONE: l.errorPhone,
      INVALID_NAME: l.errorName,
      TERMS_REQUIRED: l.errorTerms,
      OTP_INVALID: t.bookingFlow.otpInvalid,
      OTP_EXPIRED: t.bookingFlow.otpExpired,
      OTP_TOO_MANY_ATTEMPTS: t.bookingFlow.otpTooMany,
      OTP_UNAVAILABLE: l.errorUnavailable,
      OTP_SEND_FAILED: t.bookingFlow.otpSendFailed,
      CAPTCHA_FAILED: t.bookingFlow.captchaFailed,
      RATE_LIMITED: t.bookingFlow.otpRateLimited,
      NOT_CUSTOMER: l.errorStaff,
      LOGIN_FAILED: l.errorGeneric,
    };
    return map[code];
  };

  const fail = (code: unknown) => {
    const msg = messageFor(toPhoneLoginError(code));
    setError(msg);
    toast.error(msg);
  };

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (!e164) return fail("INVALID_PHONE");
    if (name.trim() && !normalizeFullName(name)) return fail("INVALID_NAME");
    if (!accept) return fail("TERMS_REQUIRED");
    if (security.turnstileSiteKey && !captcha) return fail("CAPTCHA_FAILED");

    setBusy(true);
    try {
      if (security.otpMode === "supabase") {
        const { error: err } = await supabase.auth.signInWithOtp({
          phone: `+${e164}`,
          options: {
            channel: security.otpChannel,
            captchaToken: captcha ?? undefined,
            data: { role: "customer", full_name: normalizeFullName(name) ?? undefined, locale },
          },
        });
        if (err) {
          const status = (err as { status?: number }).status;
          throw Object.assign(new Error("send"), { code: status === 429 ? "RATE_LIMITED" : "OTP_SEND_FAILED" });
        }
      } else {
        const res = await fetch("/api/booking/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: e164, locale, captchaToken: captcha ?? undefined }),
        });
        const json = (await res.json().catch(() => null)) as { success?: boolean; code?: string } | null;
        if (!res.ok || !json?.success) throw Object.assign(new Error("send"), { code: json?.code ?? "OTP_SEND_FAILED" });
      }
      setSentAt(Date.now());
      setNow(Date.now());
      setCode("");
      setStep("code");
      toast.success(interpolate(t.bookingFlow.otpSent, { phone: maskForDisplay(e164) }));
    } catch (err) {
      fail((err as { code?: string }).code);
      // A Turnstile token is single-use: get a fresh one.
      setCaptcha(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  async function afterSupabaseSignIn(): Promise<string> {
    const db = supabase as unknown as Db;
    await db.rpc("claim_customer_identity").then(undefined, () => undefined);
    const { data } = await supabase.auth.getUser();
    const created = data.user?.created_at ? new Date(data.user.created_at).getTime() : 0;
    const isNew = created > 0 && Date.now() - created < NEW_ACCOUNT_WINDOW_MS;
    if (isNew) {
      await Promise.allSettled([
        db.rpc("record_consent", { p_purpose: "terms", p_granted: true, p_source: "phone_login", p_policy_version: PRIVACY_POLICY_VERSION }),
        db.rpc("record_consent", { p_purpose: "privacy", p_granted: true, p_source: "phone_login", p_policy_version: PRIVACY_POLICY_VERSION }),
      ]);
      return `/${locale}/customer/account?welcome=1`;
    }
    return safeCustomerNext(next, locale);
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    const value = normalizeOtpCode(code);
    if (busy || !e164) return;
    if (value.length !== 6) return fail("OTP_INVALID");
    setBusy(true);
    setError(null);
    try {
      let destination: string;
      if (security.otpMode === "supabase") {
        const { error: err } = await supabase.auth.verifyOtp({ phone: `+${e164}`, token: value, type: "sms" });
        if (err) throw Object.assign(new Error("verify"), { code: "OTP_INVALID" });
        destination = await afterSupabaseSignIn();
      } else {
        const res = await fetch("/api/booking/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: e164, code: value }),
        });
        const json = (await res.json().catch(() => null)) as { success?: boolean; token?: string; code?: string } | null;
        if (!res.ok || !json?.success || !json.token) throw Object.assign(new Error("verify"), { code: json?.code ?? "OTP_INVALID" });
        const result = await phoneLoginAction({
          phone: e164,
          token: json.token,
          fullName: normalizeFullName(name),
          acceptTerms: accept,
          next,
          locale,
        });
        if (!result.ok) throw Object.assign(new Error("login"), { code: result.code });
        destination = result.redirectTo;
        if (result.linked > 0) toast.success(interpolate(l.linkedBookings, { count: result.linked }));
      }
      setStep("done");
      toast.success(l.signedIn);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      fail((err as { code?: string }).code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} style={{ fontFamily: FF }} className="flex min-h-dvh flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>
      <header className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4 sm:px-6">
        <Link href={href("/landing")} dir="ltr" className="rounded-sm text-[18px] font-black text-[var(--text-primary)]" style={{ fontFamily: FFD }}>
          Halaqy<span className="text-[var(--accent-brass)]">.</span>
        </Link>
        <Link href={href("/explore")} className="btn btn-ghost text-[13px]" style={{ minHeight: 40 }}>
          <BackIcon size={16} aria-hidden="true" />
          {l.browseShops}
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-[400px]">
          <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--accent-brass)]">
            {step === "code" ? <ShieldCheck size={22} /> : <Smartphone size={22} />}
          </span>
          <h1 className="m-0 mb-2 text-[26px] font-black leading-tight" style={{ fontFamily: FFD }}>
            {step === "code" ? l.codeTitle : l.title}
          </h1>
          <p className="m-0 mb-7 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {step === "code"
              ? interpolate(security.otpChannel === "whatsapp" ? l.codeSubtitleWhatsapp : l.codeSubtitleSms, {
                  phone: maskForDisplay(e164 ?? phone),
                })
              : l.subtitle}
          </p>

          {!enabled ? (
            <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="m-0 mb-4 text-[14px] text-[var(--text-secondary)]">{l.unavailable}</p>
              <Link href={emailLogin} className="btn btn-primary w-full" style={{ minHeight: 44 }}>
                <Mail size={16} aria-hidden="true" />
                {l.useEmail}
              </Link>
            </div>
          ) : step === "phone" ? (
            <form onSubmit={sendCode} noValidate className="flex flex-col gap-4" aria-describedby={error ? ids.err : undefined}>
              <div>
                <label htmlFor={ids.phone} className="field-label">
                  {l.phoneLabel}
                </label>
                <input
                  id={ids.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className="field-input w-full text-start"
                  placeholder="07X XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                  aria-invalid={!!phone && !e164}
                  required
                  autoFocus
                />
                <p className="m-0 mt-1.5 text-xs text-[var(--text-muted)]">{l.phoneHint}</p>
              </div>
              <div>
                <label htmlFor={ids.name} className="field-label">
                  {l.nameLabel}
                </label>
                <input
                  id={ids.name}
                  type="text"
                  autoComplete="name"
                  className="field-input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 80))}
                  maxLength={80}
                />
                <p className="m-0 mt-1.5 text-xs text-[var(--text-muted)]">{l.nameHint}</p>
              </div>
              <label htmlFor={ids.terms} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                <input
                  id={ids.terms}
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-brass)]"
                />
                <span>
                  {l.termsPrefix}{" "}
                  <Link href={href("/terms")} className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                    {t.landing.terms}
                  </Link>{" "}
                  {l.termsAnd}{" "}
                  <Link href={href("/privacy")} className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                    {t.landing.privacy}
                  </Link>
                </span>
              </label>
              {security.turnstileSiteKey && (
                <TurnstileWidget
                  key={captchaKey}
                  siteKey={security.turnstileSiteKey}
                  locale={locale}
                  onToken={setCaptcha}
                  label={t.bookingFlow.securityCheck}
                />
              )}
              {error && (
                <p id={ids.err} className="field-error m-0" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary w-full" style={{ minHeight: 48 }} disabled={busy} aria-busy={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : security.otpChannel === "whatsapp" ? <MessageCircle size={16} aria-hidden="true" /> : null}
                {security.otpChannel === "whatsapp" ? l.sendWhatsapp : l.sendSms}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} noValidate className="flex flex-col gap-4" aria-describedby={error ? ids.err : undefined}>
              <div>
                <label htmlFor={ids.code} className="field-label">
                  {l.codeLabel}
                </label>
                <input
                  ref={codeRef}
                  id={ids.code}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={12}
                  className="field-input w-full text-center text-[22px] font-bold tracking-[0.4em] tabular-nums"
                  value={code}
                  onChange={(e) => {
                    const v = normalizeOtpCode(e.target.value);
                    setCode(v);
                    setError(null);
                  }}
                  aria-invalid={!!error}
                  required
                />
              </div>
              {error && (
                <p id={ids.err} className="field-error m-0" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ minHeight: 48 }}
                disabled={busy || code.length !== 6 || step !== "code"}
                aria-busy={busy}
              >
                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {l.verify}
              </button>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <button
                  type="button"
                  className="rounded-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    setStep("phone");
                    setError(null);
                  }}
                  disabled={busy}
                >
                  {l.changeNumber}
                </button>
                <button
                  type="button"
                  className="rounded-sm font-semibold text-[var(--text-primary)] disabled:text-[var(--text-muted)]"
                  onClick={() => sendCode()}
                  disabled={busy || wait > 0}
                  aria-live="polite"
                >
                  {wait > 0 ? interpolate(l.resendIn, { seconds: wait }) : l.resend}
                </button>
              </div>
            </form>
          )}

          {enabled && (
            <p className="m-0 mt-8 border-t border-[var(--border-subtle)] pt-5 text-center text-[13px] text-[var(--text-secondary)]">
              {l.preferEmail}{" "}
              <Link href={emailLogin} className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                {l.useEmail}
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
