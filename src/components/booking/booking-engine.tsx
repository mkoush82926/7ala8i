"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Scissors,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Star,
  Sparkles,
  Heart,
  Palette,
} from "lucide-react";
import { services } from "@/lib/mock-data";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

type BookingStep = "landing" | "services" | "barber" | "datetime" | "confirm";

const serviceIcons: Record<string, React.ReactNode> = {
  scissors: <Scissors size={20} />,
  sparkles: <Sparkles size={20} />,
  palette: <Palette size={20} />,
  heart: <Heart size={20} />,
};

const availableTimes = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
];

const weekDays = [
  { date: "Mar 10", day: "Mon", full: "2026-03-10" },
  { date: "Mar 11", day: "Tue", full: "2026-03-11" },
  { date: "Mar 12", day: "Wed", full: "2026-03-12" },
  { date: "Mar 13", day: "Thu", full: "2026-03-13" },
  { date: "Mar 14", day: "Fri", full: "2026-03-14" },
  { date: "Mar 15", day: "Sat", full: "2026-03-15" },
  { date: "Mar 16", day: "Sun", full: "2026-03-16" },
];

// Simulate some occupied slots
const occupiedSlots: Record<string, string[]> = {
  "2026-03-10": ["09:00", "09:30", "10:00", "11:00", "14:00"],
  "2026-03-11": ["10:00", "10:30", "15:00"],
  "2026-03-12": ["09:30", "13:00", "13:30"],
};

export function BookingEngine() {
  const { shopName, barbers } = useWorkspaceStore();
  const t = useTranslation();
  const isRTL = useThemeStore((s) => s.direction) === "rtl";
  const [step, setStep] = useState<BookingStep>("landing");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("2026-03-10");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState("");
  const [booked, setBooked] = useState(false);

  const totalPrice = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);

  const totalDuration = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.duration, 0);

  const selectedBarberName =
    selectedBarber === "any"
      ? t.booking.anyBarber
      : barbers.find((b) => b.id === selectedBarber)?.name;

  const canProceed = () => {
    switch (step) {
      case "services":
        return selectedServices.length > 0;
      case "barber":
        return selectedBarber !== null;
      case "datetime":
        return selectedTime !== null;
      case "confirm":
        return clientName.trim() && clientPhone.trim();
      default:
        return true;
    }
  };

  const steps: BookingStep[] = [
    "landing",
    "services",
    "barber",
    "datetime",
    "confirm",
  ];
  const currentIdx = steps.indexOf(step);

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
                {/* Logo */}
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center mx-auto mb-6">
                  <Scissors size={28} className="text-[#0A0A0A]" />
                </div>

                <h1 className="text-2xl text-[var(--text-primary)] font-light mb-2">
                  {shopName}
                </h1>
                <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--text-tertiary)] mb-1">
                  <MapPin size={12} />
                  <span>Rainbow St, Amman, Jordan</span>
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
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-1">
                    4.8 (127 {t.booking.reviews})
                  </span>
                </div>

                {/* Map placeholder */}
                <div className="w-full h-32 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center mb-8">
                  <div className="text-center">
                    <MapPin
                      size={20}
                      className="text-[var(--text-muted)] mx-auto mb-1"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Interactive Map
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep("services")}
                  className="w-full h-12 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
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

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {services.map((service) => {
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
                          "p-4 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer",
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
                            {serviceIcons[service.icon] || (
                              <Scissors size={16} />
                            )}
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
                          {service.name}
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

                {/* Summary & Next */}
                {selectedServices.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {selectedServices.length} service(s) · {totalDuration}
                        min
                      </p>
                      <p className="text-[15px] text-[var(--text-primary)] font-medium">
                        {totalPrice.toFixed(2)} {t.common.jod}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep("barber")}
                      className="h-10 px-6 rounded-[var(--radius-md)] bg-[var(--accent-mint)] text-[#0A0A0A] text-[13px] font-medium flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
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
                      "w-full p-4 rounded-[var(--radius-md)] border flex items-center gap-4 transition-all cursor-pointer text-left",
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
                        className="ml-auto w-5 h-5 rounded-full bg-[var(--accent-mint)] flex items-center justify-center"
                      >
                        <Check size={12} className="text-[#0A0A0A]" />
                      </motion.div>
                    )}
                  </motion.button>

                  {barbers.map((barber) => (
                    <motion.button
                      key={barber.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedBarber(barber.id)}
                      className={cn(
                        "w-full p-4 rounded-[var(--radius-md)] border flex items-center gap-4 transition-all cursor-pointer text-left",
                        selectedBarber === barber.id
                          ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)] shadow-[0_0_15px_rgba(110,231,183,0.15)]"
                          : "border-[var(--border-primary)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:shadow-[0_0_15px_rgba(110,231,183,0.05)]",
                      )}
                    >
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[12px] font-medium text-[#0A0A0A]">
                          {barber.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] text-[var(--text-primary)] font-light">
                          {barber.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={9}
                              className="text-[var(--accent-amber)] fill-[var(--accent-amber)]"
                            />
                          ))}
                          <span className="text-[9px] text-[var(--text-muted)] ml-0.5">
                            5.0
                          </span>
                        </div>
                      </div>
                      {selectedBarber === barber.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto w-5 h-5 rounded-full bg-[var(--accent-mint)] flex items-center justify-center"
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
                      className="h-10 px-6 rounded-[var(--radius-md)] bg-[var(--accent-mint)] text-[#0A0A0A] text-[13px] font-medium flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
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

                {/* Date selector — horizontal scrolling week */}
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
                  <div className="grid grid-cols-4 gap-2">
                    {availableTimes.map((time) => {
                      const isOccupied =
                        occupiedSlots[selectedDate]?.includes(time);
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
                </div>

                {selectedTime && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex justify-end"
                  >
                    <button
                      onClick={() => setStep("confirm")}
                      className="h-10 px-6 rounded-[var(--radius-md)] bg-[var(--accent-mint)] text-[#0A0A0A] text-[13px] font-medium flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
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

                {/* Summary */}
                <div className="mt-6 space-y-3">
                  <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">
                        {t.booking.services}
                      </span>
                      <span className="text-[var(--text-primary)] font-light">
                        {services
                          .filter((s) => selectedServices.includes(s.id))
                          .map((s) => s.name)
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

                  <button
                    onClick={() => setBooked(true)}
                    disabled={!clientName.trim() || !clientPhone.trim()}
                    className={cn(
                      "w-full h-12 rounded-[var(--radius-md)] text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-all",
                      clientName.trim() && clientPhone.trim()
                        ? "bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] hover:opacity-90"
                        : "bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed",
                    )}
                  >
                    {t.booking.confirmBtn}
                    <Check size={16} />
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

                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-left mb-6">
                  <div className="flex justify-between text-[12px] mb-2">
                    <span className="text-[var(--text-tertiary)]">
                      {t.booking.location}
                    </span>
                    <span className="text-[var(--text-primary)] font-light">
                      Rainbow St, Amman
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px] mb-2">
                    <span className="text-[var(--text-tertiary)]">
                      {t.booking.payment}
                    </span>
                    <span className="text-[var(--accent-mint)] font-medium">
                      {totalPrice.toFixed(2)} {t.common.jod} {t.booking.inStore}
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
