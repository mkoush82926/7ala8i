"use client";

// Confirmation screen: summary, reference, add-to-calendar, next steps and
// contact actions (WhatsApp / call). Shown after a booking or a reschedule.

import React, { useMemo } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, CheckCircle2, MessageCircle, Phone } from "lucide-react";
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
  const { t, locale, isRTL, href, formatDate, formatTime } = useTranslation();
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
    ? interpolate(t.booking.freeCancellationHours, { hours: String(policyHours) })
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
    <section aria-labelledby="bk-success-title">
      <div className="bk-card bk-success">
        <div
          aria-hidden="true"
          style={{
            width: 72, height: 72, borderRadius: "50%", background: "var(--accent-brass)", color: "var(--on-accent)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}
        >
          <CheckCircle2 size={36} />
        </div>
        <h1
          id="bk-success-title"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "clamp(26px, 6vw, 36px)", fontWeight: 900, letterSpacing: headingTracking(isRTL, "0.018em"), margin: "0 0 10px", outline: "none" }}
        >
          {rescheduled ? f.rescheduledTitle : t.booking.allSet}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.6 }}>
          {interpolate(t.booking.successMsg, { barber: booked.barberLabel, date: s.dateLabel, time: s.timeLabel })}
        </p>

        <dl className="bk-summary-grid">
          {[
            { label: t.booking.barber, value: booked.barberLabel },
            { label: t.booking.dateLabel, value: formatDate(s.start, { day: "numeric", month: "short", timeZone }) },
            { label: t.booking.timeLabel, value: s.timeLabel },
            { label: t.booking.total, value: s.amount },
          ].map((r) => (
            <div key={r.label}>
              <dt style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", margin: "0 0 4px" }}>{r.label}</dt>
              <dd style={{ fontSize: 14, fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "-8px 0 24px" }}>
          {t.booking.reference}: <strong dir="ltr" style={{ color: "var(--text-primary)", letterSpacing: "0.06em" }}>{s.ref}</strong>
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 28 }}>
          <button type="button" onClick={downloadIcs} className="bk-btn-secondary">
            <CalendarPlus size={16} aria-hidden="true" /> {t.booking.addToCalendar}
          </button>
          <a href={googleCalendarUrl(s.event)} target="_blank" rel="noopener noreferrer" className="bk-btn-secondary">
            <CalendarCheck size={16} aria-hidden="true" /> {t.booking.googleCalendar}
          </a>
        </div>

        {!rescheduled && (
          <div style={{ textAlign: "start", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "18px 20px", marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>{t.booking.nextSteps}</h2>
            <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
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
              <CalendarCheck size={16} aria-hidden="true" /> {t.booking.viewMyBookings}
            </Link>
          ) : (
            <Link href={href("/auth/signup")} className="bk-cta" aria-describedby="bk-account-hint">
              {t.booking.createAccount}
            </Link>
          )}
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="bk-btn-secondary">
              <MessageCircle size={16} aria-hidden="true" /> {t.booking.messageShop}
            </a>
          )}
          {telHref && (
            <a href={telHref} className="bk-btn-secondary">
              <Phone size={16} aria-hidden="true" /> {t.booking.callShop}
            </a>
          )}
          <Link href={href(`/shop/${shop.id}`)} className="bk-btn-ghost">{t.booking.backToShop}</Link>
        </div>
        {!isSignedIn && (
          <p id="bk-account-hint" style={{ fontSize: 12, color: "var(--text-muted)", margin: "12px 0 0" }}>{t.booking.createAccountHint}</p>
        )}
      </div>
    </section>
  );
}
