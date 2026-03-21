"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Scissors,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  CalendarDays,
  Star,
  Sparkles,
  Heart,
  Palette,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { getPublicServices } from "@/lib/queries/services";
import { getAvailableSlots } from "@/lib/queries/appointments";
import { format, addDays, parseISO } from "date-fns";

type BookingStep = "landing" | "services" | "barber" | "datetime" | "confirm";

const serviceIcons: Record<string, React.ReactNode> = {
  scissors: <Scissors size={20} />,
  sparkles: <Sparkles size={20} />,
  palette: <Palette size={20} />,
  heart: <Heart size={20} />,
};

// Generate next 14 days dynamically
function generateDays(count: number) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(new Date(), i);
    days.push({
      date: format(date, "MMM d"),
      day: format(date, "EEE"),
      full: format(date, "yyyy-MM-dd"),
    });
  }
  return days;
}

const availableTimes = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface ServiceRow {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
}

interface BarberRow {
  id: string;
  full_name: string;
}

export function BookingEngine({ shopId }: { shopId?: string }) {
  const t = useTranslation();
  const isRTL = useThemeStore((s) => s.direction) === "rtl";
  const supabase = createClient();

  const [step, setStep] = useState<BookingStep>("landing");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState("");
  const [booked, setBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const weekDays = useMemo(() => generateDays(14), []);

  // Resolve shop ID — use prop or fetch first shop
  const [resolvedShopId, setResolvedShopId] = useState(shopId ?? "");

  useEffect(() => {
    if (shopId) {
      setResolvedShopId(shopId);
      return;
    }
    // For demo: fetch the first shop
    supabase
      .from("shops")
      .select("id, name")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setResolvedShopId(data.id);
      });
  }, [shopId, supabase]);

  // Fetch services from Supabase
  const { data: services, loading: servicesLoading } = useSupabaseQuery<ServiceRow[]>(
    () => getPublicServices(supabase, resolvedShopId),
    [resolvedShopId],
    { enabled: !!resolvedShopId },
  );

  // Fetch barbers from Supabase
  const { data: barbers } = useSupabaseQuery<BarberRow[]>(
    async () => {
      const result = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("shop_id", resolvedShopId);
      return result as { data: BarberRow[] | null; error: { message: string } | null };
    },
    [resolvedShopId],
    { enabled: !!resolvedShopId },
  );

  // Fetch occupied slots for selected date
  const { data: occupiedSlots, loading: slotsLoading } = useSupabaseQuery(
    () =>
      getAvailableSlots(
        supabase,
        resolvedShopId,
        selectedDate,
        selectedBarber !== "any" ? selectedBarber ?? undefined : undefined,
      ),
    [resolvedShopId, selectedDate, selectedBarber],
    { enabled: !!resolvedShopId && step === "datetime" },
  );

  // Compute occupied time set
  const occupiedTimeSet = useMemo(() => {
    const set = new Set<string>();
    if (!occupiedSlots) return set;
    (occupiedSlots as { start_time: string; end_time: string }[]).forEach(
      (slot) => {
        const start = parseISO(slot.start_time);
        const end = parseISO(slot.end_time);
        // Mark all 30-minute blocks that overlap
        for (const time of availableTimes) {
          const [h, m] = time.split(":").map(Number);
          const slotStart = new Date(start);
          slotStart.setHours(h, m, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + 30);

          if (slotStart < end && slotEnd > start) {
            set.add(time);
          }
        }
      },
    );
    return set;
  }, [occupiedSlots]);

  const serviceList = services ?? [];
  const barberList = barbers ?? [];

  const totalPrice = serviceList
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);

  const totalDuration = serviceList
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.duration, 0);

  const selectedBarberName =
    selectedBarber === "any"
      ? t.booking.anyBarber
      : barberList.find((b) => b.id === selectedBarber)?.full_name;

  // ─── Submit booking ───
  const handleBooking = async () => {
    setSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: resolvedShopId,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim().replace(/\s/g, ""),
          service_ids: selectedServices,
          barber_id: selectedBarber,
          date: selectedDate,
          time: selectedTime,
          hear_about_us: hearAboutUs,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setBookingError(
          result.error || "Something went wrong. Please try again.",
        );
        return;
      }

      setBooked(true);
    } catch {
      setBookingError(
        "Unable to connect. Please check your internet and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const steps: BookingStep[] = [
    "landing",
    "services",
    "barber",
    "datetime",
    "confirm",
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
      >
        {/* Main Card */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-primary)] bg-[var(--glass-bg)] backdrop-blur-[20px] overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ═══════ LANDING ═══════ */}
            {step === "landing" && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="p-10 text-center"
              >
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center mx-auto mb-6">
                  <Scissors size={28} className="text-[#0A0A0A]" />
                </div>

                <h1 className="text-2xl text-[var(--text-primary)] font-light mb-2">
                  {t.booking.bookAppointment}
                </h1>
                <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--text-tertiary)] mb-1">
                  <MapPin size={12} />
                  <span>{isRTL ? "عمّان، الأردن" : "Amman, Jordan"}</span>
                </div>
                <div className="flex items-center justify-center gap-1 mb-8">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={cn(
                        i < 4
                          ? "text-[var(--accent-amber)] fill-[var(--accent-amber)]"
                          : "text-[var(--text-muted)]",
                      )}
                    />
                  ))}
                  <span className="text-[11px] text-[var(--text-tertiary)] ms-">
                    4.8 (127 {t.booking.reviews})
                  </span>
                </div>

                {/* Trust micro-copy */}
                <div className="space-y-2 mb-8">
                  {[
                    { icon: Clock, text: isRTL ? "حجز سريع — أقل من دقيقة" : "Quick booking — under 1 minute" },
                    { icon: MapPin, text: isRTL ? "الدفع في المحل" : "Pay in shop — no upfront charges" },
                    { icon: CalendarDays, text: isRTL ? "إلغاء مجاني" : "Free cancellation anytime" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center justify-center gap-2">
                      <Icon size={12} className="text-[var(--accent-mint)]" />
                      <span className="text-[11px] text-[var(--text-tertiary)] font-light">
                        {text}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep("services")}
                  className="btn btn-primary w-full"
                >
                  {t.booking.bookAppointment}
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {/* ═══════ SERVICES ═══════ */}
            {step === "services" && (
              <motion.div
                key="services"
                initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="p-8"
              >
                <StepHeader
                  step={2}
                  total={4}
                  title={t.booking.selectServices}
                  onBack={() => setStep("landing")}
                />

                {servicesLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2
                      size={24}
                      className="text-[var(--accent-mint)] animate-spin"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    {serviceList.map((service) => {
                      const isSelected = selectedServices.includes(service.id);
                      return (
                        <motion.button
                          key={service.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            setSelectedServices((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== service.id)
                                : [...prev, service.id],
                            )
                          }
                          className={cn(
                            "p-4 rounded-[var(--radius-md)] border text-start transition-all cursor-pointer",
                            isSelected
                              ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)]"
                              : "border-[var(--border-primary)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center",
                                isSelected
                                  ? "bg-[var(--accent-mint)] text-[#0A0A0A]"
                                  : "bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]",
                              )}
                            >
                              <Scissors size={16} />
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-[var(--accent-mint)] flex items-center justify-center"
                              >
                                <Check size={12} className="text-[#0A0A0A]" />
                              </motion.div>
                            )}
                          </div>
                          <p
                            className={cn(
                              "text-[12px] font-light mb-1",
                              isSelected
                                ? "text-[var(--accent-mint)]"
                                : "text-[var(--text-primary)]",
                            )}
                          >
                            {isRTL && service.name_ar
                              ? service.name_ar
                              : service.name}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] text-[var(--text-primary)] font-medium">
                              {service.price} {t.common.jod}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                              <Clock size={9} />
                              {service.duration}m
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Summary & Next */}
                {selectedServices.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {selectedServices.length} service(s) · {totalDuration}{" "}
                        min
                      </p>
                      <p className="text-[15px] text-[var(--text-primary)] font-medium">
                        {totalPrice.toFixed(2)} {t.common.jod}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep("barber")}
                      className="btn btn-primary"
                    >
                      {t.common.next} <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══════ BARBER SELECTION ═══════ */}
            {step === "barber" && (
              <motion.div
                key="barber"
                initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="p-8"
              >
                <StepHeader
                  step={3}
                  total={4}
                  title={t.booking.chooseBarber}
                  onBack={() => setStep("services")}
                />

                <div className="space-y-2 mt-6">
                  {/* Any Barber */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedBarber("any")}
                    className={cn(
                      "w-full p-4 rounded-[var(--radius-md)] border flex items-center gap-4 transition-all cursor-pointer text-start",
                      selectedBarber === "any"
                        ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)]"
                        : "border-[var(--border-primary)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]",
                    )}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-mint)]/30 to-[var(--accent-lavender)]/30 border border-dashed border-[var(--border-hover)] flex items-center justify-center">
                      <Sparkles
                        size={16}
                        className="text-[var(--text-tertiary)]"
                      />
                    </div>
                    <div>
                      <p className="text-[13px] text-[var(--text-primary)] font-light">
                        {t.booking.anyBarber}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        {t.booking.anyBarberDesc}
                      </p>
                    </div>
                    {selectedBarber === "any" && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ms- w-5 h-5 rounded-full bg-[var(--accent-mint)] flex items-center justify-center"
                      >
                        <Check size={12} className="text-[#0A0A0A]" />
                      </motion.div>
                    )}
                  </motion.button>

                  {barberList.map((barber) => (
                    <motion.button
                      key={barber.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedBarber(barber.id)}
                      className={cn(
                        "w-full p-4 rounded-[var(--radius-md)] border flex items-center gap-4 transition-all cursor-pointer text-start",
                        selectedBarber === barber.id
                          ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)] shadow-[0_0_15px_rgba(110,231,183,0.15)]"
                          : "border-[var(--border-primary)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]",
                      )}
                    >
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[12px] font-medium text-[#0A0A0A]">
                          {barber.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] text-[var(--text-primary)] font-light">
                          {barber.full_name}
                        </p>
                      </div>
                      {selectedBarber === barber.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ms- w-5 h-5 rounded-full bg-[var(--accent-mint)] flex items-center justify-center"
                        >
                          <Check size={12} className="text-[#0A0A0A]" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {selectedBarber && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex justify-end"
                  >
                    <button
                      onClick={() => setStep("datetime")}
                      className="btn btn-primary"
                    >
                      {t.common.next} <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══════ DATE & TIME ═══════ */}
            {step === "datetime" && (
              <motion.div
                key="datetime"
                initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="p-8"
              >
                <StepHeader
                  step={4}
                  total={4}
                  title={t.booking.pickDateTime}
                  onBack={() => setStep("barber")}
                />

                {/* Date selector */}
                <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
                  {weekDays.map((d) => (
                    <button
                      key={d.full}
                      onClick={() => {
                        setSelectedDate(d.full);
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "flex flex-col items-center px-4 py-3 rounded-[var(--radius-md)] border min-w-[72px] transition-all cursor-pointer",
                        selectedDate === d.full
                          ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)] text-[var(--accent-mint)]"
                          : "border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:border-[var(--border-hover)]",
                      )}
                    >
                      <span className="text-[10px] font-light uppercase">
                        {d.day}
                      </span>
                      <span className="text-[14px] font-medium mt-0.5">
                        {d.date.split(" ")[1]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Time slots */}
                <div className="mt-6">
                  <p className="text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-3">
                    {t.booking.availableTimes}
                  </p>
                  {slotsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2
                        size={20}
                        className="text-[var(--accent-mint)] animate-spin"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableTimes.map((time) => {
                        const isOccupied = occupiedTimeSet.has(time);
                        return (
                          <button
                            key={time}
                            disabled={isOccupied}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "relative h-9 rounded-[var(--radius-sm)] text-[12px] font-light transition-all cursor-pointer tabular-nums",
                              isOccupied
                                ? "bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed line-through opacity-40"
                                : selectedTime === time
                                  ? "text-[#0A0A0A] font-medium"
                                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-hover)]",
                            )}
                          >
                            {selectedTime === time && (
                              <motion.div
                                layoutId="time-slot-active"
                                className="absolute inset-0 bg-[var(--accent-mint)] rounded-[var(--radius-sm)] shadow-[0_0_12px_rgba(110,231,183,0.3)]"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 25,
                                }}
                              />
                            )}
                            <span className="relative z-10">{time}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedTime && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex justify-end"
                  >
                    <button
                      onClick={() => setStep("confirm")}
                      className="btn btn-primary"
                    >
                      {t.common.next} <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══════ CONFIRMATION ═══════ */}
            {step === "confirm" && !booked && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="p-8"
              >
                <StepHeader
                  step={4}
                  total={4}
                  title={t.booking.confirmBooking}
                  onBack={() => setStep("datetime")}
                />

                <div className="mt-6 space-y-3">
                  {/* Summary */}
                  <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">
                        {t.booking.services}
                      </span>
                      <span className="text-[var(--text-primary)] font-light">
                        {serviceList
                          .filter((s) => selectedServices.includes(s.id))
                          .map((s) =>
                            isRTL && s.name_ar ? s.name_ar : s.name,
                          )
                          .join(", ")}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">
                        {t.calendar.barber}
                      </span>
                      <span className="text-[var(--text-primary)] font-light">
                        {selectedBarberName}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">
                        {t.booking.date}
                      </span>
                      <span className="text-[var(--text-primary)] font-light tabular-nums">
                        {selectedDate} at {selectedTime}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">
                        {t.calendar.duration}
                      </span>
                      <span className="text-[var(--text-primary)] font-light">
                        {totalDuration} min
                      </span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-[var(--border-primary)] flex justify-between text-[13px]">
                      <span className="text-[var(--text-primary)] font-medium">
                        {t.booking.total}
                      </span>
                      <span className="text-[var(--accent-mint)] font-medium">
                        {totalPrice.toFixed(2)} {t.common.jod}
                      </span>
                    </div>
                  </div>

                  {/* Client info */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder={t.booking.yourName}
                      className="w-full h-10 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                    />
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder={t.booking.phoneNumber}
                      className="w-full h-10 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                    />
                    <select
                      value={hearAboutUs}
                      onChange={(e) => setHearAboutUs(e.target.value)}
                      className="w-full h-10 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-tertiary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="">
                        {t.booking.howDidYouHear} ({t.common.optional})
                      </option>
                      <option value="instagram">{t.booking.instagram}</option>
                      <option value="google">{t.booking.google}</option>
                      <option value="friend">{t.booking.wordOfMouth}</option>
                      <option value="walkin">{t.booking.walkIn}</option>
                      <option value="other">{t.booking.other}</option>
                    </select>
                  </div>

                  {/* Payment Notice */}
                  <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--accent-mint-muted)] border border-[var(--accent-mint)]/20">
                    <p className="text-[11px] text-[var(--accent-mint)] font-light text-center">
                      💵{" "}
                      {interpolate(t.booking.paymentNotice, {
                        amount: totalPrice.toFixed(2),
                      })}
                    </p>
                  </div>

                  {/* Error message */}
                  {bookingError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-[var(--radius-sm)] bg-[var(--accent-rose-muted)] border border-[var(--accent-rose)]/20 flex items-start gap-2"
                    >
                      <AlertCircle
                        size={14}
                        className="text-[var(--accent-rose)] mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="text-[11px] text-[var(--accent-rose)] font-light">
                          {bookingError}
                        </p>
                        <button
                          onClick={handleBooking}
                          className="mt-1 text-[10px] text-[var(--accent-rose)] underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={10} />
                          Try again
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={handleBooking}
                    disabled={
                      !clientName.trim() || !clientPhone.trim() || submitting
                    }
                    className="btn btn-primary w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {isRTL ? "جاري الحجز..." : "Booking..."}
                      </>
                    ) : (
                      <>
                        {t.booking.confirmBtn}
                        <Check size={16} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══════ BOOKED SUCCESS ═══════ */}
            {booked && (
              <motion.div
                key="booked"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                className="p-10 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className="w-16 h-16 rounded-full bg-[var(--accent-mint)] flex items-center justify-center mx-auto mb-6"
                >
                  <Check size={32} className="text-[#0A0A0A]" />
                </motion.div>
                <h2 className="text-xl text-[var(--text-primary)] font-light mb-2">
                  {t.booking.allSet}
                </h2>
                <p className="text-[13px] text-[var(--text-tertiary)] font-light mb-6 max-w-sm mx-auto">
                  {interpolate(t.booking.confirmationMsg, {
                    barber: selectedBarberName || "",
                    date: selectedDate,
                    time: selectedTime || "",
                  })}
                </p>

                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-start mb-6">
                  <div className="flex justify-between text-[12px] mb-2">
                    <span className="text-[var(--text-tertiary)]">
                      {t.booking.payment}
                    </span>
                    <span className="text-[var(--accent-mint)] font-medium">
                      {totalPrice.toFixed(2)} {t.common.jod}{" "}
                      {t.booking.inStore}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)]">
                  {interpolate(t.booking.smsSent, { phone: clientPhone })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step indicator dots */}
        {step !== "landing" && !booked && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {["services", "barber", "datetime", "confirm"].map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  steps.indexOf(step) >= i + 1
                    ? "w-6 bg-[var(--accent-mint)]"
                    : "w-1.5 bg-[var(--text-muted)]",
                )}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Step Header ───
function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        aria-label="Go back"
      >
        <ArrowLeft size={16} />
      </button>
      <div>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
          {t.booking.step} {step - 1} {t.booking.of} {total}
        </p>
        <h3 className="text-[15px] text-[var(--text-primary)] font-light">
          {title}
        </h3>
      </div>
    </div>
  );
}
