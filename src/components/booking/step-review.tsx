"use client";

// Step 4 — review: plain-language policy with the exact deadline, per-service
// client notes with quick chips, the shop's important info, contact details,
// optional phone verification / bot check, and Confirm.

import React, { useId, useState } from "react";
import Link from "next/link";
import { Check, Info, Loader2, MessageSquarePlus, Wallet, CalendarClock } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import type { PublicBookingSecurity } from "@/lib/otp/config";
import { InlineAlert, renderTemplate } from "./booking-ui";
import { appendChip, freeCancellationUntil, lineQuote, NOTE_CHIPS, type BarberServiceRow, type Line, type ServiceRow } from "./booking-state";
import { money } from "./booking-format";
import { latinDigits } from "./booking-utils";
import { OtpPanel, type OtpState } from "./otp-panel";
import { TurnstileWidget } from "./turnstile-widget";
import type { ChosenSlot } from "./step-time";
import { joinMeta } from "@/lib/format";

export interface ReviewProps {
  lines: Line[];
  servicesById: Map<string, ServiceRow>;
  barberServices: BarberServiceRow[] | null;
  barberLabel: string;
  slot: ChosenSlot;
  timeZone: string;
  currency: string | null;
  total: { price: number; duration: number; isFrom: boolean };
  policyHours: number;
  importantInfo: string | null;
  onLineNote: (serviceId: string, note: string) => void;
  name: string;
  phone: string;
  notes: string;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setNotes: (v: string) => void;
  nameValid: boolean;
  phoneValid: boolean;
  security: PublicBookingSecurity;
  otp: OtpState | null;
  onOtp: (next: OtpState | null) => void;
  otpOk: boolean;
  captchaToken: string | null;
  onCaptcha: (token: string | null) => void;
  captchaKey: number;
  client: unknown;
  submitting: boolean;
  error: string | null;
  staleNotice: React.ReactNode;
  onSubmit: () => void;
  rescheduling: boolean;
  isSignedIn: boolean;
}

