"use client";

// WS-1J · Phone-first sign-in for clients. One screen, two steps:
//   1. phone (+ optional name, terms) → a 6-digit code by SMS/WhatsApp
//   2. code → signed in; earlier guest bookings with that number attach.
// Works in both OTP modes from 1D; with the flag off it points to email login.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Mail, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  buttonClasses,
  checkboxClasses,
  errorTextClasses,
  fieldIconClasses,
  focusRing,
  helperClasses,
  inputClasses,
  labelClasses,
  textLinkClasses,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/app/[locale]/auth/_components/auth-shell";
import { TurnstileWidget } from "@/components/booking/turnstile-widget";
import type { PublicBookingSecurity } from "@/lib/otp/config";
import { maskForDisplay, toJordanMobile } from "@/lib/otp/phone";
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
  const { t, isRTL, href, locale } = useTranslation();
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
  const e164 = useMemo(() => toJordanMobile(phone), [phone]);
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

  const channelIsWhatsapp = security.otpChannel === "whatsapp";

  return (
    <AuthShell navLink={{ href: href("/explore"), label: l.browseShops }}>
      <span
        aria-hidden="true"
        className="bg-hatch-ink mb-5 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-text"
      >
        {step === "code" ? <ShieldCheck size={26} /> : <Smartphone size={26} />}
      </span>
      <h1 className="text-h1 m-0 mb-2 text-ink">{step === "code" ? l.codeTitle : l.title}</h1>
      <p className="text-body m-0 mb-8 text-ink-muted">
        {step === "code"
          ? interpolate(channelIsWhatsapp ? l.codeSubtitleWhatsapp : l.codeSubtitleSms, {
              phone: maskForDisplay(e164 ?? phone),
            })
          : l.subtitle}
      </p>

      {!enabled ? (
        <div className="rounded-xl border border-line bg-sunken p-5">
          <p className="m-0 mb-4 text-sm leading-[22px] text-ink-soft">{l.unavailable}</p>
          <Link href={emailLogin} className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true })}>
            <Mail aria-hidden="true" />
            {l.useEmail}
          </Link>
        </div>
      ) : step === "phone" ? (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-5" aria-describedby={error ? ids.err : undefined}>
          <div>
            <label htmlFor={ids.phone} className={labelClasses}>
              {l.phoneLabel}
            </label>
            <div className="relative">
              <span className={fieldIconClasses}>
                <Smartphone aria-hidden="true" />
              </span>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className={inputClasses({ withIcon: true, className: "text-start tabular-nums" })}
                placeholder="07X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                aria-invalid={!!phone && !e164}
                aria-describedby={`${ids.phone}-hint`}
                required
                autoFocus
              />
            </div>
            <p id={`${ids.phone}-hint`} className={cn(helperClasses, "m-0")}>
              {l.phoneHint}
            </p>
          </div>
          <div>
            <label htmlFor={ids.name} className={labelClasses}>
              {l.nameLabel}
            </label>
            <input
              id={ids.name}
              type="text"
              autoComplete="name"
              className={inputClasses()}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              maxLength={80}
              aria-describedby={`${ids.name}-hint`}
            />
            <p id={`${ids.name}-hint`} className={cn(helperClasses, "m-0")}>
              {l.nameHint}
            </p>
          </div>
          <label htmlFor={ids.terms} className="flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-ink-soft">
            <input
              id={ids.terms}
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              className={cn(checkboxClasses, "mt-0.5 shrink-0 accent-[var(--color-brand)]")}
            />
            <span>
              {l.termsPrefix}{" "}
              <Link href={href("/terms")} className={cn("rounded-sm", textLinkClasses, focusRing)}>
                {t.landing.terms}
              </Link>{" "}
              {l.termsAnd}{" "}
              <Link href={href("/privacy")} className={cn("rounded-sm", textLinkClasses, focusRing)}>
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
            <p id={ids.err} className={cn(errorTextClasses, "m-0")} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <Button
            type="submit"
            size="xl"
            fullWidth
            loading={busy}
            icon={channelIsWhatsapp ? <MessageCircle aria-hidden="true" /> : undefined}
          >
            {channelIsWhatsapp ? l.sendWhatsapp : l.sendSms}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate className="flex flex-col gap-5" aria-describedby={error ? ids.err : undefined}>
          <div>
            <label htmlFor={ids.code} className={labelClasses}>
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
              placeholder="••••••"
              className={inputClasses({
                className: "h-14 text-center text-2xl font-bold tracking-[0.5em] tabular-nums placeholder:tracking-[0.5em] sm:text-2xl",
              })}
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
            <p id={ids.err} className={cn(errorTextClasses, "m-0")} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <Button type="submit" size="xl" fullWidth loading={busy} disabled={code.length !== 6 || step !== "code"}>
            {l.verify}
          </Button>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className={buttonClasses({ variant: "ghost", size: "sm", className: "-ms-3.5" })}
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              disabled={busy}
            >
              <BackIcon aria-hidden="true" />
              {l.changeNumber}
            </button>
            <button
              type="button"
              className={buttonClasses({ variant: "ghost", size: "sm", className: "-me-3.5 tabular-nums text-brand-text" })}
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
        <p className="m-0 mt-8 border-t border-line pt-6 text-center text-sm text-ink-muted">
          {l.preferEmail}{" "}
          <Link href={emailLogin} className={cn("rounded-sm", textLinkClasses, focusRing)}>
            {l.useEmail}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
