"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { getPublicServices } from "@/lib/queries/services";
import { getAvailableSlots } from "@/lib/queries/appointments";
import { format, addDays, parseISO } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation, interpolate } from "@/hooks/use-translation";

type BookingStep = "landing" | "services" | "barber" | "datetime" | "confirm";

const FF = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";

// Mirrors the server-side pattern in src/app/api/booking/route.ts
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

// ─── Colour tokens (inline so Tailwind purging can't break them) ───
// Data Observatory on Cloud Paper palette — see design-system/clearbit-reference.md
const C = {
  black:   "#091135", // Midnight Ink — structural dark ink / primary text
  white:   "#ffffff", // Paper — card & canvas surfaces
  surface: "#f5f3ff", // Lavender Wash — section tint zones + repeated/structural selection state
  border:  "#e1e9f0", // Frost Border — hairline borders
  muted:   "#36394a", // Slate — secondary/muted text
  subtle:  "#36394a", // Slate — secondary/muted text
  mist:    "#b1bbcd", // Mist — soft secondary neutral, disabled states
  blue:    "#0f77ff", // Electric Blue — focus outline, checkmarks, star icon (never CTA fill)
  green:   "#127ee3", // Cobalt Surface — the single primary-CTA fill color
  yellow:  "#0f77ff", // Electric Blue — reused for star ratings
  red:     "#ba1a1a", // destructive/error — separate semantic channel
};

function generateDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date:   format(date, "MMM d"),
      day:    format(date, "EEE").toUpperCase(),
      full:   format(date, "yyyy-MM-dd"),
      dayNum: format(date, "d"),
    };
  });
}

function getServiceIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("beard") || n.includes("shave")) return "face";
  if (n.includes("color") || n.includes("dye"))  return "palette";
  if (n.includes("spa") || n.includes("facial")) return "spa";
  if (n.includes("keratin") || n.includes("treatment")) return "auto_awesome";
  if (n.includes("kid") || n.includes("child"))  return "child_care";
  return "content_cut";
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

interface ServiceRow { id: string; name: string; name_ar: string | null; duration: number; price: number; }
interface BarberRow  { id: string; full_name: string; barber_services?: { service_id: string }[]; }
// break_start/break_end are an optional recurring daily buffer (e.g. a prayer break) a barber
// can configure — nullable, so most rows simply won't have one set.
interface WorkingHourRow { barber_id: string; day_of_week: number; is_working: boolean; start_time: string; end_time: string; break_start?: string | null; break_end?: string | null; }
interface OccupiedSlotRow { start_time: string; end_time: string; }
interface ReviewRow { rating: number; }

// Builds a wa.me-compatible phone string from whatever format a shop owner typed into
// the WhatsApp settings field: strips everything but digits, and expands a local Jordanian
// "0-prefixed" number (e.g. 0791234567) to its international form (962791234567).
function toWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `962${digits.slice(1)}`;
  return digits;
}

// ─── Reusable inline-styled sub-components ───────────────────────

function StepLabel({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 8 }}>
      {text}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.014em", color: C.black, fontFamily: "var(--font-intervar),sans-serif", margin: "0 0 8px" }}>
      {children}
    </h1>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "sticky", bottom: 0,
      background: C.white,
      borderTop: `1px solid ${C.border}`,
      padding: "16px 0", marginTop: 24,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12,
      zIndex: 10,
    }}>
      {children}
    </div>
  );
}

function NavBtn({ onClick, icon }: { onClick: () => void; icon: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: C.white, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 120ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surface; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.white; }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.subtle }}>{icon}</span>
    </button>
  );
}