export function StepReview(p: ReviewProps) {
  const { t, locale, isRTL, formatDate, formatTime, formatDuration, href } = useTranslation();
  const f = t.bookingFlow;
  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();
  const ctaHintId = useId();
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  // "Now" for the policy line, fixed when the review step opens.
  const [openedAt] = useState(() => Date.now());

  const start = new Date(p.slot.startIso);
  const deadline = freeCancellationUntil(p.slot.startIso, p.policyHours);
  const deadlinePassed = !!deadline && deadline.getTime() <= openedAt;
  const deadlineText = deadline
    ? `${formatDate(deadline, { weekday: "short", day: "numeric", month: "short", timeZone: p.timeZone })} ${formatTime(deadline, { timeZone: p.timeZone })}`
    : null;
  const policyText = !deadline
    ? f.policyAnyTime
    : deadlinePassed
      ? interpolate(f.policyInsideWindow, { hours: p.policyHours })
      : interpolate(f.policyUntil, { when: deadlineText ?? "" });

  const needsOtp = !p.rescheduling && p.security.otpRequired && !p.otpOk;
  const needsCaptcha = !p.rescheduling && !!p.security.turnstileSiteKey && !p.captchaToken;
  const detailsOk = p.rescheduling || (p.nameValid && p.phoneValid);
  const canConfirm = detailsOk && !needsOtp && !needsCaptcha && !p.submitting;
  const ctaHint = p.rescheduling ? null
    : !p.nameValid ? t.booking.enterName
    : !p.phoneValid ? t.booking.enterValidPhone
    : needsOtp ? f.verifyToContinue
    : needsCaptcha ? f.completeCheck
    : null;
  const nameShowsError = nameTouched && !p.nameValid;
  const phoneShowsError = phoneTouched && p.phone.trim().length > 0 && !p.phoneValid;
  const amount = money(p.total.price, p.currency, locale);
  const chipText = (k: (typeof NOTE_CHIPS)[number]) => f.chips[k];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setPhoneTouched(true);
    if (canConfirm) p.onSubmit();
  };

  return (
    <form onSubmit={submit} noValidate className="bk-two-col" aria-busy={p.submitting}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {/* Services with per-service notes */}
        <section className="bk-card" style={{ padding: 20 }} aria-labelledby="bk-lines-title">
          <h2 id="bk-lines-title" className="text-h3" style={{ margin: "0 0 8px" }}>{t.booking.services}</h2>
          <ul className="bk-list">
            {p.lines.map((l) => {
              const s = p.servicesById.get(l.serviceId);
              if (!s) return null;
              const q = lineQuote(s, l.variantId, p.barberServices?.find((r) => r.service_id === s.id) ?? null);
              const v = l.variantId ? s.variants.find((x) => x.id === l.variantId) : null;
              const shopNote = isRTL ? s.client_note_ar || s.client_note_en : s.client_note_en || s.client_note_ar;
              const noteOpen = openNote === s.id || !!l.note;
              const noteInputId = `${notesId}-${s.id}`;
              return (
                <li key={s.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "8px 0 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="text-title" style={{ margin: 0, overflowWrap: "anywhere" }}>
                        {isRTL && s.name_ar ? s.name_ar : s.name}
                      </p>
                      <p className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "2px 0 0" }}>
                        {joinMeta([formatDuration(q.duration), v ? (isRTL && v.name_ar ? v.name_ar : v.name_en) : null])}
                      </p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {s.price_type === "free" ? f.free : q.isFrom ? interpolate(f.fromPrice, { price: money(q.price, p.currency, locale) }) : money(q.price, p.currency, locale)}
                    </span>
                  </div>
                  {shopNote && (
                    <p style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--color-ink-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                      <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} /> {shopNote}
                    </p>
                  )}
                  {!p.rescheduling && (noteOpen ? (
                    <div style={{ marginTop: 8 }}>
                      <label htmlFor={noteInputId} className="sr-only">{interpolate(f.noteFor, { service: isRTL && s.name_ar ? s.name_ar : s.name })}</label>
                      <input
                        id={noteInputId}
                        className="field-input"
                        maxLength={300}
                        placeholder={f.notePlaceholder}
                        value={l.note}
                        onChange={(e) => p.onLineNote(s.id, e.target.value)}
                      />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }} role="group" aria-label={f.quickNotes}>
                        {NOTE_CHIPS.map((k) => {
                          const text = chipText(k);
                          const on = l.note.includes(text);
                          return (
                            <button key={k} type="button" className="bk-chip" aria-pressed={on} onClick={() => p.onLineNote(s.id, appendChip(l.note, text))}>
                              {text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="bk-link" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }} onClick={() => setOpenNote(s.id)}>
                      <MessageSquarePlus size={14} aria-hidden="true" /> {f.addNote}
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Details */}
        {!p.rescheduling && (
          <fieldset className="bk-card" style={{ padding: 20, margin: 0 }} disabled={p.submitting}>
            <legend className="text-h3" style={{ padding: "0 6px", marginInlineStart: -6 }}>{t.booking.yourDetails}</legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
              <div>
                <label htmlFor={nameId} className="field-label">{t.booking.yourName}</label>
                <input
                  id={nameId} name="name" type="text" className="field-input" autoComplete="name" required maxLength={100}
                  placeholder={t.booking.namePlaceholder} value={p.name}
                  onChange={(e) => p.setName(e.target.value)} onBlur={() => setNameTouched(true)}
                  aria-invalid={nameShowsError || undefined} aria-describedby={nameShowsError ? `${nameId}-err` : undefined}
                />
                {nameShowsError && <p id={`${nameId}-err`} className="field-error">{t.booking.enterName}</p>}
              </div>
              <div>
                <label htmlFor={phoneId} className="field-label">{t.booking.phoneNumber}</label>
                <input
                  id={phoneId} name="tel" type="tel" className="field-input" autoComplete="tel" inputMode="tel" dir="ltr"
                  required maxLength={20} placeholder={t.booking.phonePlaceholder} value={p.phone}
                  onChange={(e) => p.setPhone(latinDigits(e.target.value))} onBlur={() => setPhoneTouched(true)}
                  aria-invalid={phoneShowsError || undefined}
                  aria-describedby={`${phoneId}-help${phoneShowsError ? ` ${phoneId}-err` : ""}`}
                  style={{ textAlign: isRTL ? "right" : "left" }}
                />
                <p id={`${phoneId}-help`} style={{ fontSize: 12, color: "var(--color-ink-muted)", margin: "6px 0 0" }}>{t.booking.phoneHelp}</p>
                {phoneShowsError && <p id={`${phoneId}-err`} className="field-error">{t.booking.invalidPhone}</p>}
              </div>
              <div>
                <label htmlFor={notesId} className="field-label">
                  {t.booking.notes} <span style={{ fontWeight: 500, color: "var(--color-ink-muted)" }}>({t.common.optional})</span>
                </label>
                <textarea
                  id={notesId} name="notes" className="field-input" rows={2} maxLength={500}
                  placeholder={t.booking.notesPlaceholder} value={p.notes} onChange={(e) => p.setNotes(e.target.value)}
                  style={{ resize: "vertical", minHeight: 64 }}
                />
              </div>
            </div>
          </fieldset>
        )}

        {!p.rescheduling && p.security.otpRequired && (
          <OtpPanel
            security={p.security} phone={p.phone} phoneValid={p.phoneValid} otp={p.otp} onChange={p.onOtp}
            client={p.client} captchaToken={p.captchaToken}
          />
        )}

        {/* Policy, in plain language with the exact deadline */}
        <div className="bk-policy">
          <CalendarClock size={20} aria-hidden="true" style={{ color: "var(--color-ink-soft)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 600, margin: "0 0 2px" }}>{f.policyTitle}</p>
            <p style={{ margin: 0, color: "var(--color-ink-muted)" }}>{policyText}</p>
          </div>
        </div>
        <div className="bk-policy">
          <Wallet size={20} aria-hidden="true" style={{ color: "var(--color-ink-soft)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 600, margin: "0 0 2px" }}>{t.booking.noPaymentToday}</p>
            <p style={{ margin: 0, color: "var(--color-ink-muted)" }}>{interpolate(t.booking.payInShopNotice, { amount })}</p>
          </div>
        </div>
        {p.importantInfo && (
          <div className="bk-policy">
            <Info size={20} aria-hidden="true" style={{ color: "var(--color-ink-soft)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 600, margin: "0 0 2px" }}>{f.importantInfo}</p>
              <p style={{ margin: 0, color: "var(--color-ink-muted)", whiteSpace: "pre-line" }}>{p.importantInfo}</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary + confirm */}
      <aside className="bk-summary" aria-labelledby="bk-summary-title">
        <h2 id="bk-summary-title" className="text-h3" style={{ margin: "0 0 16px" }}>{t.booking.summary}</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 0 14px", borderBottom: "1px solid var(--color-line)", margin: "0 0 14px" }}>
          {[
            { label: t.booking.barber, value: p.barberLabel },
            { label: t.booking.dateLabel, value: formatDate(start, { weekday: "short", day: "numeric", month: "short", timeZone: p.timeZone }) },
            { label: t.booking.timeLabel, value: formatTime(p.slot.localTime) },
            { label: t.booking.duration, value: formatDuration(p.total.duration) },
          ].map((r) => (
            <div key={r.label} style={{ minWidth: 0 }}>
              <dt className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "0 0 2px" }}>{r.label}</dt>
              <dd style={{ fontSize: 15, fontWeight: 600, margin: 0, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>{t.booking.total}</span>
          <span style={{ fontSize: 22, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {p.total.isFrom ? interpolate(f.fromPrice, { price: amount }) : amount}
          </span>
        </div>

        {!p.rescheduling && p.security.turnstileSiteKey && (
          <div style={{ marginBottom: 12 }}>
            <TurnstileWidget key={p.captchaKey} siteKey={p.security.turnstileSiteKey} locale={locale} onToken={p.onCaptcha} label={f.securityCheck} />
          </div>
        )}

        {p.staleNotice}
        {p.error && <div style={{ marginBottom: 12 }}><InlineAlert>{p.error}</InlineAlert></div>}

        <button
          type="submit" className="bk-cta" style={{ width: "100%" }}
          disabled={!canConfirm} aria-busy={p.submitting} aria-describedby={ctaHint ? ctaHintId : undefined}
        >
          {p.submitting
            ? <><Loader2 size={18} aria-hidden="true" className="bk-spin" /> {t.common.processing}</>
            : <><Check size={18} aria-hidden="true" /> {p.rescheduling ? f.confirmNewTime : t.booking.confirmBtn}</>}
        </button>
        {ctaHint && !p.submitting && (
          <p id={ctaHintId} style={{ fontSize: 12, color: "var(--color-ink-muted)", textAlign: "center", margin: "8px 0 0" }}>{ctaHint}</p>
        )}
        {!p.rescheduling && (
          <p style={{ fontSize: 12, color: "var(--color-ink-muted)", textAlign: "center", margin: "10px 0 0", lineHeight: 1.5 }}>
            {renderTemplate(t.booking.consent, {
              terms: <Link href={href("/terms")} target="_blank" className="bk-link">{t.auth.terms}</Link>,
              privacy: <Link href={href("/privacy")} target="_blank" className="bk-link">{t.auth.privacyText}</Link>,
              policy: <Link href={href("/policy")} target="_blank" className="bk-link">{t.booking.cancellationPolicy}</Link>,
            })}
          </p>
        )}
      </aside>
    </form>
  );
}
