"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { getPublicServices } from "@/lib/queries/services";
import { getAvailableSlots } from "@/lib/queries/appointments";
import { format, addDays, parseISO } from "date-fns";
import Link from "next/link";

type BookingStep = "landing" | "services" | "barber" | "datetime" | "confirm";

const FF = "'Cairo','Segoe UI',Tahoma,Arial,sans-serif";

// ─── Colour tokens (inline so Tailwind purging can't break them) ───
const C = {
  black:   "#111827",
  white:   "#ffffff",
  surface: "#f9fafb",
  border:  "#e5e7eb",
  muted:   "#9ca3af",
  subtle:  "#6b7280",
  green:   "#10b981",
  yellow:  "#f59e0b",
  red:     "#ef4444",
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
    <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.035em", color: C.black, fontFamily: "'Manrope',system-ui,sans-serif", margin: "0 0 8px" }}>
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
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: C.surface, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 120ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f0f0f0"; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.subtle }}>{icon}</span>
    </button>
  );
}

function NextBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 48, padding: "0 28px", borderRadius: 12,
        background: disabled ? "#d1d5db" : C.black,
        color: C.white,
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

export function BookingEngine({ shopId }: { shopId?: string }) {
  const supabase = createClient();

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

  const weekDays = useMemo(() => generateDays(14), []);
  const [resolvedShopId, setResolvedShopId] = useState(shopId ?? "");

  useEffect(() => {
    if (shopId) { setResolvedShopId(shopId); return; }
    supabase.from("shops").select("id").limit(1).single().then(({ data }) => {
      if (data) setResolvedShopId(data.id);
    });
  }, [shopId, supabase]);

  const { data: shopData } = useSupabaseQuery(
    async () => await supabase.from("shops").select("id, name, address").eq("id", resolvedShopId).single(),
    [resolvedShopId], { enabled: !!resolvedShopId }
  );
  const shop = shopData as { id: string; name: string; address: string } | null;

  const { data: services, loading: servicesLoading } = useSupabaseQuery<ServiceRow[]>(
    () => getPublicServices(supabase, resolvedShopId),
    [resolvedShopId], { enabled: !!resolvedShopId }
  );

  const { data: barbers } = useSupabaseQuery<BarberRow[]>(
    async () => {
      const r = await supabase.from("profiles").select("id, full_name").eq("shop_id", resolvedShopId).eq("role", "barber");
      return r as { data: BarberRow[] | null; error: { message: string } | null };
    },
    [resolvedShopId], { enabled: !!resolvedShopId }
  );

  const serviceList = services  ?? [];
  const barberList  = barbers   ?? [];

  const { data: workingHoursRaw } = useSupabaseQuery(
    async () => {
      const ids = barberList.map(b => b.id);
      if (!ids.length) return { data: [], error: null };
      return await supabase.from("working_hours").select("*").in("barber_id", ids) as any;
    },
    [barberList], { enabled: barberList.length > 0 && step === "datetime" }
  );

  const availableTimes = useMemo(() => {
    const fallback = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];
    if (!workingHoursRaw || !selectedDate) return fallback;
    const dayNum = new Date(selectedDate).getDay();
    const set = new Set<string>();
    for (const b of barberList) {
      const h = (workingHoursRaw as any[]).find(x => x.barber_id === b.id && x.day_of_week === dayNum);
      if (!h) { fallback.forEach(t => set.add(t)); continue; }
      if (!h.is_working) continue;
      const [sh, sm] = h.start_time.split(":").map(Number);
      const [eh, em] = h.end_time.split(":").map(Number);
      for (let m = sh * 60 + sm; m < eh * 60 + em; m += 30) {
        set.add(`${Math.floor(m/60).toString().padStart(2,"0")}:${(m%60).toString().padStart(2,"0")}`);
      }
    }
    const arr = Array.from(set).sort();
    return arr.length ? arr : fallback;
  }, [workingHoursRaw, selectedDate, barberList]);

  const { data: occupiedSlots, loading: slotsLoading } = useSupabaseQuery(
    () => getAvailableSlots(supabase, resolvedShopId, selectedDate, selectedBarber !== "any" ? selectedBarber ?? undefined : undefined),
    [resolvedShopId, selectedDate, selectedBarber], { enabled: !!resolvedShopId && step === "datetime" }
  );

  const occupiedTimeSet = useMemo(() => {
    const set = new Set<string>();
    if (!occupiedSlots) return set;
    (occupiedSlots as any[]).forEach(slot => {
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

  const totalPrice    = serviceList.filter(s => selectedServices.includes(s.id)).reduce((a, s) => a + s.price, 0);
  const totalDuration = serviceList.filter(s => selectedServices.includes(s.id)).reduce((a, s) => a + s.duration, 0);
  const selectedBarberName = selectedBarber === "any" ? "Any Available Barber" : barberList.find(b => b.id === selectedBarber)?.full_name;

  const morningTimes   = availableTimes.filter(t => parseInt(t) < 12);
  const afternoonTimes = availableTimes.filter(t => parseInt(t) >= 12);

  const handleBooking = async () => {
    setSubmitting(true); setBookingError(null);
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
      setBooked(true);
    } catch {
      setBookingError("Unable to connect. Please check your internet and try again.");
    } finally { setSubmitting(false); }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", fontFamily: FF, color: C.black, maxWidth: 720, margin: "0 auto" }}>
      <AnimatePresence mode="wait">

        {/* ══════════════ STEP 1 — LANDING ══════════════ */}
        {step === "landing" && (
          <motion.div key="landing"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}
          >
            <div style={{
              background: C.white, borderRadius: 24,
              border: `1px solid ${C.border}`,
              boxShadow: "0 4px 40px rgba(0,0,0,0.07)",
              padding: "48px 40px",
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            }}>
              {/* Icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 20,
                background: C.black, display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 28, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: C.white, fontVariationSettings: "'FILL' 1" }}>content_cut</span>
              </div>

              <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.035em", fontFamily: "'Manrope',system-ui,sans-serif", margin: "0 0 8px" }}>
                Book Appointment
              </h2>
              <p style={{ fontSize: 14, color: C.subtle, marginBottom: 6, display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                {shop?.name || "Halaqy Studio"}{shop?.address ? `, ${shop.address}` : ""}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", padding: "6px 14px", borderRadius: 9999, marginBottom: 36 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: C.yellow, fontVariationSettings: "'FILL' 1" }}>star</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>4.8</span>
                <span style={{ fontSize: 12, color: C.muted }}>(127 reviews)</span>
              </div>

              {/* Features */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
                {[
                  { icon: "timer",           title: "Quick booking",       sub: "Under 1 minute to secure your slot" },
                  { icon: "payments",        title: "Pay in shop",         sub: "No upfront charges today" },
                  { icon: "event_available", title: "Free cancellation",   sub: "Change or cancel anytime" },
                ].map(f => (
                  <div key={f.icon} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 20px", background: C.surface, borderRadius: 14,
                    textAlign: "left", border: `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: C.white,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.07)", flexShrink: 0,
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
                  background: C.black, color: C.white,
                  borderRadius: 14, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 15, fontFamily: FF,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.black; e.currentTarget.style.transform = "none"; }}
              >
                Book Appointment
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
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
              <StepLabel text="Step 1 of 4 · Services" />
              <SectionTitle>Select Services</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>Choose one or more treatments. Multiple selections are supported.</p>
            </div>

            {servicesLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: C.muted, animation: "spin 1s linear infinite" }}>refresh</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
                {serviceList.map(service => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => setSelectedServices(prev => isSelected ? prev.filter(id => id !== service.id) : [...prev, service.id])}
                      style={{
                        padding: "20px", borderRadius: 16, textAlign: "left", cursor: "pointer",
                        border: isSelected ? `2px solid ${C.black}` : `1.5px solid ${C.border}`,
                        background: isSelected ? "#f9fafb" : C.white,
                        boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.06)" : "0 1px 4px rgba(0,0,0,0.04)",
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
                          background: isSelected ? C.black : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {isSelected && <span className="material-symbols-outlined" style={{ fontSize: 13, color: C.white, fontVariationSettings: "'wght' 700" }}>check</span>}
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: C.black, margin: "0 0 3px", letterSpacing: "-0.01em" }}>{service.name}</p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                            {service.duration} min
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.black }}>{service.price.toFixed(2)} JOD</span>
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
                  <span style={{ fontSize: 22, fontWeight: 900, color: C.black }}>{totalPrice.toFixed(2)} JOD</span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Total</span>
                </div>
                {selectedServices.length > 0 && (
                  <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>
                    {selectedServices.length} service{selectedServices.length > 1 ? "s" : ""} · {totalDuration} min
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
              <StepLabel text="Step 2 of 4 · Select Professional" />
              <SectionTitle>The Hands Behind<br />The Craft.</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>Choose your preferred barber or go with any available.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 28 }}>
              {/* Any barber option */}
              <button
                onClick={() => { setSelectedBarber("any"); setStep("datetime"); }}
                style={{
                  padding: "24px 20px", borderRadius: 16, textAlign: "left", cursor: "pointer",
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
                  <p style={{ fontSize: 15, fontWeight: 800, color: C.black, margin: "0 0 4px" }}>Any Available</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Best for immediate availability</p>
                </div>
              </button>

              {barberList.map(barber => (
                <button
                  key={barber.id}
                  onClick={() => { setSelectedBarber(barber.id); setStep("datetime"); }}
                  style={{
                    padding: "24px 20px", borderRadius: 16, textAlign: "left", cursor: "pointer",
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
              ))}
            </div>

            {/* Selection summary */}
            {selectedServices.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
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
              <StepLabel text="Step 3 of 4 · Date & Time" />
              <SectionTitle>Schedule your session</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>Select a date and time that fits your schedule.</p>
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
                      width: 60, minHeight: 76, borderRadius: 14, flexShrink: 0,
                      border: selectedDate === d.full ? "none" : `1.5px solid ${C.border}`,
                      background: selectedDate === d.full ? C.black : C.white,
                      color: selectedDate === d.full ? C.white : C.black,
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
                <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>Available Times</span>
                <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 600, color: C.muted }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.border, display: "inline-block" }} />Free
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.black, display: "inline-block" }} />Selected
                  </span>
                </div>
              </div>

              {slotsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: C.muted, animation: "spin 1s linear infinite" }}>refresh</span>
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
                                padding: "12px 0", borderRadius: 10, border: "2px solid",
                                borderColor: isSelected ? C.black : isOccupied ? C.border : C.border,
                                background: isSelected ? C.black : isOccupied ? C.surface : C.white,
                                color: isSelected ? C.white : isOccupied ? C.muted : C.black,
                                fontSize: 13, fontWeight: 700, fontFamily: FF,
                                cursor: isOccupied ? "not-allowed" : "pointer",
                                textDecoration: isOccupied ? "line-through" : "none",
                                opacity: isOccupied ? 0.4 : 1,
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
                                padding: "12px 0", borderRadius: 10, border: "2px solid",
                                borderColor: isSelected ? C.black : C.border,
                                background: isSelected ? C.black : isOccupied ? C.surface : C.white,
                                color: isSelected ? C.white : isOccupied ? C.muted : C.black,
                                fontSize: 13, fontWeight: 700, fontFamily: FF,
                                cursor: isOccupied ? "not-allowed" : "pointer",
                                textDecoration: isOccupied ? "line-through" : "none",
                                opacity: isOccupied ? 0.4 : 1,
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
              <StepLabel text="Step 4 of 4 · Confirm Booking" />
              <SectionTitle>Almost there!</SectionTitle>
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>Review your details and enter contact info to finalize.</p>
            </div>

            {/* Two-column layout on larger screens, single column on small */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>

              {/* Left: forms */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_outline</span>
                    Your Information
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { label: "Full Name",     value: clientName,  setter: setClientName,  type: "text", placeholder: "Your name" },
                      { label: "Phone Number",  value: clientPhone, setter: setClientPhone, type: "tel",  placeholder: "+962 ..." },
                    ].map(field => (
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
                            borderRadius: 12, border: `1.5px solid ${C.border}`,
                            background: C.surface, fontSize: 14, fontWeight: 500,
                            color: C.black, outline: "none", fontFamily: FF,
                            boxSizing: "border-box", transition: "all 150ms ease",
                          }}
                          onFocus={e => { e.target.style.borderColor = C.black; e.target.style.background = C.white; e.target.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.06)"; }}
                          onBlur={e => { e.target.style.borderColor = C.border; e.target.style.background = C.surface; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment notice */}
                <div style={{
                  display: "flex", gap: 16, padding: "18px 20px",
                  background: "#f0fdf4", borderRadius: 14,
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderLeft: "4px solid #10b981",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.green, flexShrink: 0 }}>payments</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.black, margin: "0 0 4px" }}>No payment today</p>
                    <p style={{ fontSize: 12, color: C.subtle, margin: 0, lineHeight: 1.5 }}>
                      You pay at the shop after your visit. Please give 24h notice if you need to cancel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: summary card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, position: "sticky", top: 88, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: C.black, letterSpacing: "-0.02em", margin: 0 }}>Summary</h3>
                  <span style={{ fontSize: 10, fontWeight: 700, background: C.black, color: C.white, padding: "3px 10px", borderRadius: 9999, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Estimated
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {serviceList.filter(s => selectedServices.includes(s.id)).map(s => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.white, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted }}>Total</span>
                  <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.black }}>{totalPrice.toFixed(2)} JOD</span>
                </div>

                {bookingError && (
                  <div style={{ padding: "12px 16px", background: "#fee2e2", borderRadius: 10, fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
                    {bookingError}
                  </div>
                )}

                <button
                  disabled={!clientName.trim() || !clientPhone.trim() || submitting}
                  onClick={handleBooking}
                  style={{
                    width: "100%", height: 52,
                    background: (!clientName.trim() || !clientPhone.trim() || submitting) ? "#d1d5db" : C.black,
                    color: C.white, borderRadius: 12, border: "none",
                    fontWeight: 700, fontSize: 15, fontFamily: FF,
                    cursor: (!clientName.trim() || !clientPhone.trim() || submitting) ? "not-allowed" : "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  {submitting ? "Processing…" : "Confirm Booking →"}
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
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 24,
              padding: "56px 40px", textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%", background: C.black,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 44, color: C.white, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", fontFamily: "'Manrope',system-ui,sans-serif", margin: "0 0 12px" }}>
                You&apos;re All Set!
              </h2>
              <p style={{ fontSize: 16, color: C.subtle, marginBottom: 36, maxWidth: 400, margin: "0 auto 36px" }}>
                Your appointment at <strong style={{ color: C.black }}>{shop?.name}</strong> is confirmed.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 32, textAlign: "left" }}>
                {[
                  { label: "Barber",  value: selectedBarberName || "Any" },
                  { label: "Date",    value: format(new Date(selectedDate), "MMM d") },
                  { label: "Time",    value: selectedTime ? formatTime(selectedTime) : "" },
                  { label: "Total",   value: `${totalPrice.toFixed(2)} JOD` },
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
                  padding: "13px 28px", borderRadius: 12,
                  background: C.black, color: C.white,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event_note</span>
                  View My Bookings
                </Link>
                <Link href="/explore" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "13px 28px", borderRadius: 12,
                  background: C.surface, color: C.black, border: `1px solid ${C.border}`,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}>
                  Explore More
                </Link>
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
