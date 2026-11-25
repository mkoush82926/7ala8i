"use client";

// Shared building blocks for every auth screen (login, signup, forgot/reset
// password, join, the /start account step). One layout, one field style
// (globals.css .auth-input / .field-*, v2 values), logical properties only —
// so LTR and RTL render identically.

import React, { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Globe, Info, type LucideIcon } from "lucide-react";
import { useTranslation, FONT_EN_DISPLAY } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  buttonClasses,
  errorTextClasses,
  focusRing,
  helperClasses,
  labelClasses,
  spinnerClasses,
  textLinkClasses,
} from "@/components/ui/recipes";
import { passwordStrength } from "../auth-errors";

// ─── Layout ───
//
// Design System v2 §6.8: on desktop a 50/50 split — the form column (white,
// card-less) and a deep-teal brand panel with the sand-stripe hatch and a
// "how it works" card. Phones get the form only.

interface AuthShellProps {
  children: React.ReactNode;
  /** Optional link shown in the top bar (e.g. "Sign in" on the signup page). */
  navLink?: { href: string; label: string };
  /** Form width: "sm" ≈ 448px (forms), "md" ≈ 512px (role picker), "lg" ≈ 768px. */
  width?: "sm" | "md" | "lg";
}

const WIDTHS = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" } as const;

export function AuthShell({ children, navLink, width = "sm" }: AuthShellProps) {
  const { t, FF, dir, locale, href, switchLocale } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const otherLocale = locale === "ar" ? "en" : "ar";
  const query = searchParams?.toString();
  const switchHref = `${switchLocale(pathname || "/", otherLocale)}${query ? `?${query}` : ""}`;
  const showVisual = width !== "lg";

  return (
    <div
      dir={dir}
      className={cn("min-h-dvh bg-card text-ink", showVisual && "lg:grid lg:grid-cols-2")}
      style={{ fontFamily: FF }}
    >
      <a href="#auth-main" className="skip-link">
        {t.auth.skipToForm}
      </a>

      <div className="flex min-h-dvh flex-col">
        <nav
          aria-label={t.auth.navLabel}
          className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6 lg:static lg:border-transparent lg:bg-card lg:px-10 lg:backdrop-blur-none"
        >
          <Link
            href={href("/landing")}
            dir="ltr"
            className={cn("rounded-md text-xl font-extrabold tracking-tight text-ink no-underline", focusRing)}
            style={{ fontFamily: FONT_EN_DISPLAY }}
          >
            Halaqy<span className="text-brand-text">.</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href={switchHref}
              hrefLang={otherLocale}
              lang={otherLocale}
              aria-label={t.auth.switchLanguage}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
              onClick={() => {
                try {
                  document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; samesite=lax`;
                } catch {
                  /* ignore */
                }
              }}
            >
              <Globe aria-hidden="true" />
              <span>{t.topbar.language}</span>
            </Link>
            {navLink && (
              <Link href={navLink.href} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {navLink.label}
              </Link>
            )}
          </div>
        </nav>

        <main
          id="auth-main"
          tabIndex={-1}
          className="flex flex-1 justify-center px-4 pb-12 pt-8 outline-none sm:px-6 sm:pt-12 lg:items-center lg:px-10 lg:py-12"
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.05, 0.7, 0.1, 1] }}
            className={cn("w-full", WIDTHS[width])}
          >
            {children}
          </motion.div>
        </main>

        <footer className="px-4 pb-8 text-center sm:px-6 lg:px-10 lg:text-start">
          <p className="m-0 text-xs text-ink-muted">
            {t.auth.copyright.replace("{year}", String(new Date().getFullYear()))}
          </p>
        </footer>
      </div>

      {showVisual && <AuthVisual />}
    </div>
  );
}

/** Desktop brand panel: teal fill + sand stripe, headline and a 3-step card. */
function AuthVisual() {
  const { t } = useTranslation();
  const steps = [
    { title: t.search.howStep1Title, body: t.search.howStep1Body },
    { title: t.search.howStep2Title, body: t.search.howStep2Body },
    { title: t.search.howStep3Title, body: t.search.howStep3Body },
  ];
  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-[#134E4A] lg:block">
      <div className="sticky top-0 flex h-dvh flex-col justify-between p-10 xl:p-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(135deg,#0F766E 0%,#134E4A 100%)" }}
        />
        <div className="bg-hatch pointer-events-none absolute inset-0" />
        <div
          className="pointer-events-none absolute -end-24 -top-24 size-[420px] rounded-full opacity-40"
          style={{ background: "radial-gradient(closest-side, rgb(94 234 212 / 0.35), transparent)" }}
        />

        <p className="relative max-w-md text-[40px] font-bold leading-[48px] tracking-tight text-white rtl:text-[36px] rtl:font-extrabold rtl:leading-[56px] rtl:tracking-normal xl:text-[48px] xl:leading-[56px] rtl:xl:text-[42px] rtl:xl:leading-[64px]">
          {t.search.heroTitle}
        </p>

        <div className="relative max-w-md rounded-2xl bg-white/95 p-6 text-[#0F172A] shadow-float">
          <p className="mb-4 text-base font-semibold">{t.search.howTitle}</p>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#E6F2F0] text-sm font-bold tabular-nums text-[#134E4A]">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#5B6B7F]">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}

/** Form wrapper used inside AuthShell (card-less, per §6.8). */
export function AuthCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full", className)}>{children}</div>;
}

interface AuthHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "error";
  align?: "start" | "center";
}

const HEADER_TONES = {
  neutral: "bg-brand-soft text-brand-text",
  success: "bg-success-soft text-success-text",
  error: "bg-danger-soft text-danger-text",
} as const;

export function AuthHeader({ title, subtitle, icon: Icon, tone = "neutral", align = "start" }: AuthHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col", align === "center" ? "items-center text-center" : "items-start text-start")}>
      {Icon && (
        <div aria-hidden="true" className={cn("bg-hatch-ink mb-5 grid size-14 place-items-center rounded-2xl", HEADER_TONES[tone])}>
          <Icon size={26} />
        </div>
      )}
      <h1 className="text-h1 mb-2 text-ink">{title}</h1>
      {subtitle && <p className="text-body m-0 text-ink-muted">{subtitle}</p>}
    </div>
  );
}

// ─── Fields ───

interface AuthFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  /** React 19: forwarded straight to the <input>. */
  ref?: React.Ref<HTMLInputElement>;
  label: React.ReactNode;
  icon?: LucideIcon;
  error?: string | null;
  hint?: React.ReactNode;
  /** Trailing control inside the input (e.g. password toggle). */
  action?: React.ReactNode;
  /** Content aligned to the end of the label row (e.g. "Forgot password?"). */
  labelAside?: React.ReactNode;
}

export function AuthField({
  id: idProp,
  label,
  icon: Icon,
  error,
  hint,
  action,
  labelAside,
  className = "",
  ...inputProps
}: AuthFieldProps) {
  const autoId = useId();
  const id = idProp ?? `f${autoId.replace(/:/g, "")}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const classes = ["auth-input", Icon ? "has-icon" : "", action ? "has-action" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelClasses}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        {Icon && <Icon size={18} className="field-icon" aria-hidden="true" />}
        <input
          id={id}
          className={classes}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {action}
      </div>
      {error ? (
        <p id={errorId} className={errorTextClasses}>
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint && !error ? (
        <div id={hintId} className={helperClasses}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

interface PasswordFieldProps extends Omit<AuthFieldProps, "type" | "action"> {
  /** Show the strength meter under the field. */
  showStrength?: boolean;
}

export function PasswordField({ showStrength, hint, value, ...props }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const id = props.id ?? `p${autoId.replace(/:/g, "")}`;
  const text = typeof value === "string" ? value : "";

  return (
    <AuthField
      {...props}
      id={id}
      value={value}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      dir="ltr"
      style={{ textAlign: "start", ...props.style }}
      hint={showStrength && text ? <PasswordStrength password={text} /> : hint}
      action={
        <button
          type="button"
          className={cn("field-action", focusRing)}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}

export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const score = passwordStrength(password);
  if (!score) return null;
  const labels = [t.auth.strengthWeak, t.auth.strengthWeak, t.auth.strengthFair, t.auth.strengthGood, t.auth.strengthStrong];
  const colors = ["", "bg-danger", "bg-warning", "bg-brand", "bg-success"];
  const label = labels[score];
  return (
    <div className="flex items-center gap-2.5">
      <div aria-hidden="true" className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none",
              level <= score ? colors[score] : "bg-sunken-2",
            )}
          />
        ))}
      </div>
      <span aria-live="polite" className="whitespace-nowrap text-xs font-semibold text-ink-soft">
        {t.auth.passwordStrength.replace("{level}", label)}
      </span>
    </div>
  );
}

// ─── Feedback & actions ───

export function AuthAlert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "info";
}) {
  const Icon = tone === "error" ? AlertCircle : tone === "info" ? Info : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm font-medium leading-5",
        tone === "error" && "error-shake bg-danger-soft text-danger-text",
        tone === "success" && "bg-success-soft text-success-text",
        tone === "info" && "bg-brand-soft text-brand-pressed",
      )}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  /** Show a trailing direction-aware arrow. */
  arrow?: boolean;
}

