"use client";

// Phone verification for guests (feature-flagged). State lives in the
// engine's persisted booking state, so a refresh keeps "code sent" and a
// verified token.

import React, { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import type { PublicBookingSecurity } from "@/lib/otp/config";
import { maskForDisplay, samePhone, toJordanMobile, toLatinDigits } from "@/lib/otp/phone";
import { InlineAlert } from "./booking-ui";

export interface OtpState {
  phone: string;
  token: string | null;
  sentAt: number | null;
  verifiedAt: number | null;
}

export const RESEND_AFTER_SEC = 60;

/** Verified for this phone (token for "hook", a session for "supabase"). */
export function otpSatisfied(otp: OtpState | null, phone: string): boolean {
  return !!otp && samePhone(otp.phone, phone) && (!!otp.token || !!otp.verifiedAt);
}

type AuthClient = {
  auth: {
    signInWithOtp: (args: { phone: string; options?: Record<string, unknown> }) => Promise<{ error: unknown }>;
    verifyOtp: (args: { phone: string; token: string; type: "sms" }) => Promise<{ error: unknown }>;
  };
};

export function OtpPanel({
  security, phone, phoneValid, otp, onChange, client, captchaToken,
}: {
  security: PublicBookingSecurity;
  phone: string;
  phoneValid: boolean;
  otp: OtpState | null;
  onChange: (next: OtpState | null) => void;
  client: unknown;
  captchaToken: string | null;
}) {
  const { t, locale } = useTranslation();
  const f = t.bookingFlow;
  const codeId = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const forThisPhone = !!otp && samePhone(otp.phone, phone);
  const sent = forThisPhone && !!otp?.sentAt;
  const verified = otpSatisfied(otp, phone);
  const wait = sent ? Math.max(0, RESEND_AFTER_SEC - Math.floor((now - (otp!.sentAt ?? 0)) / 1000)) : 0;

  useEffect(() => {
    if (!sent || wait <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sent, wait]);

  const codeError = (code?: string | null) => {
    const map: Record<string, string> = {
      OTP_INVALID: f.otpInvalid,
      OTP_EXPIRED: f.otpExpired,
      OTP_TOO_MANY_ATTEMPTS: f.otpTooMany,
      RATE_LIMITED: f.otpRateLimited,
      CAPTCHA_FAILED: f.captchaFailed,
      PHONE_NOT_SUPPORTED: f.otpPhoneNotSupported,
    };
    return (code && map[code]) || f.otpSendFailed;
  };

  const send = async () => {
    if (!phoneValid || busy) return;
    setError(null);
    // Codes go to Jordanian mobiles only (the server enforces the same rule).
    const e164 = toJordanMobile(phone);
    if (!e164) {
      setError(f.otpPhoneNotSupported);
      return;
    }
    setBusy("send");
    try {
      if (security.otpMode === "supabase") {
        const { error: err } = await (client as AuthClient).auth.signInWithOtp({
          phone: `+${e164}`,
          options: { channel: security.otpChannel, data: { locale } },
        });
        if (err) throw Object.assign(new Error("send"), { code: "SEND" });
      } else {
        const res = await fetch("/api/booking/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, locale, captchaToken: captchaToken ?? undefined }),
        });
        const json = (await res.json().catch(() => null)) as { success?: boolean; code?: string } | null;
        if (!res.ok || !json?.success) throw Object.assign(new Error("send"), { code: json?.code });
      }
      setNow(Date.now());
      setCode("");
      onChange({ phone, token: null, sentAt: Date.now(), verifiedAt: null });
      toast.success(interpolate(f.otpSent, { phone: maskForDisplay(phone) }));
    } catch (err) {
      const msg = codeError((err as { code?: string }).code);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = toLatinDigits(code).replace(/\D/g, "");
    if (value.length !== 6 || busy) return;
    setBusy("verify");
    setError(null);
    try {
      if (security.otpMode === "supabase") {
        const e164 = toJordanMobile(phone);
        const { error: err } = await (client as AuthClient).auth.verifyOtp({ phone: `+${e164}`, token: value, type: "sms" });
        if (err) throw Object.assign(new Error("verify"), { code: "OTP_INVALID" });
        onChange({ phone, token: null, sentAt: otp?.sentAt ?? null, verifiedAt: Date.now() });
      } else {
        const res = await fetch("/api/booking/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code: value }),
        });
        const json = (await res.json().catch(() => null)) as { success?: boolean; token?: string; code?: string } | null;
        if (!res.ok || !json?.success || !json.token) throw Object.assign(new Error("verify"), { code: json?.code });
        onChange({ phone, token: json.token, sentAt: otp?.sentAt ?? null, verifiedAt: Date.now() });
      }
      toast.success(f.phoneVerified);
    } catch (err) {
      const msg = codeError((err as { code?: string }).code ?? "OTP_INVALID");
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  if (verified) {
    return (
      <div className="bk-policy" role="status">
        <CheckCircle2 size={18} aria-hidden="true" style={{ color: "var(--color-success)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{f.phoneVerified}</strong>
          <span dir="ltr" style={{ display: "block", color: "var(--color-ink-muted)", fontSize: 12 }}>{maskForDisplay(phone)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <ShieldCheck size={20} aria-hidden="true" style={{ color: "var(--color-brand-text)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-title" style={{ margin: 0 }}>{f.verifyPhoneTitle}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-ink-muted)", lineHeight: 1.5 }}>
            {security.otpChannel === "whatsapp" ? f.verifyPhoneWhatsApp : f.verifyPhoneSms}
          </p>
        </div>
      </div>

      {sent && (
        <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 8 }} noValidate>
          <label htmlFor={codeId} className="field-label">
            {interpolate(f.enterCode, { phone: maskForDisplay(phone) })}
          </label>
          <input
            id={codeId}
            className="field-input bk-otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            dir="ltr"
            value={code}
            onChange={(e) => {
              // Arabic-Indic / Persian digits from Arabic keyboards count.
              const v = toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6);
              setCode(v);
              setError(null);
            }}
            aria-invalid={!!error || undefined}
          />
          <button type="submit" className="bk-cta" disabled={code.length !== 6 || !!busy} aria-busy={busy === "verify"}>
            {busy === "verify" ? <Loader2 size={16} className="bk-spin" aria-hidden="true" /> : null}
            {f.verifyCode}
          </button>
        </form>
      )}

      {error && <InlineAlert>{error}</InlineAlert>}

      <button
        type="button"
        className={sent ? "bk-btn-ghost" : "bk-btn-secondary"}
        onClick={send}
        disabled={!phoneValid || !!busy || wait > 0}
        aria-busy={busy === "send"}
      >
        {busy === "send" ? <Loader2 size={16} className="bk-spin" aria-hidden="true" /> : null}
        {!phoneValid ? f.enterPhoneFirst : sent ? (wait > 0 ? interpolate(f.resendIn, { seconds: wait }) : f.resendCode) : f.sendCode}
      </button>
    </div>
  );
}
