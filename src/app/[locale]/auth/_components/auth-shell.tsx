"use client";

// Shared building blocks for every auth screen (login, signup, forgot/reset
// password, join). One layout, one field style (globals.css .auth-input /
// .field-*), logical properties only — so LTR and RTL render identically.

import React, { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Globe, Loader2, type LucideIcon } from "lucide-react";
import { useTranslation, headingTracking, FONT_EN_DISPLAY } from "@/hooks/use-translation";
import { passwordStrength } from "../auth-errors";

// ─── Layout ───

interface AuthShellProps {
  children: React.ReactNode;
  /** Optional link shown in the top bar (e.g. "Sign in" on the signup page). */
  navLink?: { href: string; label: string };
  /** Card width: "sm" ≈ 440px (forms), "lg" ≈ 960px (role picker). */
  width?: "sm" | "md" | "lg";
}

const WIDTHS = { sm: 440, md: 520, lg: 960 } as const;

export function AuthShell({ children, navLink, width = "sm" }: AuthShellProps) {
  const { t, FF, dir, locale, href, switchLocale } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const otherLocale = locale === "ar" ? "en" : "ar";
  const query = searchParams?.toString();
  const switchHref = `${switchLocale(pathname || "/", otherLocale)}${query ? `?${query}` : ""}`;

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
        fontFamily: FF,
      }}
    >
      <a href="#auth-main" className="skip-link">
        {t.auth.skipToForm}
      </a>
      <nav
        className="auth-nav"
        aria-label={t.auth.navLabel}
        style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Link
          href={href("/landing")}
          dir="ltr"
          className="focus-ring"
          style={{
            fontFamily: FONT_EN_DISPLAY,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.012em",
            color: "var(--text-primary)",
            textDecoration: "none",
            borderRadius: 6,
          }}
        >
          Halaqy.
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href={switchHref}
            hrefLang={otherLocale}
            lang={otherLocale}
            aria-label={t.auth.switchLanguage}
            className="btn btn-ghost focus-ring"
            style={{ minHeight: 40, padding: "0 12px", fontSize: 14, color: "var(--text-secondary)" }}
            onClick={() => {
              try {
                document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; samesite=lax`;
              } catch {
                /* ignore */
              }
            }}
          >
            <Globe size={16} aria-hidden="true" />
            <span>{t.topbar.language}</span>
          </Link>
          {navLink && (
            <Link
              href={navLink.href}
              className="btn btn-secondary"
              style={{ borderRadius: 9999, minHeight: 40, padding: "0 16px", fontSize: 14 }}
            >
              {navLink.label}
            </Link>
          )}
        </div>
      </nav>

      <main id="auth-main" tabIndex={-1} className="auth-main" style={{ outline: "none" }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          style={{ width: "100%", maxWidth: WIDTHS[width] }}
        >
          {children}
        </motion.div>
      </main>

      <footer className="auth-footer" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {t.auth.copyright.replace("{year}", String(new Date().getFullYear()))}
        </p>
      </footer>
    </div>
  );
}

/** White card used inside AuthShell. */
export function AuthCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`auth-card ${className}`.trim()}>{children}</div>;
}

interface AuthHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "error";
  align?: "start" | "center";
}

export function AuthHeader({ title, subtitle, icon: Icon, tone = "neutral", align = "start" }: AuthHeaderProps) {
  const { isRTL, FFD } = useTranslation();
  const toneStyle =
    tone === "success"
      ? { background: "var(--accent-mint-muted)", color: "var(--accent-mint)" }
      : tone === "error"
        ? { background: "var(--accent-rose-muted)", color: "var(--accent-rose)" }
        : { background: "var(--text-primary)", color: "var(--bg-primary)" };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "start",
        marginBottom: 28,
      }}
    >
      {Icon && (
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            ...toneStyle,
          }}
        >
          <Icon size={22} />
        </div>
      )}
      <h1
        style={{
          fontFamily: FFD,
          fontSize: "clamp(24px, 6vw, 30px)",
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: headingTracking(isRTL, "0.012em"),
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>{subtitle}</p>
      )}
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {labelAside}
      </div>
      <div style={{ position: "relative" }}>
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
        <p id={errorId} className="field-error" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </p>
      ) : null}
      {hint && !error ? (
        <div id={hintId} style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
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
          className="field-action focus-ring"
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
  const colors = ["", "var(--accent-rose)", "var(--accent-brass)", "var(--accent-brass)", "var(--accent-mint)"];
  const label = labels[score];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div aria-hidden="true" style={{ display: "flex", gap: 4, flex: 1 }}>
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 9999,
              background: level <= score ? colors[score] : "var(--border-subtle)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span aria-live="polite" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
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
  const palette =
    tone === "error"
      ? { bg: "var(--accent-rose-muted)", fg: "var(--accent-rose)", Icon: AlertCircle }
      : { bg: "var(--accent-mint-muted)", fg: "var(--text-primary)", Icon: CheckCircle2 };
  const Icon = palette.Icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={tone === "error" ? "error-shake" : undefined}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 10,
        background: palette.bg,
        color: palette.fg,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.5,
      }}
    >
      <Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, color: tone === "error" ? undefined : "var(--accent-mint)" }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  /** Show a trailing direction-aware arrow. */
  arrow?: boolean;
}

export function SubmitButton({ loading, loadingLabel, arrow = true, children, disabled, style, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ width: "100%", minHeight: 52, fontWeight: 600, ...style }}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {arrow && <ArrowRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />}
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
  const linkStyle: React.CSSProperties = { color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 2 };
  return (
    <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, lineHeight: 1.6, color: "var(--text-muted)" }}>
      {before}
      <Link href={href("/terms")} style={linkStyle}>
        {t.auth.terms}
      </Link>
      {middle}
      <Link href={href("/privacy")} style={linkStyle}>
        {t.auth.privacyText}
      </Link>
      {after}
    </p>
  );
}

/** Small inline link-style text row ("Don't have an account? Create account"). */
export function AuthFootnote({ text, linkLabel, linkHref }: { text: React.ReactNode; linkLabel: React.ReactNode; linkHref: string }) {
  return (
    <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
      {text}{" "}
      <Link
        href={linkHref}
        style={{ color: "var(--text-primary)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "var(--border-primary)" }}
      >
        {linkLabel}
      </Link>
    </p>
  );
}
