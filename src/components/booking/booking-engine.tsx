"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Star,
  Store,
  Users,
  Wallet,
  CalendarCheck,
  Scissors,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { getServiceCategory, type ServiceCategory } from "@/lib/service-icon";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingResult, BusySlot } from "@/lib/supabase/database.types";
import {
  addDaysToDateStr,
  barberOffersServices,
  bookingReference,
  buildIcs,
  computeSlots,
  googleCalendarUrl,
  isDayOpen,
  isValidPhone,
  newIdempotencyKey,
  normalizePhone,
  safeTimeZone,
  todayInZone,
  toWhatsAppNumber,
  type BarberCapability,
  type SlotInfo,
  type WorkingHourRow,
} from "./booking-utils";

type BookingStep = "services" | "barber" | "datetime" | "confirm";
const STEPS: BookingStep[] = ["services", "barber", "datetime", "confirm"];
const DAYS_AHEAD = 14;

// "Ink & Brass" palette, as theme tokens (public routes always render light).
const C = {
  ink: "var(--text-primary)",
  paper: "var(--bg-primary)",
  cream: "var(--bg-secondary)",
  border: "var(--border-subtle)",
  borderStrong: "var(--border-primary)",
  slate: "var(--text-secondary)",
  muted: "var(--text-muted)",
  brass: "var(--accent-brass)",
  brassText: "var(--accent-text)",
  cta: "var(--accent-mint)",
  onAccent: "var(--on-accent)",
  red: "var(--accent-rose)",
  redBg: "var(--accent-rose-muted)",
};

interface ShopRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  currency: string | null;
  timezone: string | null;
  cancellation_policy_hours: number | null;
}
interface ServiceRow {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
}
interface BarberRow extends BarberCapability {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}
interface ReviewRow {
  rating: number;
}
interface RescheduleRow {
  id: string;
  shop_id: string;
  barber_id: string | null;
  service_ids: string[] | null;
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };
type SubmitOutcome =
  | { ok: true; booking: BookingResult }
  | { ok: false; code: string; network?: boolean; fieldErrors?: Record<string, string[]> };

/** Untyped Supabase RPC call (the browser client is not parameterized with Database). */
async function rpc<T>(client: unknown, fn: string, args: Record<string, unknown>): Promise<QueryResult<T>> {
  const c = client as { rpc: (f: string, a: unknown) => PromiseLike<{ data: unknown; error: unknown }> };
  const { data, error } = await c.rpc(fn, args);
  const err = error as { message?: string } | null;
  return { data: (data ?? null) as T | null, error: err ? { message: String(err.message ?? "error") } : null };
}

/** Replaces {key} placeholders with React nodes (used for inline links). */
function renderTemplate(template: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in nodes ? <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment> : part;
  });
}

// Codes that mean "pick another time".
const TIME_CODES = new Set(["SLOT_TAKEN", "NO_BARBER_AVAILABLE", "SLOT_IN_PAST", "OUTSIDE_WORKING_HOURS", "TOO_FAR_AHEAD"]);
const SELECTION_CODES = new Set(["SERVICE_INVALID", "BARBER_INVALID"]);

// ─── Small presentational pieces ─────────────────────────────────

function StepHeader({
  stepIndex, title, label, isRTL, FF, headingRef, onBack, backLabel, progressLabel,
}: {
  stepIndex: number; title: string; label: string; isRTL: boolean; FF: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack?: () => void; backLabel: string; progressLabel: string;
}) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, marginBottom: 12 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label={backLabel} className="bk-icon-btn">
            <BackIcon size={20} aria-hidden="true" />
          </button>
        )}
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={label}
          style={{ flex: 1, display: "flex", gap: 4 }}
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 9999,
                background: i <= stepIndex ? C.cta : C.border,
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
      </div>
      <p className="eyebrow" style={{ margin: "0 0 6px" }}>{label}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 900, lineHeight: 1.15,
          letterSpacing: headingTracking(isRTL, "0.014em"), color: C.ink, fontFamily: FF,
          margin: 0, outline: "none",
        }}
      >
        {title}
      </h1>
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="bk-bottom-bar">{children}</div>;
}

function Totals({
  amount, durationLabel, countLabel, extra,
}: { amount: string; durationLabel: string | null; countLabel: string | null; extra?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }} aria-live="polite">
      <p style={{ fontSize: 20, fontWeight: 900, color: C.ink, margin: 0, whiteSpace: "nowrap" }}>{amount}</p>
      {countLabel && (
        <p style={{ fontSize: 12, color: C.slate, margin: "2px 0 0" }}>
          {countLabel}{durationLabel ? ` · ${durationLabel}` : ""}
        </p>
      )}
      {extra}
    </div>
  );
}

function NextButton({ onClick, disabled, label, isRTL }: { onClick: () => void; disabled: boolean; label: string; isRTL: boolean }) {
  const Icon = isRTL ? ArrowLeft : ArrowRight;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="bk-cta bk-cta-pill">
      {label}
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

function InlineAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, textAlign: "start",
        padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
        background: tone === "error" ? C.redBg : C.cream,
        color: tone === "error" ? C.red : C.slate,
        border: `1px solid ${tone === "error" ? "transparent" : C.border}`,
      }}
    >
      <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

function ChipsSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="bk-slot-grid">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="button" style={{ height: 44, width: "100%" }} />
      ))}
    </div>
  );
}

function CardsSkeleton({ count = 4, label, height = 120 }: { count?: number; label: string; height?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="bk-grid-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="card" style={{ height, width: "100%" }} />
      ))}
    </div>
  );
}

function BarberAvatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: C.ink, color: C.onAccent, display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
      }}
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : initial}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────

