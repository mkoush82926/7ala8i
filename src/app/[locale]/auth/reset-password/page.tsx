"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Lock, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import { authErrorKey, MIN_PASSWORD_LENGTH, type AuthErrorKey } from "../auth-errors";
import { AuthAlert, AuthCard, AuthHeader, AuthShell, PasswordField, SubmitButton } from "../_components/auth-shell";

const REDIRECT_DELAY_MS = 3000;

function ResetPasswordContent() {
  const { t, href } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid">("checking");
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setLinkState("ready");
    });
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        setLinkState((s) => (s === "ready" || session ? "ready" : "invalid"));
      })
      .catch(() => active && setLinkState("invalid"));
    return () => {
      active = false;
      subscription.unsubscribe();
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const passwordError = touched.password
    ? !password
      ? t.auth.fieldRequired
      : password.length < MIN_PASSWORD_LENGTH
        ? t.auth.passwordRules
        : null
    : null;
  const confirmError = touched.confirm
    ? !confirm
      ? t.auth.fieldRequired
      : confirm !== password
        ? t.auth.passwordsDontMatch
        : null
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setErrorKey(null);
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      formRef.current?.querySelector<HTMLInputElement>("#password")?.focus();
      return;
    }
    if (confirm !== password) {
      formRef.current?.querySelector<HTMLInputElement>("#confirm")?.focus();
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorKey(authErrorKey(error));
        setLoading(false);
        return;
      }
      // End the recovery session so the user signs in with the new password.
      await supabase.auth.signOut().catch(() => undefined);
      setSuccess(true);
      setLoading(false);
      toast.success(t.auth.passwordUpdatedTitle);
      redirectTimer.current = setTimeout(() => router.push(href("/auth/login")), REDIRECT_DELAY_MS);
    } catch {
      setErrorKey("generic");
      setLoading(false);
    }
  }

  const loginHref = href("/auth/login");

  return (
    <AuthShell navLink={{ href: loginHref, label: t.auth.backToSignIn }}>
      <AuthCard>
        {linkState === "checking" ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}>
            <Loader2 size={24} className="animate-spin" aria-hidden="true" style={{ color: "var(--accent-mint)" }} />
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{t.auth.verifyingLink}</p>
          </div>
        ) : success ? (
          <>
            <AuthHeader
              icon={CheckCircle2}
              tone="success"
              align="center"
              title={t.auth.passwordUpdatedTitle}
              subtitle={t.auth.passwordUpdatedBody}
            />
            <Link href={loginHref} className="btn btn-primary" style={{ width: "100%", minHeight: 52 }}>
              {t.auth.goToSignIn}
            </Link>
          </>
        ) : linkState === "invalid" ? (
          <>
            <AuthHeader
              icon={XCircle}
              tone="error"
              align="center"
              title={t.auth.invalidLinkTitle}
              subtitle={t.auth.invalidLinkBody}
            />
            <Link href={href("/auth/forgot-password")} className="btn btn-primary" style={{ width: "100%", minHeight: 52 }}>
              {t.auth.requestNewLink}
            </Link>
          </>
        ) : (
          <>
            <AuthHeader icon={KeyRound} title={t.auth.newPasswordTitle} subtitle={t.auth.newPasswordSubtitle} />
            <form ref={formRef} onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Lets password managers attach the new password to the right account. */}
              <input type="text" name="username" autoComplete="username" hidden readOnly />
              <PasswordField
                id="password"
                name="password"
                label={t.auth.newPassword}
                icon={Lock}
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                showStrength
                hint={t.auth.passwordRules}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                error={passwordError}
              />
              <PasswordField
                id="confirm"
                name="confirm"
                label={t.auth.confirmPassword}
                icon={Lock}
                required
                autoComplete="new-password"
                placeholder={t.auth.confirmPasswordPlaceholder}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
                error={confirmError}
              />

              {errorKey && <AuthAlert>{t.auth.errors[errorKey]}</AuthAlert>}

              <SubmitButton loading={loading} loadingLabel={t.auth.updatingPassword} arrow={false} style={{ marginTop: 4 }}>
                {t.auth.updatePassword}
              </SubmitButton>
            </form>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