function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      padding: "40px 20px", textAlign: "center",
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 30, color: C.red }}>error_outline</span>
      <p style={{ fontSize: 14, color: C.muted, margin: 0, maxWidth: 320 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${C.border}`,
          background: C.white, color: C.black, fontWeight: 700, fontSize: 13,
          fontFamily: FF, cursor: "pointer",
        }}
      >
        {retryLabel}
      </button>
    </div>
  );
}

function NextBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 48, padding: "0 28px", borderRadius: 8,
        background: disabled ? C.border : C.green,
        color: disabled ? C.mist : C.white,
        fontWeight: 700, fontSize: 14, fontFamily: FF,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: 8,
        transition: "all 150ms ease",
        flexShrink: 0,
      }}
    >
      {children || <>Next <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></>}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────

export function BookingEngine({ shopId, rescheduleAppointmentId }: { shopId?: string; rescheduleAppointmentId?: string }) {
  const supabase = createClient();
  const { FF, dir, isRTL, t } = useTranslation();
  const searchParams = useSearchParams();

  // The reschedule context can arrive either as an explicit prop (same convention as
  // `shopId`) or as a `?reschedule=` URL search param — the customer pages link here with
  // the latter, since a page navigation can't hand off React props directly.
  const rescheduleId = rescheduleAppointmentId ?? searchParams?.get("reschedule") ?? null;

  const [step, setStep]  = useState<BookingStep>("landing");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarber,   setSelectedBarber]   = useState<string | null>(null);
  const [selectedDate,     setSelectedDate]      = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime,     setSelectedTime]      = useState<string | null>(null);
  const [clientName,       setClientName]        = useState("");
  const [clientPhone,      setClientPhone]       = useState("");
  const [booked,           setBooked]            = useState(false);
  const [submitting,       setSubmitting]        = useState(false);
  const [bookingError,     setBookingError]      = useState<string | null>(null);
  const [phoneTouched,     setPhoneTouched]      = useState(false);
  const [rescheduleWarning, setRescheduleWarning] = useState<string | null>(null);
  const phoneFormatValid = PHONE_REGEX.test(clientPhone.trim());

  const weekDays = useMemo(() => generateDays(14), []);
  const [resolvedShopId, setResolvedShopId] = useState(shopId ?? "");

  useEffect(() => {
    if (shopId) { setResolvedShopId(shopId); return; }
    supabase.from("shops").select("id").limit(1).single().then(({ data }) => {
      if (data) setResolvedShopId(data.id);
    });
  }, [shopId, supabase]);

  const { data: shopData } = useSupabaseQuery(
    async () => await supabase.from("shops").select("id, name, address, whatsapp").eq("id", resolvedShopId).single(),
    [resolvedShopId], { enabled: !!resolvedShopId }
  );
  const shop = shopData as { id: string; name: string; address: string; whatsapp: string | null } | null;

  // ─── Real shop rating (Tier 0 removed the fake one) ───
  const { data: reviewsData } = useSupabaseQuery<ReviewRow[]>(
    async () => await supabase.from("reviews").select("rating").eq("shop_id", resolvedShopId),
    [resolvedShopId], { enabled: !!resolvedShopId }
  );
  const reviewList = reviewsData ?? [];
  const numReviews = reviewList.length;
  const avgRating  = numReviews > 0 ? reviewList.reduce((a, r) => a + r.rating, 0) / numReviews : 0;

  const { data: services, loading: servicesLoading, error: servicesError, refetch: refetchServices } = useSupabaseQuery<ServiceRow[]>(
    () => getPublicServices(supabase, resolvedShopId),
    [resolvedShopId], { enabled: !!resolvedShopId }
  );

  const { data: barbers, loading: barbersLoading, error: barbersError, refetch: refetchBarbers } = useSupabaseQuery<BarberRow[]>(
    async () => {
      const r = await supabase.from("profiles").select("id, full_name, barber_services(service_id)").eq("shop_id", resolvedShopId).eq("role", "barber");
      return r as { data: BarberRow[] | null; error: { message: string } | null };
    },
    [resolvedShopId], { enabled: !!resolvedShopId }
  );

  const serviceList = services  ?? [];
  const barberList  = barbers   ?? [];

  // Only barbers who can perform every currently-selected service — unless a barber
  // has no barber_services rows at all, meaning capability data isn't populated for them.
  const filteredBarbers = useMemo(() => {
    if (selectedServices.length === 0) return barberList;
    return barberList.filter(b => {
      if (!b.barber_services || b.barber_services.length === 0) return true;
      return b.barber_services.some(bs => selectedServices.includes(bs.service_id));
    });
  }, [barberList, selectedServices]);

  const totalPrice    = serviceList.filter(s => selectedServices.includes(s.id)).reduce((a, s) => a + s.price, 0);
  const totalDuration = serviceList.filter(s => selectedServices.includes(s.id)).reduce((a, s) => a + s.duration, 0);
  const selectedBarberName = selectedBarber === "any" ? t.booking.anyBarber : barberList.find(b => b.id === selectedBarber)?.full_name;

  const { data: workingHoursRaw, error: workingHoursError, refetch: refetchWorkingHours } = useSupabaseQuery(
    async () => {
      const ids = barberList.map(b => b.id);
      if (!ids.length) return { data: [], error: null };
      // "*" already picks up break_start/break_end once that migration lands — no column
      // list to keep in sync here.
      return await supabase.from("working_hours").select("*").in("barber_id", ids) as { data: WorkingHourRow[] | null; error: { message: string } | null };
    },
    [barberList], { enabled: barberList.length > 0 && step === "datetime" }
  );

  // Only the specifically-chosen barber's hours count toward availability; "any" pools every barber.
  const barbersForAvailability = useMemo(() => (
    selectedBarber && selectedBarber !== "any" ? barberList.filter(b => b.id === selectedBarber) : barberList
  ), [barberList, selectedBarber]);

  const availableTimes = useMemo(() => {
    const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
    const toTimeStr = (mins: number) => `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
    const FALLBACK_START = 9 * 60;   // 09:00
    const FALLBACK_CLOSE = 18 * 60;  // 18:00 — matches the old generic list's last 17:30 slot + 30min

    if (!selectedDate) return [];

    const dayNum = new Date(selectedDate).getDay();
    const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const set = new Set<string>();

    // breakStart/breakEnd (minutes) are this specific barber's recurring daily buffer (e.g. a
    // prayer break) for the day — a slot whose service duration overlaps it is skipped for
    // THIS barber's contribution only, so pooling ("any barber") still surfaces the slot if
    // another barber is free then.
    const addWindow = (startMin: number, closeMin: number, breakStart?: number, breakEnd?: number) => {
      for (let m = startMin; m + totalDuration <= closeMin; m += 30) {
        if (isToday && m < nowMinutes) continue; // already passed
        if (breakStart != null && breakEnd != null && m < breakEnd && m + totalDuration > breakStart) continue;
        set.add(toTimeStr(m));
      }
    };

    if (!workingHoursRaw) {
      // Working-hours config hasn't loaded yet — show the generic window as a placeholder.
      addWindow(FALLBACK_START, FALLBACK_CLOSE);
      return Array.from(set).sort();
    }

    for (const b of barbersForAvailability) {
      const barberHours = (workingHoursRaw as WorkingHourRow[]).filter(x => x.barber_id === b.id);
      if (barberHours.length === 0) {
        // No working_hours rows at all for this barber — unconfigured, fall back to the generic window.
        addWindow(FALLBACK_START, FALLBACK_CLOSE);
        continue;
      }
      const h = barberHours.find(x => x.day_of_week === dayNum);
      if (!h || !h.is_working) continue; // explicitly closed, or no entry for this day — no slots
      const breakStart = h.break_start ? toMinutes(h.break_start) : undefined;
      const breakEnd   = h.break_end   ? toMinutes(h.break_end)   : undefined;
      addWindow(toMinutes(h.start_time), toMinutes(h.end_time), breakStart, breakEnd);
    }

    return Array.from(set).sort();
  }, [workingHoursRaw, selectedDate, barbersForAvailability, totalDuration]);

  const { data: occupiedSlots, loading: slotsLoading, error: slotsError, refetch: refetchSlots } = useSupabaseQuery(
    () => getAvailableSlots(supabase, resolvedShopId, selectedDate, selectedBarber !== "any" ? selectedBarber ?? undefined : undefined),
    [resolvedShopId, selectedDate, selectedBarber], { enabled: !!resolvedShopId && step === "datetime" }
  );

  const occupiedTimeSet = useMemo(() => {
    const set = new Set<string>();
    if (!occupiedSlots) return set;
    (occupiedSlots as OccupiedSlotRow[]).forEach(slot => {
      const start = parseISO(slot.start_time);
      const end   = parseISO(slot.end_time);
      for (const time of availableTimes) {
        const [h, m] = time.split(":").map(Number);
        const s = new Date(start); s.setHours(h, m, 0, 0);
        const e = new Date(s); e.setMinutes(e.getMinutes() + 30);
        if (s < end && e > start) set.add(time);
      }
    });
    return set;
  }, [occupiedSlots, availableTimes]);

  const morningTimes   = availableTimes.filter(t => parseInt(t) < 12);
  const afternoonTimes = availableTimes.filter(t => parseInt(t) >= 12);

  // ─── WhatsApp confirmation deep link (shop's number, prefilled message) ───
  const waNumber = useMemo(() => (shop?.whatsapp ? toWhatsAppNumber(shop.whatsapp) : null), [shop?.whatsapp]);
  const waMessage = useMemo(() => {
    const chosenServices = serviceList.filter(s => selectedServices.includes(s.id))
      .map(s => (isRTL && s.name_ar ? s.name_ar : s.name)).join(", ");
    const dateStr = format(new Date(selectedDate), "MMM d, yyyy");
    const timeStr = selectedTime ? formatTime(selectedTime) : "";
    return isRTL
      ? `مرحباً ${shop?.name || ""}، أؤكد حجزي:\nالخدمة: ${chosenServices}\nالتاريخ: ${dateStr}\nالوقت: ${timeStr}\nالسعر: ${totalPrice.toFixed(2)} د.أ`
      : `Hi ${shop?.name || ""}, confirming my booking:\nService: ${chosenServices}\nDate: ${dateStr}\nTime: ${timeStr}\nPrice: ${totalPrice.toFixed(2)} JOD`;
  }, [serviceList, selectedServices, selectedDate, selectedTime, isRTL, shop?.name, totalPrice]);

  const handleBooking = async () => {
    setSubmitting(true); setBookingError(null); setRescheduleWarning(null);
    try {
      const start = new Date(`${selectedDate}T${selectedTime}:00`);
      const end   = new Date(start.getTime() + totalDuration * 60000);
      const res = await fetch("/api/booking", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: resolvedShopId, clientName: clientName.trim(),
          clientPhone: clientPhone.trim().replace(/\s/g, ""),
          serviceIds: selectedServices, barberId: selectedBarber === "any" ? null : selectedBarber,
          startTime: start.toISOString(), endTime: end.toISOString(),
          totalPrice, source: "online",
        }),
      });
      const result = await res.json();
      if (result.error || (!result.success && !result.appointment_id)) {
        setBookingError(result.error || "Something went wrong. Please try again."); return;
      }

      // Atomic reschedule: the new booking now exists — release the old one too. If that
      // fails, the new booking still stands; we just tell the customer honestly so they
      // don't end up with two active appointments without knowing it.
      if (rescheduleId) {
        try {
          const cancelRes = await fetch("/api/booking/cancel", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointment_id: rescheduleId }),
          });
          const cancelResult = await cancelRes.json();
          if (!cancelRes.ok || !cancelResult.success) {
            setRescheduleWarning(isRTL
              ? "تم تأكيد موعدك الجديد، لكن تعذّر إلغاء موعدك القديم تلقائياً. يرجى إلغاؤه يدوياً من صفحة مواعيدي."
              : "Your new appointment is confirmed, but we couldn't automatically cancel your previous booking. Please cancel it manually from My Bookings.");
          }
        } catch {
          setRescheduleWarning(isRTL
            ? "تم تأكيد موعدك الجديد، لكن تعذّر إلغاء موعدك القديم تلقائياً. يرجى إلغاؤه يدوياً من صفحة مواعيدي."
            : "Your new appointment is confirmed, but we couldn't automatically cancel your previous booking. Please cancel it manually from My Bookings.");
        }
      }

      setBooked(true);
    } catch {
      setBookingError("Unable to connect. Please check your internet and try again.");
    } finally { setSubmitting(false); }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", fontFamily: FF, color: C.black, maxWidth: 720, margin: "0 auto", direction: dir }}>
      <AnimatePresence mode="wait">

        {/* ══════════════ STEP 1 — LANDING ══════════════ */}
        {step === "landing" && (
          <motion.div key="landing"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}
          >
            <div style={{
              background: C.white, borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: "48px 40px",
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            }}>
              {/* Icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 12,
                background: C.black, display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 28,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: C.white, fontVariationSettings: "'FILL' 1" }}>content_cut</span>
              </div>

              <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.014em", fontFamily: "var(--font-intervar),sans-serif", margin: "0 0 8px" }}>
                {t.booking.bookAppointment}
              </h2>
              <p style={{ fontSize: 14, color: C.subtle, marginBottom: numReviews > 0 ? 10 : 36, display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                {shop?.name || "Halaqy Studio"}{shop?.address ? `, ${shop.address}` : ""}
              </p>

              {numReviews > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 36 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <span
                      key={s}
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 15, color: s <= Math.round(avgRating) ? C.blue : C.border,
                        fontVariationSettings: s <= Math.round(avgRating) ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >star</span>
                  ))}
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.black, marginLeft: 2 }}>{avgRating.toFixed(1)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>({numReviews} {t.booking.reviews})</span>
                </div>
              )}

              {/* Features */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
                {[
                  { icon: "timer",           title: "Quick booking",       sub: "Under 1 minute to secure your slot" },
                  { icon: "payments",        title: "Pay in shop",         sub: "No upfront charges today" },
                  { icon: "event_available", title: "Free cancellation",   sub: "Change or cancel anytime" },
                ].map(f => (
                  <div key={f.icon} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 20px", background: C.surface, borderRadius: 12,
                    textAlign: "left", border: `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: C.white,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      border: `1px solid ${C.border}`,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.black }}>{f.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.black, margin: "0 0 2px" }}>{f.title}</p>
                      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep("services")}
                style={{
                  width: "100%", height: 52,
                  background: C.green, color: C.white,
                  borderRadius: 8, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 15, fontFamily: FF,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                {t.booking.bookAppointment}
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{isRTL ? 'arrow_back' : 'arrow_forward'}</span>
              </button>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>By continuing, you agree to our Terms of Service</p>
            </div>
          </motion.div>
        )}

        {/* ══════════════ STEP 2 — SERVICES ══════════════ */}
        {step === "services" && (
          <motion.div key="services"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: 32 }}>
              <StepLabel text={`${t.booking.step} 1 ${t.booking.of} 4 · ${t.booking.services}`} />
              <SectionTitle>{t.booking.selectServices}</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}></p>
            </div>

            {servicesLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: C.muted, animation: "spin 1s linear infinite" }}>refresh</span>
              </div>
            ) : servicesError ? (
              <ErrorState message={t.error.message} onRetry={refetchServices} retryLabel={t.error.tryAgain} />
            ) : serviceList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: 14 }}>{t.common.noData}</div>
            ) : (
              <div className="booking-service-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
                {serviceList.map(service => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => setSelectedServices(prev => isSelected ? prev.filter(id => id !== service.id) : [...prev, service.id])}
                      style={{
                        padding: "20px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                        border: isSelected ? `2px solid ${C.black}` : `1.5px solid ${C.border}`,
                        background: isSelected ? C.surface : C.white,
                        transition: "all 140ms ease",
                        display: "flex", flexDirection: "column", gap: 12,
                        fontFamily: FF,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                          background: isSelected ? C.black : C.surface,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 140ms ease",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: isSelected ? C.white : C.subtle }}>{getServiceIcon(service.name)}</span>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: isSelected ? "none" : `2px solid ${C.border}`,
                          background: isSelected ? C.blue : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {isSelected && <span className="material-symbols-outlined" style={{ fontSize: 13, color: C.white, fontVariationSettings: "'wght' 700" }}>check</span>}
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: C.black, margin: "0 0 3px", letterSpacing: "0.008em" }}>
                          {isRTL && service.name_ar ? service.name_ar : service.name}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                            {service.duration} {isRTL ? "دقيقة" : "min"}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.black }}>{service.price.toFixed(2)} {isRTL ? "د.أ" : "JOD"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <BottomBar>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: C.black }}>{totalPrice.toFixed(2)} {isRTL ? "د.أ" : "JOD"}</span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{t.booking.total}</span>
                </div>
                {selectedServices.length > 0 && (
                  <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>
                    {selectedServices.length} {t.booking.service} · {totalDuration} min
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <NavBtn onClick={() => setStep("landing")} icon="arrow_back" />
                <NextBtn onClick={() => setStep("barber")} disabled={selectedServices.length === 0} />
              </div>
            </BottomBar>
          </motion.div>
        )}

        {/* ══════════════ STEP 3 — BARBER ══════════════ */}
        {step === "barber" && (
          <motion.div key="barber"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: 28 }}>
              <StepLabel text={`${t.booking.step} 2 ${t.booking.of} 4 · ${t.booking.chooseBarber}`} />
              <SectionTitle>{t.booking.chooseBarber}</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}></p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 28 }}>
              {/* Any barber option */}
              <button
                onClick={() => { setSelectedBarber("any"); setStep("datetime"); }}
                style={{
                  padding: "24px 20px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                  border: selectedBarber === "any" ? `2px solid ${C.black}` : `1.5px solid ${C.border}`,
                  background: selectedBarber === "any" ? C.surface : C.white,
                  display: "flex", flexDirection: "column", gap: 12, fontFamily: FF,
                  transition: "all 140ms ease",
                }}
              >
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.surface, border: `2px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: C.muted }}>group</span>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: C.black, margin: "0 0 4px" }}>{t.booking.anyBarber}</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{t.booking.anyBarberDesc}</p>
                </div>
              </button>

              {barbersLoading ? (
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: "32px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: C.muted, animation: "spin 1s linear infinite" }}>refresh</span>
                </div>
              ) : barbersError ? (
                <div style={{ gridColumn: "1 / -1" }}>
                  <ErrorState message={t.error.message} onRetry={refetchBarbers} retryLabel={t.error.tryAgain} />
                </div>
              ) : barberList.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px 0", color: C.muted, fontSize: 13 }}>{t.common.noData}</div>
              ) : filteredBarbers.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px 0", color: C.muted, fontSize: 13 }}>
                  {isRTL ? "لا يوجد حلاق متاح لهذه الخدمة" : "No barber available for this service"}
                </div>
              ) : (
                filteredBarbers.map(barber => (
                  <button
                    key={barber.id}
                    onClick={() => { setSelectedBarber(barber.id); setStep("datetime"); }}
                    style={{
                      padding: "24px 20px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                      border: selectedBarber === barber.id ? `2px solid ${C.black}` : `1.5px solid ${C.border}`,
                      background: selectedBarber === barber.id ? C.surface : C.white,
                      display: "flex", flexDirection: "column", gap: 12, fontFamily: FF,
                      transition: "all 140ms ease",
                    }}
                  >
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.black, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: C.white }}>{barber.full_name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 800, color: C.black, margin: "0 0 4px" }}>{barber.full_name}</p>
                      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Master Barber</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Selection summary */}
            {selectedServices.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: 6 }}>Your Selection</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.black, marginBottom: 4 }}>
                  {serviceList.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(", ")}
                </p>
                <p style={{ fontSize: 12, color: C.muted }}>
                  {totalDuration} min · {totalPrice.toFixed(2)} JOD
                </p>
              </div>
            )}

            <button
              onClick={() => setStep("services")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.subtle, fontFamily: FF }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              Back to Services
            </button>
          </motion.div>
        )}

        {/* ══════════════ STEP 4 — DATETIME ══════════════ */}
        {step === "datetime" && (
          <motion.div key="datetime"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: 28 }}>
              <StepLabel text={`${t.booking.step} 3 ${t.booking.of} 4 · ${t.booking.pickDateTime}`} />
              <SectionTitle>{t.booking.pickDateTime}</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}></p>
            </div>

            {/* Date scroller */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>Select Date</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>
                  {format(new Date(selectedDate), "MMMM yyyy")}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
                {weekDays.map(d => (
                  <button
                    key={d.full}
                    onClick={() => { setSelectedDate(d.full); setSelectedTime(null); }}
                    style={{
                      width: 60, minHeight: 76, borderRadius: 8, flexShrink: 0,
                      border: selectedDate === d.full ? "none" : `1.5px solid ${C.border}`,
                      background: selectedDate === d.full ? C.surface : C.white,
                      color: C.black,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                      cursor: "pointer", transition: "all 120ms ease", fontFamily: FF,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, opacity: selectedDate === d.full ? 0.6 : 1, letterSpacing: "0.06em" }}>{d.day}</span>
                    <span style={{ fontSize: 20, fontWeight: 900 }}>{d.dayNum}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time slots */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{t.booking.availableTimes}</span>
                <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 600, color: C.muted }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.border, display: "inline-block" }} />Free
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.black, display: "inline-block" }} />Selected
                  </span>
                </div>
              </div>

              {(workingHoursError || slotsError) ? (
                <ErrorState
                  message={t.error.message}
                  onRetry={() => { refetchWorkingHours(); refetchSlots(); }}
                  retryLabel={t.error.tryAgain}
                />
              ) : slotsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: C.muted, animation: "spin 1s linear infinite" }}>refresh</span>
                </div>
              ) : availableTimes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>
                  {isRTL ? "لا توجد أوقات متاحة في هذا اليوم" : "No available times for this day"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {morningTimes.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 10 }}>Morning</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {morningTimes.map(time => {
                          const isOccupied = occupiedTimeSet.has(time);
                          const isSelected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              disabled={isOccupied}
                              onClick={() => setSelectedTime(time)}
                              style={{
                                padding: "12px 0", borderRadius: 8, border: "2px solid",
                                borderColor: isSelected ? C.black : C.border,
                                background: isSelected ? C.surface : isOccupied ? C.border : C.white,
                                color: isSelected ? C.black : isOccupied ? C.muted : C.black,
                                fontSize: 13, fontWeight: isOccupied ? 500 : 700, fontFamily: FF,
                                cursor: isOccupied ? "not-allowed" : "pointer",
                                transition: "all 120ms ease",
                              }}
                            >{formatTime(time)}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {afternoonTimes.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 10 }}>Afternoon</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {afternoonTimes.map(time => {
                          const isOccupied = occupiedTimeSet.has(time);
                          const isSelected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              disabled={isOccupied}
                              onClick={() => setSelectedTime(time)}
                              style={{
                                padding: "12px 0", borderRadius: 8, border: "2px solid",
                                borderColor: isSelected ? C.black : C.border,
                                background: isSelected ? C.surface : isOccupied ? C.border : C.white,
                                color: isSelected ? C.black : isOccupied ? C.muted : C.black,
                                fontSize: 13, fontWeight: isOccupied ? 500 : 700, fontFamily: FF,
                                cursor: isOccupied ? "not-allowed" : "pointer",
                                transition: "all 120ms ease",
                              }}
                            >{formatTime(time)}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <BottomBar>
              <div>
                {selectedTime ? (
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.black, margin: 0 }}>
                    <span style={{ color: C.muted, fontWeight: 500 }}>Selected · </span>
                    {format(new Date(selectedDate), "EEE, MMM d")} · {formatTime(selectedTime)}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Pick a time above</p>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <NavBtn onClick={() => setStep("barber")} icon="arrow_back" />
                <NextBtn onClick={() => setStep("confirm")} disabled={!selectedTime} />
              </div>
            </BottomBar>
          </motion.div>
        )}

        {/* ══════════════ STEP 5 — CONFIRM ══════════════ */}
        {step === "confirm" && !booked && (
          <motion.div key="confirm"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: 28 }}>
              <StepLabel text={`${t.booking.step} 4 ${t.booking.of} 4 · ${t.booking.confirmBooking}`} />
              <SectionTitle>{t.booking.confirmBooking}</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}></p>
            </div>

            {/* Two-column layout on larger screens, single column on small */}
            <div className="booking-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>

              {/* Left: forms */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_outline</span>
                    Your Information
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { label: t.booking.yourName,     value: clientName,  setter: setClientName,  type: "text", placeholder: "Your name" },
                      { label: t.booking.phoneNumber,  value: clientPhone, setter: setClientPhone, type: "tel",  placeholder: "+962 ..." },
                    ].map(field => {
                      const isPhone = field.type === "tel";
                      const phoneShowsError = isPhone && phoneTouched && field.value.trim().length > 0 && !PHONE_REGEX.test(field.value.trim());
                      return (
                      <div key={field.label}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 6 }}>
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={field.value}
                          onChange={e => field.setter(e.target.value)}
                          style={{
                            width: "100%", height: 48, padding: "0 16px",
                            borderRadius: 8, border: `1.5px solid ${phoneShowsError ? C.red : C.border}`,
                            background: C.white, fontSize: 14, fontWeight: 500,
                            color: C.black, outline: "none", fontFamily: FF,
                            boxSizing: "border-box", transition: "all 150ms ease",
                          }}
                          onFocus={e => { e.target.style.borderColor = C.blue; e.target.style.background = C.white; e.target.style.boxShadow = "var(--shadow-focus)"; }}
                          onBlur={e => { if (isPhone) setPhoneTouched(true); e.target.style.borderColor = phoneShowsError ? C.red : C.border; e.target.style.background = C.white; e.target.style.boxShadow = "none"; }}
                        />
                        {phoneShowsError && (
                          <p style={{ fontSize: 12, color: C.red, margin: "6px 0 0" }}>
                            {isRTL ? "أدخل رقم هاتف صالح (٧-٢٠ أرقام)" : "Enter a valid phone number (7–20 digits)"}
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment notice */}
                <div style={{
                  display: "flex", gap: 16, padding: "18px 20px",
                  background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.blue, flexShrink: 0 }}>payments</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.black, margin: "0 0 4px" }}>No payment today</p>
                    <p style={{ fontSize: 12, color: C.subtle, margin: 0, lineHeight: 1.5 }}>
                      {interpolate(t.booking.paymentNotice, { amount: totalPrice.toFixed(2) })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: summary card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, position: "sticky", top: 88, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: C.black, letterSpacing: "0.01em", margin: 0 }}>Summary</h3>
                  <span style={{ fontSize: 10, fontWeight: 700, background: C.black, color: C.white, padding: "3px 10px", borderRadius: 9999, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Estimated
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {serviceList.filter(s => selectedServices.includes(s.id)).map(s => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 12, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.subtle }}>{getServiceIcon(s.name)}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.black, margin: 0 }}>{s.name}</p>
                          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{s.duration} min</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.price.toFixed(2)} JOD</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 16, paddingBottom: 16, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
                  {[
                    { label: "Barber",    value: selectedBarberName || "Any" },
                    { label: "Date",      value: format(new Date(selectedDate), "MMM d, yyyy") },
                    { label: "Time",      value: selectedTime ? formatTime(selectedTime) : "—" },
                    { label: "Duration",  value: `${totalDuration} min` },
                  ].map(r => (
                    <div key={r.label}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, margin: "0 0 3px" }}>{r.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.black, margin: 0 }}>{r.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted }}>{t.booking.total}</span>
                  <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.016em", color: C.black }}>{totalPrice.toFixed(2)} JOD</span>
                </div>

                {bookingError && (
                  <div style={{ padding: "12px 16px", background: "#fee2e2", borderRadius: 12, fontSize: 13, color: C.red, marginBottom: 16 }}>
                    {bookingError}
                  </div>
                )}

                <button
                  disabled={!clientName.trim() || !clientPhone.trim() || !phoneFormatValid || submitting}
                  onClick={handleBooking}
                  style={{
                    width: "100%", height: 52,
                    background: (!clientName.trim() || !clientPhone.trim() || !phoneFormatValid || submitting) ? C.border : C.green,
                    color: (!clientName.trim() || !clientPhone.trim() || !phoneFormatValid || submitting) ? C.mist : C.white, borderRadius: 8, border: "none",
                    fontWeight: 700, fontSize: 15, fontFamily: FF,
                    cursor: (!clientName.trim() || !clientPhone.trim() || !phoneFormatValid || submitting) ? "not-allowed" : "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  {submitting ? "Processing…" : t.booking.confirmBtn}
                </button>
                <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>
                  By confirming you agree to our Terms & Privacy Policy.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep("datetime")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.subtle, fontFamily: FF, marginTop: 24 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              Back
            </button>
          </motion.div>
        )}

        {/* ══════════════ SUCCESS ══════════════ */}
        {booked && (
          <motion.div key="booked"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div style={{
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "56px 40px", textAlign: "center",
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%", background: C.blue,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 44, color: C.white, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "0.018em", fontFamily: "var(--font-intervar),sans-serif", margin: "0 0 12px" }}>
                {t.booking.allSet}
              </h2>
              <p style={{ fontSize: 16, color: C.subtle, marginBottom: 36, maxWidth: 400, margin: "0 auto 36px" }}>
                {interpolate(t.booking.confirmationMsg, {
                  barber: selectedBarberName || t.booking.anyBarber,
                  date: format(new Date(selectedDate), "MMM d, yyyy"),
                  time: selectedTime ? formatTime(selectedTime) : "",
                })}
              </p>

              {rescheduleWarning && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "14px 16px", background: "#fee2e2", borderRadius: 12,
                  fontSize: 13, color: C.red, marginBottom: 24, maxWidth: 480, marginLeft: "auto", marginRight: "auto",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, flexShrink: 0 }}>warning</span>
                  {rescheduleWarning}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 32, textAlign: "left" }}>
                {[
                  { label: "Barber",  value: selectedBarberName || "Any" },
                  { label: "Date",    value: format(new Date(selectedDate), "MMM d") },
                  { label: "Time",    value: selectedTime ? formatTime(selectedTime) : "" },
                  { label: t.booking.total, value: `${totalPrice.toFixed(2)} JOD` },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, margin: "0 0 4px" }}>{r.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.black, margin: 0 }}>{r.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/customer" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "13px 28px", borderRadius: 8,
                  background: C.green, color: C.white,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event_note</span>
                  View My Bookings
                </Link>
                <Link href="/explore" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "13px 28px", borderRadius: 8,
                  background: C.white, color: C.black, border: `1px solid ${C.border}`,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}>
                  Explore More
                </Link>
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "13px 28px", borderRadius: 8,
                      background: C.white, color: C.black, border: `1px solid ${C.border}`,
                      fontWeight: 700, fontSize: 14, textDecoration: "none",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#25D366" }}>chat</span>
                    {isRTL ? "إرسال التأكيد عبر واتساب" : "Send confirmation via WhatsApp"}
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .booking-two-col { grid-template-columns: 1fr !important; }
          .booking-service-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