export function BookingEngine({ shopId, rescheduleAppointmentId }: { shopId: string; rescheduleAppointmentId?: string }) {
  const [supabase] = useState(() => createClient());
  const {
    t, dir, isRTL, FF, href, formatCurrency, formatDate, formatTime, formatDuration,
  } = useTranslation();
  const searchParams = useSearchParams();
  const rescheduleId = rescheduleAppointmentId ?? searchParams?.get("reschedule") ?? null;
  const presetServiceId = searchParams?.get("service") ?? null;

  const errorText = useCallback((code?: string | null) => {
    const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
    return (code && codes?.[code]) || t.error.message;
  }, [t]);

  // ─── State ───
  const [step, setStep] = useState<BookingStep>("services");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"all" | ServiceCategory>("all");
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null); // id | "any"
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; startIso: string } | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [timeNotice, setTimeNotice] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookingResult | null>(null);
  const [rescheduleWarning, setRescheduleWarning] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const seededRef = useRef(false);
  const firstRenderRef = useRef(true);

  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();
  const phoneErrId = useId();
  const nameErrId = useId();
  const ctaHintId = useId();

  // ─── Data ───
  const { data: shop, loading: shopLoading, error: shopError, refetch: refetchShop } = useSupabaseQuery<ShopRow>(
    async () => (await supabase
      .from("shops")
      .select("id, name, address, phone, whatsapp, currency, timezone, cancellation_policy_hours")
      .eq("id", shopId)
      .maybeSingle()) as QueryResult<ShopRow>,
    [shopId], { enabled: !!shopId },
  );
  const currency = shop?.currency || "JOD";
  const timeZone = safeTimeZone(shop?.timezone);
  const policyHours = shop?.cancellation_policy_hours ?? 0;

  const { data: reviewsData } = useSupabaseQuery<ReviewRow[]>(
    async () => (await supabase.from("reviews").select("rating").eq("shop_id", shopId).limit(500)) as QueryResult<ReviewRow[]>,
    [shopId], { enabled: !!shopId },
  );
  const numReviews = reviewsData?.length ?? 0;
  const avgRating = numReviews > 0 ? reviewsData!.reduce((a, r) => a + r.rating, 0) / numReviews : 0;

  const { data: services, loading: servicesLoading, error: servicesError, refetch: refetchServices } = useSupabaseQuery<ServiceRow[]>(
    async () => (await supabase
      .from("services")
      .select("id, name, name_ar, duration, price")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true })) as QueryResult<ServiceRow[]>,
    [shopId], { enabled: !!shopId },
  );

  // Same pool the server uses for "any barber": barbers and shop admins of this shop.
  const { data: barbers, loading: barbersLoading, error: barbersError, refetch: refetchBarbers } = useSupabaseQuery<BarberRow[]>(
    async () => (await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, barber_services(service_id, is_active)")
      .eq("shop_id", shopId)
      .in("role", ["barber", "shop_admin"])) as QueryResult<BarberRow[]>,
    [shopId], { enabled: !!shopId },
  );

  const serviceList = useMemo(() => services ?? [], [services]);
  const barberList = useMemo(
    () => [...(barbers ?? [])].sort((a, b) => Number(b.role === "barber") - Number(a.role === "barber")),
    [barbers],
  );
  const barberIdsKey = barberList.map((b) => b.id).join(",");

  const { data: workingHours, loading: hoursLoading, error: hoursError, refetch: refetchHours } = useSupabaseQuery<WorkingHourRow[]>(
    async () => {
      const ids = barberIdsKey ? barberIdsKey.split(",") : [];
      if (!ids.length) return { data: [], error: null };
      return (await supabase
        .from("working_hours")
        .select("barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end")
        .in("barber_id", ids)) as QueryResult<WorkingHourRow[]>;
    },
    [barberIdsKey], { enabled: barberIdsKey.length > 0 },
  );

  // ─── Derived selection data ───
  const localName = useCallback((s: ServiceRow) => (isRTL && s.name_ar ? s.name_ar : s.name), [isRTL]);
  const chosenServices = useMemo(
    () => serviceList.filter((s) => selectedServices.includes(s.id)),
    [serviceList, selectedServices],
  );
  const totalPrice = chosenServices.reduce((a, s) => a + Number(s.price || 0), 0);
  const totalDuration = chosenServices.reduce((a, s) => a + Number(s.duration || 0), 0);

  const eligibleBarbers = useMemo(
    () => barberList.filter((b) => barberOffersServices(b, selectedServices)),
    [barberList, selectedServices],
  );
  const availabilityBarberIds = useMemo(() => {
    if (!selectedBarber) return [];
    if (selectedBarber === "any") return eligibleBarbers.map((b) => b.id);
    return eligibleBarbers.some((b) => b.id === selectedBarber) ? [selectedBarber] : [];
  }, [selectedBarber, eligibleBarbers]);

  const barberName = useCallback(
    (id: string | null | undefined) => barberList.find((b) => b.id === id)?.full_name?.trim() || null,
    [barberList],
  );
  const selectedBarberLabel = selectedBarber === "any" ? t.booking.anyBarber : barberName(selectedBarber) ?? t.booking.anyBarber;

  // Calendar days in the shop's zone.
  const today = useMemo(() => todayInZone(timeZone), [timeZone]);
  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysToDateStr(today, i)),
    [today],
  );
  const openDays = useMemo(() => {
    const set = new Set<string>();
    if (!workingHours) return set;
    for (const d of days) if (isDayOpen(d, availabilityBarberIds, workingHours)) set.add(d);
    return set;
  }, [days, availabilityBarberIds, workingHours]);
  const firstOpenDay = days.find((d) => openDays.has(d)) ?? days[0];
  const activeDate = selectedDate ?? firstOpenDay;

  const busyEnabled = !!shopId && (step === "datetime" || step === "confirm") && !!activeDate && !booked;
  const busyBarberParam = selectedBarber && selectedBarber !== "any" ? selectedBarber : null;
  const { data: busy, loading: busyLoading, error: busyError, refetch: refetchBusy } = useSupabaseQuery<BusySlot[]>(
    () => rpc<BusySlot[]>(supabase, "get_busy_slots", { p_shop_id: shopId, p_day: activeDate, p_barber_id: busyBarberParam }),
    [shopId, activeDate, busyBarberParam, busyEnabled], { enabled: busyEnabled },
  );

  const slotsReady = !!workingHours && !!busy && !busyLoading && !hoursLoading;
  const slots: SlotInfo[] = useMemo(() => {
    if (!slotsReady || !activeDate) return [];
    return computeSlots({
      date: activeDate,
      timeZone,
      durationMin: totalDuration,
      barberIds: availabilityBarberIds,
      workingHours: workingHours ?? [],
      busy: busy ?? [],
    });
  }, [slotsReady, activeDate, timeZone, totalDuration, availabilityBarberIds, workingHours, busy]);

  // A selected time is only valid while it's still free in the latest data.
  const selectedSlotValid = !!selectedSlot && slots.some((s) => s.time === selectedSlot.time && s.available);
  const effectiveSlot = selectedSlot && (!slotsReady || selectedSlotValid) ? selectedSlot : null;
  const slotWentStale = !!selectedSlot && slotsReady && !selectedSlotValid;

  const groupedSlots = useMemo(() => {
    const groups: { key: "morning" | "afternoon" | "evening"; items: SlotInfo[] }[] = [
      { key: "morning", items: [] }, { key: "afternoon", items: [] }, { key: "evening", items: [] },
    ];
    for (const s of slots) {
      const h = Number(s.time.slice(0, 2));
      groups[h < 12 ? 0 : h < 17 ? 1 : 2].items.push(s);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [slots]);
  const anyAvailable = slots.some((s) => s.available);

  // ─── Signed-in prefill (own profile only) ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (cancelled || !user) return;
        setIsSignedIn(true);
        // profiles.phone is private: the own-row phone comes from get_profile_phones.
        const [{ data: profile }, phonesRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() as unknown as Promise<
            QueryResult<{ full_name: string | null }>
          >,
          supabase.rpc("get_profile_phones"),
        ]);
        if (cancelled || !profile) return;
        const ownPhone = ((phonesRes.data ?? []) as { id: string; phone: string | null }[]).find(
          (r) => r.id === user.id,
        )?.phone;
        setClientName((prev) => prev || profile.full_name || "");
        setClientPhone((prev) => prev || ownPhone || "");
      } catch {
        // Guest booking works without a session.
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // ─── Reschedule context: prefill services/barber from the old booking ───
  const { data: rescheduleAppt } = useSupabaseQuery<RescheduleRow>(
    async () => (await supabase
      .from("appointments")
      .select("id, shop_id, barber_id, service_ids")
      .eq("id", rescheduleId as string)
      .maybeSingle()) as QueryResult<RescheduleRow>,
    [rescheduleId], { enabled: !!rescheduleId, retryCount: 0 },
  );

  useEffect(() => {
    if (seededRef.current || !services) return;
    const valid = new Set(services.map((s) => s.id));
    let seeded: string[] = [];
    if (rescheduleAppt && rescheduleAppt.shop_id === shopId) {
      seeded = (rescheduleAppt.service_ids ?? []).filter((id) => valid.has(id));
    } else if (presetServiceId && valid.has(presetServiceId)) {
      seeded = [presetServiceId];
    } else if (rescheduleId && rescheduleAppt === null) {
      return; // still loading the old booking
    }
    seededRef.current = true;
    if (!seeded.length) return;
    // Seeding from async data (URL ?service= or the booking being rescheduled) runs once.
    setSelectedServices((prev) => (prev.length ? prev : seeded));
    if (rescheduleAppt?.barber_id) setSelectedBarber((prev) => prev ?? rescheduleAppt.barber_id);
  }, [services, rescheduleAppt, rescheduleId, presetServiceId, shopId]);

  // Move focus to the new step's heading (screen readers + keyboard), and scroll up.
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
  }, [step, booked]);

  // ─── Handlers ───
  const resetAttempt = () => { idempotencyKeyRef.current = null; setBookingError(null); };

  const toggleService = (id: string) => {
    resetAttempt();
    setSelectionNotice(null);
    setSelectedSlot(null);
    setSelectedServices((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Drop a chosen barber who can't do the new combination.
      if (selectedBarber && selectedBarber !== "any") {
        const b = barberList.find((x) => x.id === selectedBarber);
        if (b && !barberOffersServices(b, next)) setSelectedBarber(null);
      }
      return next;
    });
  };

  const goToBarberStep = () => {
    if (eligibleBarbers.length === 1) setSelectedBarber(eligibleBarbers[0].id);
    else if (selectedBarber && selectedBarber !== "any" && !eligibleBarbers.some((b) => b.id === selectedBarber)) setSelectedBarber(null);
    setStep("barber");
  };

  const chooseBarber = (id: string) => {
    if (id !== selectedBarber) { setSelectedSlot(null); resetAttempt(); }
    setSelectedBarber(id);
  };

  const chooseDate = (d: string) => {
    if (d === activeDate) return;
    setSelectedDate(d);
    setSelectedSlot(null);
    setTimeNotice(null);
    resetAttempt();
  };

  const chooseSlot = (s: SlotInfo) => {
    setSelectedSlot({ time: s.time, startIso: s.startIso });
    setTimeNotice(null);
    resetAttempt();
  };

  const jumpToNextOpenDay = () => {
    const idx = days.indexOf(activeDate);
    const next = days.slice(idx + 1).find((d) => openDays.has(d));
    if (next) chooseDate(next);
  };

  const nameValid = clientName.trim().length >= 2;
  const phoneValid = isValidPhone(clientPhone);
  const canConfirm = nameValid && phoneValid && !!effectiveSlot && !submitting;
  const ctaHint = !nameValid ? t.booking.enterName : !phoneValid ? t.booking.enterValidPhone : null;
  const nameShowsError = nameTouched && !nameValid;
  const phoneShowsError = phoneTouched && clientPhone.trim().length > 0 && !phoneValid;

  const submitBooking = async (): Promise<SubmitOutcome> => {
    const payload = {
      shopId,
      serviceIds: selectedServices,
      barberId: selectedBarber === "any" ? null : selectedBarber,
      clientName: clientName.trim(),
      clientPhone: normalizePhone(clientPhone),
      startTime: effectiveSlot!.startIso,
      source: "online" as const,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    if (MOCK_DATA_ENABLED) {
      // Local preview: the server route has no mock client, so call the in-memory RPC directly.
      const { data, error } = await rpc<BookingResult>(supabase, "create_public_booking", {
        p_shop_id: payload.shopId, p_client_name: payload.clientName, p_client_phone: payload.clientPhone,
        p_service_ids: payload.serviceIds, p_barber_id: payload.barberId, p_start_time: payload.startTime,
        p_source: "online", p_notes: payload.notes ?? null,
      });
      return data && !error ? { ok: true, booking: data } : { ok: false, code: error?.message ?? "INTERNAL" };
    }

    idempotencyKeyRef.current ??= newIdempotencyKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKeyRef.current },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; booking?: BookingResult; code?: string; fieldErrors?: Record<string, string[]> }
        | null;
      if (res.ok && json?.success && json.booking) return { ok: true, booking: json.booking };
      return {
        ok: false,
        code: json?.code ?? (res.status === 429 ? "RATE_LIMITED" : "INTERNAL"),
        fieldErrors: json?.fieldErrors,
      };
    } catch {
      return { ok: false, code: "NETWORK", network: true };
    } finally {
      clearTimeout(timer);
    }
  };

  const cancelOldBooking = async (): Promise<boolean> => {
    if (!rescheduleId) return true;
    try {
      if (MOCK_DATA_ENABLED) {
        const { error } = await rpc(supabase, "cancel_customer_booking", { p_appointment_id: rescheduleId, p_reason: "rescheduled" });
        return !error;
      }
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: rescheduleId, reason: "rescheduled" }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
      return res.ok && !!json?.success;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setNameTouched(true);
    setPhoneTouched(true);
    if (submittingRef.current || !canConfirm) return;
    submittingRef.current = true;
    setSubmitting(true);
    setBookingError(null);
    try {
      const outcome = await submitBooking();
      if (outcome.ok) {
        idempotencyKeyRef.current = null;
        const cancelledOld = await cancelOldBooking();
        setRescheduleWarning(!cancelledOld);
        setBooked(outcome.booking);
        return;
      }

      if (outcome.network) {
        // Keep the same idempotency key so a retry can't create a second booking.
        setBookingError(t.booking.networkError);
        return;
      }
      idempotencyKeyRef.current = null;
      const message = errorText(outcome.code);

      if (TIME_CODES.has(outcome.code)) {
        setSelectedSlot(null);
        setTimeNotice(message);
        refetchBusy();
        setStep("datetime");
        toast.error(message);
        return;
      }
      if (SELECTION_CODES.has(outcome.code)) {
        setSelectedSlot(null);
        setSelectionNotice(message);
        refetchServices();
        refetchBarbers();
        setStep(outcome.code === "BARBER_INVALID" ? "barber" : "services");
        toast.error(message);
        return;
      }
      if (outcome.code === "VALIDATION_FAILED" && outcome.fieldErrors) {
        if (outcome.fieldErrors.clientPhone) setPhoneTouched(true);
      }
      setBookingError(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ─── Success data ───
  const success = useMemo(() => {
    if (!booked) return null;
    const start = new Date(booked.start_time);
    const end = new Date(booked.end_time);
    const dateLabel = formatDate(start, { weekday: "long", day: "numeric", month: "long", timeZone });
    const timeLabel = formatTime(start, { timeZone });
    const servicesLabel = chosenServices.length ? chosenServices.map(localName).join(isRTL ? "، " : ", ") : booked.service_name;
    const barber = barberName(booked.barber_id) ?? t.booking.anyBarber;
    const amount = formatCurrency(Number(booked.price), booked.currency || currency);
    const ref = bookingReference(booked.appointment_id);
    const shopName = shop?.name ?? "";
    const event = {
      uid: booked.appointment_id,
      start, end,
      title: interpolate(t.booking.calendarTitle, { services: servicesLabel, shop: shopName }),
      location: shop?.address ?? shopName,
      description: `${t.booking.reference}: ${ref}`,
    };
    return { start, end, dateLabel, timeLabel, servicesLabel, barber, amount, ref, event };
  }, [booked, formatDate, formatTime, formatCurrency, timeZone, chosenServices, localName, isRTL, barberName, t, currency, shop]);

  const waNumber = toWhatsAppNumber(shop?.whatsapp ?? shop?.phone);
  const waHref = success && waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(interpolate(t.booking.waMessage, {
        shop: shop?.name ?? "", services: success.servicesLabel, date: success.dateLabel, time: success.timeLabel, ref: success.ref,
      }))}`
    : null;
  const telHref = shop?.phone ? `tel:${normalizePhone(shop.phone)}` : null;

  const downloadIcs = () => {
    if (!success) return;
    try {
      const blob = new Blob([buildIcs(success.event)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `halaqy-${success.ref}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t.error.message);
    }
  };

  // ─── Shared labels ───
  const amountLabel = formatCurrency(totalPrice, currency);
  const countLabel = selectedServices.length
    ? `${selectedServices.length} ${selectedServices.length === 1 ? t.booking.service : t.booking.servicesPlural}`
    : null;
  const durationLabel = totalDuration ? formatDuration(totalDuration) : null;
  const stepLabel = (i: number, name: string) => `${t.booking.step} ${i + 1} ${t.booking.of} ${STEPS.length} · ${name}`;
  const policyText = policyHours > 0
    ? interpolate(t.booking.freeCancellationHours, { hours: String(policyHours) })
    : t.booking.freeCancellation;
  const shopHref = href(`/shop/${shopId}`);
  const slideX = isRTL ? -24 : 24;
  const motionProps = {
    initial: { opacity: 0, x: slideX },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -slideX },
    transition: { duration: 0.22 },
  };

  // ─── Whole-page states ───
  if (shopLoading && !shop) {
    return (
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }} dir={dir}>
        <Skeleton variant="text" style={{ height: 14, width: 120, marginBottom: 12 }} />
        <Skeleton variant="text" style={{ height: 32, width: "60%", marginBottom: 24 }} />
        <CardsSkeleton label={t.common.loading} />
      </div>
    );
  }
  if (shopError) {
    return (
      <EmptyState
        tone="error"
        icon={AlertCircle}
        title={t.error.title}
        description={t.error.message}
        action={{ label: t.error.tryAgain, onClick: refetchShop, icon: RefreshCw }}
      />
    );
  }
  if (!shop) {
    return (
      <EmptyState
        icon={Store}
        title={t.booking.shopNotFound}
        description={t.booking.shopNotFoundDesc}
        action={{ label: t.booking.browseShops, href: href("/explore") }}
        headingLevel={2}
      />
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="bk-root" style={{ width: "100%", fontFamily: FF, color: C.ink, maxWidth: 720, margin: "0 auto" }} dir={dir}>
      <AnimatePresence mode="wait" initial={false}>

        {/* ══════════════ SUCCESS ══════════════ */}
        {booked && success ? (
          <motion.section key="booked" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} aria-labelledby="bk-success-title">
            <div className="bk-card bk-success">
              <div style={{
                width: 72, height: 72, borderRadius: "50%", background: C.brass, color: C.onAccent,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              }}>
                <CheckCircle2 size={36} aria-hidden="true" />
              </div>
              <h1
                id="bk-success-title"
                ref={headingRef}
                tabIndex={-1}
                style={{ fontSize: "clamp(26px, 6vw, 36px)", fontWeight: 900, letterSpacing: headingTracking(isRTL, "0.018em"), margin: "0 0 10px", outline: "none" }}
              >
                {t.booking.allSet}
              </h1>
              <p style={{ fontSize: 15, color: C.slate, maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.6 }}>
                {interpolate(t.booking.successMsg, { barber: success.barber, date: success.dateLabel, time: success.timeLabel })}
              </p>

              {rescheduleWarning && (
                <div style={{ maxWidth: 480, margin: "0 auto 20px" }}>
                  <InlineAlert>{t.booking.rescheduleWarning}</InlineAlert>
                </div>
              )}

              <dl className="bk-summary-grid">
                {[
                  { label: t.booking.barber, value: success.barber },
                  { label: t.booking.dateLabel, value: formatDate(success.start, { day: "numeric", month: "short", timeZone }) },
                  { label: t.booking.timeLabel, value: success.timeLabel },
                  { label: t.booking.total, value: success.amount },
                ].map((r) => (
                  <div key={r.label}>
                    <dt style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: "0 0 4px" }}>{r.label}</dt>
                    <dd style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, overflowWrap: "anywhere" }}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              <p style={{ fontSize: 12, color: C.slate, margin: "-8px 0 24px" }}>
                {t.booking.reference}: <strong dir="ltr" style={{ color: C.ink, letterSpacing: "0.06em" }}>{success.ref}</strong>
              </p>

              {/* Add to calendar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 28 }}>
                <button type="button" onClick={downloadIcs} className="bk-btn-secondary">
                  <CalendarPlus size={16} aria-hidden="true" /> {t.booking.addToCalendar}
                </button>
                <a href={googleCalendarUrl(success.event)} target="_blank" rel="noopener noreferrer" className="bk-btn-secondary">
                  <CalendarCheck size={16} aria-hidden="true" /> {t.booking.googleCalendar}
                </a>
              </div>

              {/* Next steps */}
              <div style={{ textAlign: "start", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 28 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>{t.booking.nextSteps}</h2>
                <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: C.slate, lineHeight: 1.55 }}>
                  <li>{interpolate(t.booking.nextStepConfirm, { shop: shop.name, phone: normalizePhone(clientPhone) })}</li>
                  <li>{t.booking.nextStepArrive}</li>
                  <li>{interpolate(t.booking.nextStepPay, { amount: success.amount })}</li>
                  <li>{isSignedIn ? t.booking.manageSignedIn : t.booking.manageGuest} {policyText}.</li>
                </ol>
              </div>

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
                    <MessageCircle size={16} aria-hidden="true" style={{ color: "#1f8f4e" }} /> {t.booking.messageShop}
                  </a>
                )}
                {telHref && (
                  <a href={telHref} className="bk-btn-secondary">
                    <Phone size={16} aria-hidden="true" /> {t.booking.callShop}
                  </a>
                )}
                <Link href={shopHref} className="bk-btn-ghost">{t.booking.backToShop}</Link>
              </div>
              {!isSignedIn && (
                <p id="bk-account-hint" style={{ fontSize: 12, color: C.muted, margin: "12px 0 0" }}>{t.booking.createAccountHint}</p>
              )}
            </div>
          </motion.section>
        ) : step === "services" ? (

        /* ══════════════ STEP 1 — SERVICES ══════════════ */
          <motion.section key="services" {...motionProps} aria-labelledby="bk-step-title">
            {/* Compact shop header */}
            <div className="bk-card" style={{ padding: "16px 18px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, background: C.ink, color: C.onAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Scissors size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.name}</p>
                  {shop.address && (
                    <p style={{ fontSize: 12, color: C.slate, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.address}</span>
                    </p>
                  )}
                </div>
                {numReviews > 0 && (
                  <span
                    style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 800, flexShrink: 0 }}
                    aria-label={`${avgRating.toFixed(1)} / 5 · ${numReviews} ${numReviews === 1 ? t.booking.review : t.booking.reviews}`}
                  >
                    <Star size={14} aria-hidden="true" style={{ color: C.brass, fill: C.brass }} />
                    {avgRating.toFixed(1)}
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.slate }}>({numReviews})</span>
                  </span>
                )}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[{ icon: Wallet, text: t.booking.payInShop }, { icon: CalendarCheck, text: policyText }].map(({ icon: Icon, text }) => (
                  <li key={text} className="bk-pill-info"><Icon size={13} aria-hidden="true" /> {text}</li>
                ))}
              </ul>
            </div>

            {rescheduleId && (
              <div style={{ marginBottom: 16 }}><InlineAlert tone="info">{t.booking.rescheduling}</InlineAlert></div>
            )}

            <StepHeader
              stepIndex={stepIndex} title={t.booking.selectServices} label={stepLabel(0, t.booking.services)}
              isRTL={isRTL} FF={FF} headingRef={headingRef} backLabel={t.common.back} progressLabel={t.booking.progress}
            />

            {selectionNotice && <div style={{ marginBottom: 16 }}><InlineAlert>{selectionNotice}</InlineAlert></div>}

            {servicesLoading && !services ? (
              <CardsSkeleton label={t.common.loading} />
            ) : servicesError ? (
              <EmptyState tone="error" size="sm" icon={AlertCircle} title={t.error.message} action={{ label: t.error.tryAgain, onClick: refetchServices, icon: RefreshCw }} />
            ) : serviceList.length === 0 ? (
              <EmptyState size="sm" icon={Scissors} title={t.booking.noServices} action={{ label: t.booking.backToShop, href: shopHref }} />
            ) : (
              <ServicesGrid
                serviceList={serviceList}
                selected={selectedServices}
                onToggle={toggleService}
                category={selectedCategory}
                setCategory={setSelectedCategory}
                localName={localName}
                formatPrice={(n) => formatCurrency(n, currency)}
                formatDuration={formatDuration}
                labels={{
                  all: t.booking.categoryAll,
                  categories: {
                    hair: t.booking.categoryHair, beard: t.booking.categoryBeard, color: t.booking.categoryColor,
                    kids: t.booking.categoryKids, spa: t.booking.categorySpa, packages: t.booking.categoryPackages,
                  },
                  groupLabel: t.booking.services,
                }}
              />
            )}

            <BottomBar>
              <Totals amount={amountLabel} countLabel={countLabel} durationLabel={durationLabel} />
              <NextButton onClick={goToBarberStep} disabled={selectedServices.length === 0} label={t.common.next} isRTL={isRTL} />
            </BottomBar>
          </motion.section>
        ) : step === "barber" ? (

        /* ══════════════ STEP 2 — BARBER ══════════════ */
          <motion.section key="barber" {...motionProps}>
            <StepHeader
              stepIndex={stepIndex} title={t.booking.chooseBarber} label={stepLabel(1, t.booking.chooseBarber)}
              isRTL={isRTL} FF={FF} headingRef={headingRef} onBack={() => setStep("services")}
              backLabel={t.common.back} progressLabel={t.booking.progress}
            />

            {selectionNotice && <div style={{ marginBottom: 16 }}><InlineAlert>{selectionNotice}</InlineAlert></div>}

            {barbersLoading && !barbers ? (
              <CardsSkeleton label={t.common.loading} height={96} />
            ) : barbersError ? (
              <EmptyState tone="error" size="sm" icon={AlertCircle} title={t.error.message} action={{ label: t.error.tryAgain, onClick: refetchBarbers, icon: RefreshCw }} />
            ) : barberList.length === 0 ? (
              <EmptyState size="sm" icon={Users} title={t.booking.noBarbers} action={{ label: t.booking.backToShop, href: shopHref }} />
            ) : eligibleBarbers.length === 0 ? (
              <EmptyState size="sm" icon={Users} title={t.booking.noBarberForServices} action={{ label: t.common.back, onClick: () => setStep("services") }} />
            ) : (
              <div className="bk-grid-2" role="group" aria-label={t.booking.chooseBarber}>
                {eligibleBarbers.length > 1 && (
                  <button
                    type="button"
                    aria-pressed={selectedBarber === "any"}
                    onClick={() => chooseBarber("any")}
                    className={`bk-option${selectedBarber === "any" ? " is-selected" : ""}`}
                  >
                    <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", background: C.cream, border: `2px dashed ${C.borderStrong}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.slate }}>
                      <Users size={24} />
                    </span>
                    <span style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{t.booking.anyBarber}</span>
                      <span style={{ display: "block", fontSize: 12, color: C.slate, marginTop: 2 }}>{t.booking.anyBarberDesc}</span>
                    </span>
                    {selectedBarber === "any" && <SelectedMark label={t.booking.selected} />}
                  </button>
                )}
                {eligibleBarbers.map((barber) => {
                  const isSelected = selectedBarber === barber.id;
                  const name = barber.full_name?.trim() || "—";
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => chooseBarber(barber.id)}
                      className={`bk-option${isSelected ? " is-selected" : ""}`}
                    >
                      <BarberAvatar name={name} url={barber.avatar_url} />
                      <span style={{ display: "block", fontSize: 15, fontWeight: 800, overflowWrap: "anywhere" }}>{name}</span>
                      {isSelected && <SelectedMark label={t.booking.selected} />}
                    </button>
                  );
                })}
              </div>
            )}

            <BottomBar>
              <Totals amount={amountLabel} countLabel={countLabel} durationLabel={durationLabel} />
              <NextButton
                onClick={() => { setSelectionNotice(null); setStep("datetime"); }}
                disabled={!selectedBarber || availabilityBarberIds.length === 0}
                label={t.common.next}
                isRTL={isRTL}
              />
            </BottomBar>
          </motion.section>
        ) : step === "datetime" ? (

        /* ══════════════ STEP 3 — DATE & TIME ══════════════ */
          <motion.section key="datetime" {...motionProps}>
            <StepHeader
              stepIndex={stepIndex} title={t.booking.pickDateTime} label={stepLabel(2, t.booking.pickDateTime)}
              isRTL={isRTL} FF={FF} headingRef={headingRef} onBack={() => setStep("barber")}
              backLabel={t.common.back} progressLabel={t.booking.progress}
            />

            {timeNotice && <div style={{ marginBottom: 16 }}><InlineAlert>{timeNotice}</InlineAlert></div>}

            {/* Date strip */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t.booking.selectDate}</h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.slate }}>{formatDate(activeDate, "monthYear")}</span>
              </div>
              {hoursLoading && !workingHours ? (
                <div style={{ display: "flex", gap: 8, overflow: "hidden" }} aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="card" style={{ width: 60, height: 76, flexShrink: 0 }} />)}
                </div>
              ) : (
                <div className="bk-date-strip" role="radiogroup" aria-label={t.booking.selectDate}>
                  {days.map((d) => {
                    const isSelected = d === activeDate;
                    const open = openDays.has(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${formatDate(d, "long")}${open ? "" : ` · ${t.booking.closed}`}`}
                        disabled={!open}
                        onClick={() => chooseDate(d)}
                        className={`bk-day${isSelected ? " is-selected" : ""}`}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{d === today ? t.common.today : formatDate(d, "weekdayShort")}</span>
                        <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{formatDate(d, { day: "numeric" })}</span>
                        {!open && <span style={{ fontSize: 10, fontWeight: 600 }}>{t.booking.closed}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time slots */}
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px" }}>
                {t.booking.availableTimes}
                <span style={{ fontWeight: 500, color: C.slate }}> · {formatDate(activeDate, "weekdayDay")}</span>
              </h2>

              {(hoursError || busyError) ? (
                <EmptyState
                  tone="error" size="sm" icon={AlertCircle} title={t.error.message}
                  action={{ label: t.error.tryAgain, onClick: () => { refetchHours(); refetchBusy(); }, icon: RefreshCw }}
                />
              ) : !slotsReady ? (
                <ChipsSkeleton label={t.common.loading} />
              ) : !anyAvailable ? (
                <EmptyState
                  size="sm"
                  icon={Clock}
                  title={t.booking.noTimes}
                  action={days.slice(days.indexOf(activeDate) + 1).some((d) => openDays.has(d))
                    ? { label: t.booking.nextAvailableDay, onClick: jumpToNextOpenDay }
                    : undefined}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {groupedSlots.map((group) => (
                    <div key={group.key} role="group" aria-labelledby={`bk-slots-${group.key}`}>
                      <p id={`bk-slots-${group.key}`} style={{ fontSize: 12, fontWeight: 700, color: C.slate, margin: "0 0 8px" }}>
                        {t.booking[group.key]}
                      </p>
                      <div className="bk-slot-grid">
                        {group.items.map((slot) => {
                          const isSelected = effectiveSlot?.time === slot.time;
                          const label = formatTime(slot.time);
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              aria-pressed={isSelected}
                              aria-label={slot.available ? label : interpolate(t.booking.slotUnavailable, { time: label })}
                              onClick={() => chooseSlot(slot)}
                              className={`bk-slot${isSelected ? " is-selected" : ""}`}
                            >
                              <span dir="ltr">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <BottomBar>
              <Totals
                amount={amountLabel}
                countLabel={countLabel}
                durationLabel={durationLabel}
                extra={
                  <p style={{ fontSize: 12, margin: "2px 0 0", color: effectiveSlot ? C.ink : C.slate, fontWeight: effectiveSlot ? 700 : 500 }}>
                    {effectiveSlot
                      ? interpolate(t.booking.selectedSummary, { date: formatDate(activeDate, "weekdayDay"), time: formatTime(effectiveSlot.time) })
                      : t.booking.pickTime}
                  </p>
                }
              />
              <NextButton onClick={() => { resetAttempt(); setStep("confirm"); }} disabled={!effectiveSlot} label={t.common.next} isRTL={isRTL} />
            </BottomBar>
          </motion.section>
        ) : (

        /* ══════════════ STEP 4 — CONFIRM ══════════════ */
          <motion.section key="confirm" {...motionProps}>
            <StepHeader
              stepIndex={stepIndex} title={t.booking.confirmBooking} label={stepLabel(3, t.booking.confirmBooking)}
              isRTL={isRTL} FF={FF} headingRef={headingRef} onBack={() => setStep("datetime")}
              backLabel={t.common.back} progressLabel={t.booking.progress}
            />

            <form onSubmit={handleSubmit} noValidate className="bk-two-col" aria-busy={submitting}>
              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <fieldset className="bk-card" style={{ padding: 20, margin: 0 }} disabled={submitting}>
                  <legend style={{ fontSize: 16, fontWeight: 800, padding: "0 6px", marginInlineStart: -6 }}>{t.booking.yourDetails}</legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
                    <div>
                      <label htmlFor={nameId} className="field-label">{t.booking.yourName}</label>
                      <input
                        id={nameId}
                        name="name"
                        type="text"
                        className="field-input"
                        autoComplete="name"
                        required
                        maxLength={100}
                        placeholder={t.booking.namePlaceholder}
                        value={clientName}
                        onChange={(e) => { setClientName(e.target.value); resetAttempt(); }}
                        onBlur={() => setNameTouched(true)}
                        aria-invalid={nameShowsError || undefined}
                        aria-describedby={nameShowsError ? nameErrId : undefined}
                      />
                      {nameShowsError && <p id={nameErrId} className="field-error">{t.booking.enterName}</p>}
                    </div>
                    <div>
                      <label htmlFor={phoneId} className="field-label">{t.booking.phoneNumber}</label>
                      <input
                        id={phoneId}
                        name="tel"
                        type="tel"
                        className="field-input"
                        autoComplete="tel"
                        inputMode="tel"
                        dir="ltr"
                        required
                        maxLength={20}
                        placeholder={t.booking.phonePlaceholder}
                        value={clientPhone}
                        onChange={(e) => { setClientPhone(e.target.value); resetAttempt(); }}
                        onBlur={() => setPhoneTouched(true)}
                        aria-invalid={phoneShowsError || undefined}
                        aria-describedby={`${phoneId}-help${phoneShowsError ? ` ${phoneErrId}` : ""}`}
                        style={{ textAlign: isRTL ? "right" : "left" }}
                      />
                      <p id={`${phoneId}-help`} style={{ fontSize: 12, color: C.slate, margin: "6px 0 0" }}>{t.booking.phoneHelp}</p>
                      {phoneShowsError && <p id={phoneErrId} className="field-error">{t.booking.invalidPhone}</p>}
                    </div>
                    <div>
                      <label htmlFor={notesId} className="field-label">
                        {t.booking.notes} <span style={{ fontWeight: 500, color: C.muted }}>({t.common.optional})</span>
                      </label>
                      <textarea
                        id={notesId}
                        name="notes"
                        className="field-input"
                        rows={2}
                        maxLength={500}
                        placeholder={t.booking.notesPlaceholder}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{ resize: "vertical", minHeight: 72 }}
                      />
                    </div>
                  </div>
                </fieldset>

                <div style={{ display: "flex", gap: 14, padding: "16px 18px", background: C.cream, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <Wallet size={20} aria-hidden="true" style={{ color: C.brass, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{t.booking.noPaymentToday}</p>
                    <p style={{ fontSize: 13, color: C.slate, margin: 0, lineHeight: 1.5 }}>
                      {interpolate(t.booking.payInShopNotice, { amount: amountLabel })} {policyText}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <aside className="bk-summary" aria-labelledby="bk-summary-title">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 id="bk-summary-title" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{t.booking.summary}</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, background: C.ink, color: C.onAccent, padding: "3px 10px", borderRadius: 9999 }}>
                    {t.booking.estimated}
                  </span>
                </div>

                <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {chosenServices.map((s) => (
                    <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", background: C.paper, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>{localName(s)}</p>
                        <p style={{ fontSize: 12, color: C.slate, margin: 0 }}>{formatDuration(s.duration)}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(s.price, currency)}</span>
                    </li>
                  ))}
                </ul>

                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, margin: "0 0 16px" }}>
                  {[
                    { label: t.booking.barber, value: selectedBarberLabel },
                    { label: t.booking.dateLabel, value: formatDate(activeDate, "medium") },
                    { label: t.booking.timeLabel, value: effectiveSlot ? formatTime(effectiveSlot.time) : "—" },
                    { label: t.booking.duration, value: durationLabel ?? "—" },
                  ].map((r) => (
                    <div key={r.label} style={{ minWidth: 0 }}>
                      <dt style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: "0 0 3px" }}>{r.label}</dt>
                      <dd style={{ fontSize: 13, fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>{r.value}</dd>
                    </div>
                  ))}
                </dl>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.slate }}>{t.booking.total}</span>
                  <span style={{ fontSize: 26, fontWeight: 900, whiteSpace: "nowrap" }}>{amountLabel}</span>
                </div>

                {slotWentStale && (
                  <div style={{ marginBottom: 12 }}>
                    <InlineAlert>
                      {errorText("SLOT_TAKEN")}{" "}
                      <button type="button" className="bk-link" onClick={() => { setSelectedSlot(null); setStep("datetime"); }}>
                        {t.booking.pickAnotherTime}
                      </button>
                    </InlineAlert>
                  </div>
                )}
                {bookingError && <div style={{ marginBottom: 12 }}><InlineAlert>{bookingError}</InlineAlert></div>}

                <button
                  type="submit"
                  className="bk-cta"
                  style={{ width: "100%", height: 52 }}
                  disabled={!canConfirm}
                  aria-disabled={!canConfirm}
                  aria-busy={submitting}
                  aria-describedby={ctaHint ? ctaHintId : undefined}
                >
                  {submitting ? (
                    <><Loader2 size={18} aria-hidden="true" className="bk-spin" /> {t.common.processing}</>
                  ) : (
                    <><Check size={18} aria-hidden="true" /> {t.booking.confirmBtn}</>
                  )}
                </button>
                {ctaHint && !submitting && (
                  <p id={ctaHintId} style={{ fontSize: 12, color: C.slate, textAlign: "center", margin: "8px 0 0" }}>{ctaHint}</p>
                )}
                <p style={{ fontSize: 12, color: C.slate, textAlign: "center", margin: "10px 0 0", lineHeight: 1.5 }}>
                  {renderTemplate(t.booking.consent, {
                    terms: <Link href={href("/terms")} target="_blank" className="bk-link">{t.auth.terms}</Link>,
                    privacy: <Link href={href("/privacy")} target="_blank" className="bk-link">{t.auth.privacyText}</Link>,
                    policy: <Link href={href("/policy")} target="_blank" className="bk-link">{t.booking.cancellationPolicy}</Link>,
                  })}
                </p>
              </aside>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <style>{BOOKING_CSS}</style>
    </div>
  );
}

function SelectedMark({ label }: { label: string }) {
  return (
    <span className="bk-selected-mark">
      <Check size={12} aria-hidden="true" /> {label}
    </span>
  );
}

function ServicesGrid({
  serviceList, selected, onToggle, category, setCategory, localName, formatPrice, formatDuration, labels,
}: {
  serviceList: ServiceRow[];
  selected: string[];
  onToggle: (id: string) => void;
  category: "all" | ServiceCategory;
  setCategory: (c: "all" | ServiceCategory) => void;
  localName: (s: ServiceRow) => string;
  formatPrice: (n: number) => string;
  formatDuration: (m: number) => string;
  labels: { all: string; categories: Record<ServiceCategory, string>; groupLabel: string };
}) {
  const ORDER: ServiceCategory[] = ["hair", "beard", "color", "kids", "spa", "packages"];
  const present = ORDER.filter((cat) => serviceList.some((s) => getServiceCategory(s.name, s.name_ar) === cat));
  const visible = category === "all" ? serviceList : serviceList.filter((s) => getServiceCategory(s.name, s.name_ar) === category);

  return (
    <>
      {present.length > 1 && (
        <div className="bk-pill-row" role="group" aria-label={labels.groupLabel}>
          {(["all", ...present] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`bk-pill${category === cat ? " is-selected" : ""}`}
            >
              {cat === "all" ? labels.all : labels.categories[cat]}
            </button>
          ))}
        </div>
      )}
      <div className="bk-grid-2" role="group" aria-label={labels.groupLabel}>
        {visible.map((service) => {
          const isSelected = selected.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(service.id)}
              className={`bk-option bk-service${isSelected ? " is-selected" : ""}`}
            >
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, width: "100%" }}>
                <span style={{ fontSize: 15, fontWeight: 800, overflowWrap: "anywhere" }}>{localName(service)}</span>
                <span aria-hidden="true" className="bk-check">{isSelected && <Check size={13} strokeWidth={3} />}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} aria-hidden="true" /> {formatDuration(service.duration)}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>{formatPrice(service.price)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const BOOKING_CSS = `
.bk-root { --bk-radius: 12px; }
.bk-card { background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); }
.bk-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
.bk-option {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
  min-height: 96px; padding: 18px; border-radius: var(--bk-radius); text-align: start; cursor: pointer;
  background: var(--bg-primary); color: var(--text-primary); font: inherit;
  border: 1.5px solid var(--border-subtle); transition: border-color 140ms ease, background 140ms ease;
}
.bk-option:hover { border-color: var(--border-primary); }
.bk-option.is-selected { border: 2px solid var(--text-primary); background: var(--bg-secondary); padding: 17.5px; }
.bk-service { gap: 14px; justify-content: space-between; }
.bk-check {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--border-primary); color: var(--on-accent);
}
.bk-option.is-selected .bk-check { background: var(--accent-brass); border-color: var(--accent-brass); }
.bk-selected-mark {
  position: absolute; top: 12px; inset-inline-end: 12px; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700;
  background: var(--text-primary); color: var(--on-accent);
}
.bk-pill-row { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 12px; margin-bottom: 4px; scrollbar-width: none; }
.bk-pill {
  flex-shrink: 0; min-height: 40px; padding: 8px 16px; border-radius: 9999px; white-space: nowrap; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 700;
  border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-pill.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-pill-info {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary);
}
.bk-date-strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: none; scroll-snap-type: x proximity; }
.bk-day {
  width: 62px; min-height: 76px; flex-shrink: 0; border-radius: 10px; cursor: pointer; scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font: inherit; border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-day:hover:not(:disabled) { border-color: var(--border-primary); }
.bk-day.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-day:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--bg-secondary); }
.bk-slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.bk-slot {
  min-height: 44px; padding: 0 8px; border-radius: 10px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700;
  border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-slot:hover:not(:disabled) { border-color: var(--text-primary); }
.bk-slot.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-slot:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--bg-secondary); text-decoration: line-through; font-weight: 500; }
.bk-bottom-bar {
  position: sticky; bottom: 0; z-index: 10; margin-top: 24px; padding: 14px 0 calc(14px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--bg-primary); border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -8px 16px -12px rgba(28, 22, 17, 0.25);
}
.bk-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px;
  border-radius: 10px; border: none; cursor: pointer; text-decoration: none; font: inherit; font-size: 15px; font-weight: 700;
  background: var(--accent-mint); color: var(--on-accent); transition: filter 150ms ease, transform 150ms ease;
}
.bk-cta:hover:not(:disabled) { filter: brightness(1.08); }
.bk-cta:active:not(:disabled) { transform: translateY(1px); }
.bk-cta:disabled { background: var(--border-subtle); color: var(--text-secondary); cursor: not-allowed; }
.bk-cta-pill { border-radius: 9999px; flex-shrink: 0; }
.bk-btn-secondary, .bk-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px;
  border-radius: 10px; cursor: pointer; text-decoration: none; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--text-primary); background: var(--bg-primary); border: 1px solid var(--border-primary);
}
.bk-btn-secondary:hover { background: var(--bg-secondary); }
.bk-btn-ghost { border-color: transparent; color: var(--text-secondary); }
.bk-btn-ghost:hover { color: var(--text-primary); background: var(--bg-secondary); }
.bk-icon-btn {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; border: 1px solid var(--border-subtle);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--bg-primary); color: var(--text-secondary);
}
.bk-icon-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.bk-link { color: var(--accent-text); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; background: none; border: none; padding: 0; cursor: pointer; font: inherit; }
.bk-two-col { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.bk-summary { background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); padding: 22px; position: sticky; top: 84px; }
.bk-success { padding: 48px 32px; text-align: center; }
.bk-summary-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 20px; text-align: start;
  background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); padding: 16px 18px;
}
.bk-success-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.bk-spin { animation: bk-spin 1s linear infinite; }
@keyframes bk-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .bk-two-col { grid-template-columns: minmax(0, 1fr); }
  .bk-summary { position: static; }
}
@media (max-width: 640px) {
  .bk-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bk-success { padding: 32px 18px; }
  .bk-success-actions > * { flex: 1 1 100%; }
}
@media (max-width: 420px) {
  .bk-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .bk-option { min-height: 0; flex-direction: row; align-items: center; }
  .bk-service { flex-direction: column; align-items: flex-start; }
  .bk-cta-pill { padding: 0 20px; }
}
@media (prefers-reduced-motion: reduce) { .bk-spin { animation: none; } }
`;
