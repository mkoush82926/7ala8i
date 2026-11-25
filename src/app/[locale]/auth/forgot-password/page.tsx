"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/hooks/use-translation";
import { buttonClasses } from "@/components/ui/recipes";
import { authErrorKey, isValidEmail, type AuthErrorKey } from "../auth-errors";
import {
  AuthAlert,
  AuthCard,
  AuthField,
  AuthFootnote,
  AuthHeader,
  AuthShell,
  SubmitButton,
} from "../_components/auth-shell";

const RESEND_COOLDOWN_SECONDS = 60;

function ForgotPasswordContent() {
  const { t, locale, href } = useTranslation();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const fieldError = touched
    ? !email.trim()
      ? t.auth.fieldRequired
      : !isValidEmail(email)
        ? t.auth.errors.invalidEmail
        : null
    : null;

  async function sendLink(address: string) {
    const supabase = createClient();
    return supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/${locale}/auth/reset-password`,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!email.trim() || !isValidEmail(email)) {
      emailRef.current?.focus();
      return;
    }
    setErrorKey(null);
    setLoading(true);
    try {
      const address = email.trim().toLowerCase();
      const { error } = await sendLink(address);
      // Only rate limits are surfaced; any other outcome shows the same
      // neutral confirmation so the form can't be used to probe accounts.
      if (error && authErrorKey(error) === "rateLimited") {
        setErrorKey("rateLimited");
        return;
      }
      setSentTo(address);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setErrorKey("generic");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!sentTo || cooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await sendLink(sentTo);
      if (error && authErrorKey(error) === "rateLimited") setErrorKey("rateLimited");
      else setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setErrorKey("generic");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = href("/auth/login");

  if (sentTo) {
    const [before, after = ""] = t.auth.resetSentBody.split("{email}");
    return (
      <AuthShell navLink={{ href: loginHref, label: t.auth.backToSignIn }}>
        <AuthCard>
          <AuthHeader
            icon={MailCheck}
            tone="success"
            align="center"
            title={t.auth.checkEmailTitle}
            subtitle={
              <>
                {before}
                <strong dir="ltr" className="break-all font-semibold text-ink">
                  {sentTo}
                </strong>
                {after}
              </>
            }
          />
          {errorKey && (
            <div className="mb-4">
              <AuthAlert>{t.auth.errors[errorKey]}</AuthAlert>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Link href={loginHref} className={buttonClasses({ variant: "primary", size: "xl", fullWidth: true })}>
              {t.auth.backToSignIn}
            </Link>
            <button
              type="button"
              className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              aria-busy={loading || undefined}
            >
              {loading
                ? t.auth.sending
                : cooldown > 0
                  ? t.auth.resendIn.replace("{seconds}", String(cooldown))
                  : t.auth.resendEmail}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setErrorKey(null);
              }}
              className={buttonClasses({ variant: "ghost", size: "md", fullWidth: true })}
            >
              {t.auth.useDifferentEmail}
            </button>
          </div>
          <p className="mt-4 text-center text-[13px] text-ink-muted">{t.auth.checkSpam}</p>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell navLink={{ href: loginHref, label: t.auth.backToSignIn }}>
      <AuthCard>
        <AuthHeader icon={KeyRound} title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle} />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <AuthField
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            label={t.auth.emailAddress}
            icon={Mail}
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            style={{ textAlign: "start" }}
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            error={fieldError}
          />

          {errorKey && <AuthAlert>{t.auth.errors[errorKey]}</AuthAlert>}

          <SubmitButton loading={loading} loadingLabel={t.auth.sending}>
            {t.auth.sendResetLink}
          </SubmitButton>
        </form>

        <AuthFootnote text={t.auth.rememberPassword} linkLabel={t.auth.signInBtn} linkHref={loginHref} />
      </AuthCard>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