export function SubmitButton({ loading, loadingLabel, arrow = true, children, disabled, className, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant: "primary", size: "xl", fullWidth: true, className })}
      {...props}
    >
      {loading ? (
        <>
          <span aria-hidden="true" className={spinnerClasses} />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {arrow && <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />}
        </>
      )}
    </button>
  );
}

/** "By signing in, you agree to our {terms} and {privacy}" with real links. */
export function TermsNotice({ template }: { template: string }) {
  const { t, href } = useTranslation();
  const [before, rest = ""] = template.split("{terms}");
  const [middle, after = ""] = rest.split("{privacy}");
  const linkClass = cn("rounded-sm text-ink-soft underline underline-offset-2 hover:text-ink", focusRing);
  return (
    <p className="mt-6 text-center text-xs leading-5 text-ink-muted">
      {before}
      <Link href={href("/terms")} className={linkClass}>
        {t.auth.terms}
      </Link>
      {middle}
      <Link href={href("/privacy")} className={linkClass}>
        {t.auth.privacyText}
      </Link>
      {after}
    </p>
  );
}

/** Small inline link-style text row ("Don't have an account? Create account"). */
export function AuthFootnote({ text, linkLabel, linkHref }: { text: React.ReactNode; linkLabel: React.ReactNode; linkHref: string }) {
  return (
    <p className="mt-6 text-center text-sm text-ink-muted">
      {text}{" "}
      <Link href={linkHref} className={cn("rounded-sm", textLinkClasses, focusRing)}>
        {linkLabel}
      </Link>
    </p>
  );
}
