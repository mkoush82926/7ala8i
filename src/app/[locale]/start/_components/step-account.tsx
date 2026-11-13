"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, MailCheck, Phone, User } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import {
  AuthAlert,
  AuthField,
  PasswordField,
  SubmitButton,
  TermsNotice,
} from "../../auth/_components/auth-shell";
import { MIN_PASSWORD_LENGTH, isValidEmail } from "../../auth/auth-errors";
import { signUpOwner, verifyOwnerOtp, type OwnerSignupError } from "../actions";
import { normalizePhone } from "../_lib/wizard";
import { StepHeader, TextField } from "./ui";

type Field = "phone" | "fullName" | "email" | "password";

export function StepAccount({ phoneAuth }: { phoneAuth: boolean }) {
  const { t, locale, href } = useTranslation();
  const s = t.start;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<Field, string>>({ phone: "", fullName: "", email: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [error, setError] = useState<OwnerSignupError | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [pending, startTransition] = useTransition();

  const fields: Field[] = phoneAuth ? ["phone", "fullName", "password"] : ["phone", "fullName", "email", "password"];

  function validate(f: Field): string | null {
    const v = values[f];
    switch (f) {
      case "phone":
        return !v.trim() ? s.errors.phoneRequired : !normalizePhone(v) ? s.errors.phoneInvalid : null;
      case "fullName":
        return v.trim().length < 2 ? t.auth.nameTooShort : null;
      case "email":
        return !v.trim() ? t.auth.fieldRequired : !isValidEmail(v) ? t.auth.errors.invalidEmail : null;
      case "password":
        return !v ? t.auth.fieldRequired : v.length < MIN_PASSWORD_LENGTH ? t.auth.passwordRules : null;
    }
  }

  const bind = (f: Field) => ({
    name: f,
    value: values[f],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((x) => ({ ...x, [f]: e.target.value })),
    onBlur: () => setTouched((x) => ({ ...x, [f]: true })),
    error: touched[f] ? validate(f) : null,
  });

  function errorText(code: OwnerSignupError): string {
    if (code === "invalidPhone") return s.errors.phoneInvalid;
    if (code === "nameTooShort") return t.auth.nameTooShort;
    if (code === "invalidOtp") return s.account.otpInvalid;
    return t.auth.errors[code];
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    const bad = fields.find((f) => validate(f));
    if (bad) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${bad}"]`)?.focus();
      return;
    }
    const fd = new FormData();
    fd.set("phone", values.phone);
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        const res = await signUpOwner(fd);
        if (res.error) return setError(res.error);
        if (res.checkEmail) return setCheckEmail(res.checkEmail);
        if (res.otpSentTo) return setOtpPhone(res.otpSentTo);
        toast.success(s.account.created);
        router.refresh();
      } catch {
        setError("generic");
      }
    });
  }

  function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpPhone) return;
    setError(null);
    const fd = new FormData();
    fd.set("phone", otpPhone);
    fd.set("token", otp);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        const res = await verifyOwnerOtp(fd);
        if (res.error) return setError(res.error);
        toast.success(s.account.created);
        router.refresh();
      } catch {
        setError("generic");
      }
    });
  }

  if (checkEmail) {
    const [before, after = ""] = s.account.checkEmailBody.split("{email}");
    return (
      <div className="text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--bg-secondary)", color: "var(--accent-text)" }}
        >
          <MailCheck size={26} />
        </span>
        <StepHeader title={s.account.checkEmailTitle} />
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {before}
          <strong dir="ltr" className="break-all" style={{ color: "var(--text-primary)" }}>
            {checkEmail}
          </strong>
          {after}
        </p>
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {t.auth.checkSpam}
        </p>
      </div>
    );
  }

  if (otpPhone) {
    return (
      <form onSubmit={submitOtp} noValidate>
        <StepHeader
          title={s.account.otpTitle}
          subtitle={s.account.otpBody.replace("{phone}", "⁦" + otpPhone + "⁩")}
        />
        {error && <AuthAlert>{errorText(error)}</AuthAlert>}
        <TextField
          label={s.account.otpLabel}
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={8}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^\d٠-٩]/g, ""))}
          autoFocus
        />
        <div className="mt-6">
          <SubmitButton loading={pending} loadingLabel={s.account.verifying}>
            {s.account.verify}
          </SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      <StepHeader eyebrow={s.account.eyebrow} title={s.account.title} subtitle={s.account.subtitle} />
      {error && <AuthAlert>{errorText(error)}</AuthAlert>}
      <div className="flex flex-col gap-4">
        <AuthField
          label={s.account.phoneLabel}
          icon={Phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder={s.account.phonePlaceholder}
          hint={s.account.phoneHint}
          autoFocus
          {...bind("phone")}
        />
        <AuthField label={t.auth.fullName} icon={User} autoComplete="name" {...bind("fullName")} />
        {!phoneAuth && (
          <AuthField
            label={t.auth.emailAddress}
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            {...bind("email")}
          />
        )}
        <PasswordField
          label={t.auth.password}
          icon={Lock}
          autoComplete="new-password"
          showStrength
          {...bind("password")}
        />
      </div>
      <div className="mt-6">
        <SubmitButton loading={pending} loadingLabel={s.account.creating}>
          {s.account.submit}
        </SubmitButton>
      </div>
      <TermsNotice template={t.auth.signUpTerms} />
      <p className="mt-4 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
        {s.account.haveAccount}{" "}
        <a
          href={href(`/auth/login?next=${encodeURIComponent(`/${locale}/start`)}`)}
          className="font-medium underline underline-offset-2"
          style={{ color: "var(--accent-text)" }}
        >
          {t.auth.signInBtn}
        </a>
      </p>
    </form>
  );
}
