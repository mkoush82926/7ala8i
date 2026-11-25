"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Mail, MailCheck, Phone, Store, User, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import { Pill } from "@/components/ui/pill";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import {
  authErrorKey,
  isValidEmail,
  isValidPhone,
  MIN_PASSWORD_LENGTH,
  type AuthErrorKey,
} from "../auth-errors";
import { isInviteNext, resolveNext, safeNextPath } from "../safe-next";
import {
  AuthAlert,
  AuthCard,
  AuthField,
  AuthFootnote,
  AuthHeader,
  AuthShell,
  PasswordField,
  SubmitButton,
  TermsNotice,
} from "../_components/auth-shell";

// Only these two roles can be chosen at signup. Barbers join a shop through
// an invite link (/join), which signs them up as a customer and then
// promotes them server-side in accept_invite.
type SignupRole = "shop_admin" | "customer";
type FieldName = "fullName" | "shopName" | "phone" | "email" | "password" | "confirmPassword";

const RESEND_COOLDOWN_SECONDS = 60;

function SignupContent() {
  const { t, locale, href } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "");
  const fromInvite = isInviteNext(next);

  // Landing "owner" CTAs link here with ?role=shop_admin: skip the chooser and
  // go straight to the shop-owner form. Invites always sign up as customers
  // first (the invite then assigns the staff role).
  const ownerPreset = !fromInvite && searchParams.get("role") === "shop_admin";
  const [step, setStep] = useState<"role" | "form">(fromInvite || ownerPreset ? "form" : "role");
  const [role, setRole] = useState<SignupRole>(ownerPreset ? "shop_admin" : "customer");
  const [values, setValues] = useState<Record<FieldName, string>>({
    fullName: "",
    shopName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Move focus to the new step's heading for keyboard/screen-reader users.
  useEffect(() => {
    if (step === "form" && !fromInvite) headingRef.current?.querySelector<HTMLElement>("h1 [tabindex]")?.focus();
  }, [step, fromInvite]);

  const destination = next || (role === "customer" ? "/customer" : "/");

  function validate(field: FieldName): string | null {
    const v = values[field];
    switch (field) {
      case "fullName":
        return v.trim().length < 2 ? (v.trim() ? t.auth.nameTooShort : t.auth.fieldRequired) : null;
      case "shopName":
        return role === "shop_admin" && !v.trim() ? t.auth.fieldRequired : null;
      case "phone":
        return v.trim() && !isValidPhone(v) ? t.auth.invalidPhone : null;
      case "email":
        return !v.trim() ? t.auth.fieldRequired : !isValidEmail(v) ? t.auth.errors.invalidEmail : null;
      case "password":
        return !v ? t.auth.fieldRequired : v.length < MIN_PASSWORD_LENGTH ? t.auth.passwordRules : null;
      case "confirmPassword":
        return !v ? t.auth.fieldRequired : v !== values.password ? t.auth.passwordsDontMatch : null;
    }
  }

  const fieldsInForm: FieldName[] = [
    "fullName",
    ...(role === "shop_admin" ? (["shopName"] as FieldName[]) : []),
    ...(role === "customer" ? (["phone"] as FieldName[]) : []),
    "email",
    "password",
    "confirmPassword",
  ];

  const errorFor = (field: FieldName) => (touched[field] ? validate(field) : null);

  const bind = (field: FieldName) => ({
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((s) => ({ ...s, [field]: e.target.value })),
    onBlur: () => setTouched((s) => ({ ...s, [field]: true })),
    error: errorFor(field),
  });

  function emailRedirectTo() {
    return `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(destination)}`;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setTouched(Object.fromEntries(fieldsInForm.map((f) => [f, true])));
    const firstInvalid = fieldsInForm.find((f) => validate(f));
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setLoading(true);
    const metadata: Record<string, string> = {
      full_name: values.fullName.trim(),
      // The DB trigger only honours "shop_admin"; anything else becomes a customer.
      role,
    };
    if (role === "shop_admin") metadata.shop_name = values.shopName.trim();
    // Contact number only — stored on the profile, never used to prove identity.
    if (role === "customer" && values.phone.trim()) metadata.phone = values.phone.trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: { data: metadata, emailRedirectTo: emailRedirectTo() },
      });

      if (error) {
        setErrorKey(authErrorKey(error));
        setLoading(false);
        return;
      }

      // Email confirmation disabled → we already have a session.
      if (data?.session) {
        router.replace(resolveNext(destination, locale));
        router.refresh();
        return;
      }

      setSentTo(values.email.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setLoading(false);
    } catch {
      setErrorKey("generic");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!sentTo || cooldown > 0) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: sentTo,
        options: { emailRedirectTo: emailRedirectTo() },
      });
      if (error) {
        toast.error(t.auth.errors[authErrorKey(error)]);
      } else {
        toast.success(t.auth.emailResent);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      toast.error(t.auth.errors.generic);
    } finally {
      setResending(false);
    }
  }

  const loginHref = href(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);

  // ── Success: check your email ──
  if (sentTo) {
    const [before, after = ""] = t.auth.checkEmailBody.split("{email}");
    return (
      <AuthShell navLink={{ href: loginHref, label: t.auth.signInBtn }}>
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
          {fromInvite && <AuthAlert tone="info">{t.auth.checkEmailInvite}</AuthAlert>}
          <div className="mt-5 flex flex-col gap-3">
            <a href={loginHref} className={buttonClasses({ variant: "primary", size: "xl", fullWidth: true })}>
              {t.auth.backToSignIn}
            </a>
            <button
              type="button"
              className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              aria-busy={resending || undefined}
            >
              {resending
                ? t.auth.resending
                : cooldown > 0
                  ? t.auth.resendIn.replace("{seconds}", String(cooldown))
                  : t.auth.resendEmail}
            </button>
          </div>
          <p className="mt-4 text-center text-[13px] text-ink-muted">{t.auth.checkSpam}</p>
        </AuthCard>
      </AuthShell>
    );
  }

  // ── Step 1: choose how you'll use Halaqy ──
  if (step === "role") {
    const roleCards: { id: SignupRole; icon: LucideIcon; title: string; desc: string }[] = [
      { id: "customer", icon: User, title: t.auth.roleCustomerTitle, desc: t.auth.roleCustomerDesc },
      { id: "shop_admin", icon: Store, title: t.auth.roleOwnerTitle, desc: t.auth.roleOwnerDesc },
    ];
    return (
      <AuthShell navLink={{ href: loginHref, label: t.auth.signInBtn }} width="md">
        <div className="mb-8 text-start">
          <h1 className="text-h1 mb-2 text-ink">{t.auth.howWillYouUse}</h1>
          <p className="text-body m-0 text-ink-muted">{t.auth.chooseRoleSubtitle}</p>
        </div>

        <ul role="list" className="m-0 grid list-none gap-3 p-0">
          {roleCards.map(({ id, icon: Icon, title, desc }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  setRole(id);
                  setStep("form");
                }}
                aria-describedby={`role-${id}-desc`}
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-line bg-card p-5 text-start text-ink shadow-xs",
                  "transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-ink-soft hover:shadow-raised active:scale-[0.99]",
                  "motion-reduce:transition-none motion-reduce:active:scale-100",
                  focusRing,
                )}
              >
                <span
                  aria-hidden="true"
                  className="bg-hatch-ink grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text"
                >
                  <Icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-title mb-1 block">{title}</span>
                  <span id={`role-${id}-desc`} className="block text-sm leading-[22px] text-ink-muted">
                    {desc}
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
                />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-5 flex items-start gap-2 rounded-xl bg-sunken p-4 text-[13px] leading-5 text-ink-soft">
          <Users size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
          <span>{t.auth.barberViaInvite}</span>
        </p>
        <AuthFootnote text={t.auth.haveAccount} linkLabel={t.auth.signInBtn} linkHref={loginHref} />
      </AuthShell>
    );
  }

  // ── Step 2: account details ──
  return (
    <AuthShell navLink={{ href: loginHref, label: t.auth.signInBtn }}>
      <AuthCard>
        {!fromInvite && (
          <button
            type="button"
            onClick={() => {
              setStep("role");
              setErrorKey(null);
            }}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "-ms-3 mb-4" })}
          >
            <ArrowLeft size={16} aria-hidden="true" className="rtl:-scale-x-100" />
            {t.common.back}
          </button>
        )}

        <div ref={headingRef}>
          {!fromInvite && (
            <Pill
              tone="brand"
              size="md"
              className="mb-4"
              icon={role === "shop_admin" ? <Store aria-hidden="true" /> : <User aria-hidden="true" />}
            >
              {role === "shop_admin" ? t.auth.roleOwnerTitle : t.auth.roleCustomerTitle}
            </Pill>
          )}
          <AuthHeader
            title={<span tabIndex={-1} className="outline-none">{t.auth.createYourAccount}</span>}
            subtitle={fromInvite ? t.auth.inviteSignUpNotice : t.auth.joinHalaqy}
          />
        </div>

        {fromInvite && (
          <div className="mb-5">
            <AuthAlert tone="info">
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden="true" />
                {t.auth.inviteBanner}
              </span>
            </AuthAlert>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSignup} noValidate className="flex flex-col gap-5">
          <AuthField
            id="fullName"
            label={t.auth.fullName}
            icon={User}
            type="text"
            required
            autoComplete="name"
            maxLength={100}
            {...bind("fullName")}
          />

          {role === "shop_admin" && (
            <AuthField
              id="shopName"
              label={t.auth.shopName}
              icon={Store}
              type="text"
              required
              autoComplete="organization"
              maxLength={100}
              {...bind("shopName")}
            />
          )}

          {role === "customer" && (
            <AuthField
              id="phone"
              label={
                <>
                  {t.booking.phoneNumber}{" "}
                  <span className="font-normal text-ink-muted">({t.common.optional})</span>
                </>
              }
              icon={Phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              style={{ textAlign: "start" }}
              placeholder="+962 7X XXX XXXX"
              maxLength={20}
              hint={t.auth.phoneHint}
              {...bind("phone")}
            />
          )}

          <AuthField
            id="email"
            label={t.auth.emailAddress}
            icon={Mail}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            style={{ textAlign: "start" }}
            placeholder="name@example.com"
            {...bind("email")}
          />

          <PasswordField
            id="password"
            label={t.auth.password}
            icon={Lock}
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            showStrength
            hint={t.auth.passwordRules}
            {...bind("password")}
          />

          <PasswordField
            id="confirmPassword"
            label={t.auth.confirmPassword}
            icon={Lock}
            required
            autoComplete="new-password"
            placeholder={t.auth.confirmPasswordPlaceholder}
            {...bind("confirmPassword")}
          />

          {errorKey && <AuthAlert>{t.auth.errors[errorKey]}</AuthAlert>}

          <SubmitButton loading={loading} loadingLabel={t.auth.signingUp} className="mt-1">
            {t.auth.createAccount}
          </SubmitButton>
        </form>

        <AuthFootnote text={t.auth.haveAccount} linkLabel={t.auth.signInBtn} linkHref={loginHref} />
      </AuthCard>

      <TermsNotice template={t.auth.signUpTerms} />
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
