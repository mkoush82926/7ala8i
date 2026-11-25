"use client";

// Confirmation screen: summary, reference, add-to-calendar, next steps and
// contact actions (WhatsApp / call). Shown after a booking or a reschedule.

import React, { useMemo } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, MapPin, MessageCircle, Phone } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";
import { toast } from "@/components/ui/toast";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { InlineAlert } from "./booking-ui";
import { money } from "./booking-format";
import { bookingReference, buildIcs, googleCalendarUrl, normalizePhone, toWhatsAppNumber } from "./booking-utils";

export interface BookedSummary {
  appointmentId: string;
  startIso: string;
  endIso: string;
  price: number;
  currency: string | null;
  isFrom: boolean;
  barberLabel: string;
  servicesLabel: string;
}

export function StepSuccess({
  booked, shop, timeZone, clientPhone, policyHours, isSignedIn, rescheduled, headingRef,
}: {
  booked: BookedSummary;
  shop: { id: string; name: string; address: string | null; phone: string | null; whatsapp: string | null };
  timeZone: string;
  clientPhone: string;
  policyHours: number;
  isSignedIn: boolean;
  rescheduled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { t, locale, isRTL, href, formatLocalDate: formatDate, formatLocalTime: formatTime, formatLocalNumber } = useTranslation();
  const f = t.bookingFlow;

  const s = useMemo(() => {
    const start = new Date(booked.startIso);
    const end = new Date(booked.endIso);
    const dateLabel = formatDate(start, { weekday: "long", day: "numeric", month: "long", timeZone });
    const timeLabel = formatTime(start, { timeZone });
    const base = money(booked.price, booked.currency, locale);
    const amount = booked.isFrom ? interpolate(f.fromPrice, { price: base }) : base;
    const ref = bookingReference(booked.appointmentId);
    const event = {
      uid: booked.appointmentId,
      start,
      end,
      title: interpolate(t.booking.calendarTitle, { services: booked.servicesLabel, shop: shop.name }),
      location: shop.address ?? shop.name,
      description: `${t.booking.reference}: ${ref}`,
    };
    return { start, dateLabel, timeLabel, amount, ref, event };
  }, [booked, formatDate, formatTime, timeZone, locale, f.fromPrice, t.booking, shop]);

  const waNumber = toWhatsAppNumber(shop.whatsapp ?? shop.phone);
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(interpolate(t.booking.waMessage, {
        shop: shop.name, services: booked.servicesLabel, date: s.dateLabel, time: s.timeLabel, ref: s.ref,
      }))}`
    : null;
  const telHref = shop.phone ? `tel:${normalizePhone(shop.phone)}` : null;
  const policyText = policyHours > 0
    ? interpolate(t.booking.freeCancellationHours, { hours: formatLocalNumber(policyHours) })
    : t.booking.freeCancellation;

  const downloadIcs = () => {
    try {
      const blob = new Blob([buildIcs(s.event)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `halaqy-${s.ref}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t.error.message);
    }
  };

  return (
    <section aria-labelledby="bk-success-title" style={{ position: "relative" }}>
      <Confetti trigger />
      <div className="bk-success">
        <div aria-hidden="true" className="bk-success-mark">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1
          id="bk-success-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-h1"
          style={{ margin: "0 0 8px", outline: "none", letterSpacing: headingTracking(isRTL, "-0.02em") }}
        >
          {rescheduled ? f.rescheduledTitle : t.booking.allSet}
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-ink-muted)", maxWidth: 440, margin: "0 auto 28px", lineHeight: 1.6 }}>
          {interpolate(t.booking.successMsg, { barber: booked.barberLabel, date: s.dateLabel, time: s.timeLabel })}
        </p>

        {/* Appointment card */}
        <div className="bk-card" style={{ textAlign: "start", padding: 20, marginBottom: 20 }}>
          <p className="text-h2" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{s.timeLabel}</p>
          <p style={{ margin: "2px 0 16px", fontSize: 15, fontWeight: 500, color: "var(--color-ink-soft)" }}>{s.dateLabel}</p>
          <dl className="bk-summary-grid">
            {[
              { label: t.booking.barber, value: booked.barberLabel },
              { label: t.booking.total, value: s.amount },
            ].map((r) => (
              <div key={r.label} style={{ minWidth: 0 }}>
                <dt className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "0 0 2px" }}>{r.label}</dt>
                <dd style={{ fontSize: 15, fontWeight: 600, margin: 0, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{r.value}</dd>
              </div>
            ))}
          </dl>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: "var(--color-ink-soft)" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--color-ink)" }}>{shop.name}</p>
            {booked.servicesLabel && <p style={{ margin: 0 }}>{booked.servicesLabel}</p>}
            {shop.address && (
              <p style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                <MapPin size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "var(--color-ink-muted)" }} />
                <span>{shop.address}</span>
              </p>
            )}
          </div>
          <p className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "14px 0 0", paddingTop: 12, borderTop: "1px solid var(--color-line)" }}>
            {t.booking.reference}: <strong dir="ltr" style={{ color: "var(--color-ink)", letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>{s.ref}</strong>
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 28 }}>
          <button type="button" onClick={downloadIcs} className="bk-btn-secondary">
            <CalendarPlus size={18} aria-hidden="true" /> {t.booking.addToCalendar}
          </button>
          <a href={googleCalendarUrl(s.event)} target="_blank" rel="noopener noreferrer" className="bk-btn-secondary">
            <CalendarCheck size={18} aria-hidden="true" /> {t.booking.googleCalendar}
          </a>
        </div>

        {!rescheduled && (
          <div style={{ textAlign: "start", background: "var(--color-sunken)", borderRadius: 16, padding: "18px 20px", marginBottom: 28 }}>
            <h2 className="text-title" style={{ margin: "0 0 12px" }}>{t.booking.nextSteps}</h2>
            <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--color-ink-soft)", lineHeight: 1.55 }}>
              <li>{interpolate(t.booking.nextStepConfirm, { shop: shop.name, phone: normalizePhone(clientPhone) })}</li>
              <li>{t.booking.nextStepArrive}</li>
              <li>{interpolate(t.booking.nextStepPay, { amount: s.amount })}</li>
              <li>{isSignedIn ? t.booking.manageSignedIn : t.booking.manageGuest} {policyText}.</li>
            </ol>
          </div>
        )}
        {rescheduled && (
          <div style={{ maxWidth: 480, margin: "0 auto 24px" }}>
            <InlineAlert tone="info">{f.rescheduledNote}</InlineAlert>
          </div>
        )}

        <div className="bk-success-actions">
          {isSignedIn ? (
            <Link href={href("/customer")} className="bk-cta">
              <CalendarCheck size={18} aria-hidden="true" /> {t.booking.viewMyBookings}
            </Link>
          ) : (
            <Link href={href("/auth/signup")} className="bk-cta" aria-describedby="bk-account-hint">
              {t.booking.createAccount}
            </Link>
          )}
          {!isSignedIn && (
            <p id="bk-account-hint" className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "0 0 4px" }}>{t.booking.createAccountHint}</p>
          )}
          {(waHref || telHref) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="bk-btn-secondary">
                  <MessageCircle size={18} aria-hidden="true" /> {t.booking.messageShop}
                </a>
              )}
              {telHref && (
                <a href={telHref} className="bk-btn-secondary">
                  <Phone size={18} aria-hidden="true" /> {t.booking.callShop}
                </a>
              )}
            </div>
          )}
          <Link href={href(`/shop/${shop.id}`)} className="bk-btn-ghost">{t.booking.backToShop}</Link>
        </div>
      </div>
    </section>
  );
}
