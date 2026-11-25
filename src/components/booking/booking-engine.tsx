"use client";

// ═══════════════════════════════════════════════════════
// Booking flow v2 — orchestrator. Owns the selection state, persistence,
// submit and error routing; each step renders from its own file:
//   step-services → step-barber → step-time → step-review → step-success
// Availability comes from the P0V engine (get_available_slots /
// next_available_slot / is_slot_bookable); the server re-validates every
// booking under a per-barber lock in create_public_booking.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarClock, MapPin, RefreshCw, Scissors, ShieldCheck, Star, Store, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { pluralLabel } from "@/components/ui/booking-cta";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { placeholderFill, placeholderInitials } from "@/components/ui/photo-frame";
import { isSlotBookable, type AvailableSlot, type RpcClient } from "@/lib/availability";
import { OTP_DISABLED, type PublicBookingSecurity } from "@/lib/otp/config";
import { BOOKING_CSS } from "./booking-css";
import { BottomBar, CardsSkeleton, InlineAlert, NextButton, StepHeader, Totals } from "./booking-ui";
import { money } from "./booking-format";
import {
  STEPS,
  buildBookingPayload,
  deserializeBooking,
  errorRoute,
  freshSlot,
  initialStep,
  isUuid,
  lineQuote,
  offersAll,
  parseEntryParams,
  persistKey,
  quoteLines,
  serializeBooking,
  toggleLine,
  type BookingStep,
  type Line,
} from "./booking-state";
import { addDaysToDateStr, isValidPhone, newIdempotencyKey, normalizePhone, safeTimeZone, todayInZone, toWhatsAppNumber } from "./booking-utils";
import { useBookingCatalog } from "./use-booking-data";
import { StepServices } from "./step-services";
import { StepBarber } from "./step-barber";
import { StepTime, type ChosenSlot } from "./step-time";
import { StepReview } from "./step-review";
import { StepSuccess, type BookedSummary } from "./step-success";
import { otpSatisfied, type OtpState } from "./otp-panel";

type SubmitOutcome =
  | { ok: true; appointmentId: string; startIso: string; endIso: string; price: number | null; currency: string | null; barberId: string | null }
  | { ok: false; code: string; network?: boolean };

interface BookingResultLike {
  appointment_id?: string;
  start_time?: string;
  end_time?: string;
  price?: number | string | null;
  currency?: string | null;
  barber_id?: string | null;
}

interface RescheduleRow {
  id: string;
  shop_id: string;
  barber_id: string | null;
  service_ids: string[] | null;
  status: string | null;
}

function toOutcome(b: BookingResultLike | null | undefined): SubmitOutcome {
  if (!b?.appointment_id || !b.start_time) return { ok: false, code: "INTERNAL" };
  return {
    ok: true,
    appointmentId: b.appointment_id,
    startIso: b.start_time,
    endIso: b.end_time ?? b.start_time,
    price: b.price == null ? null : Number(b.price),
    currency: b.currency ?? null,
    barberId: b.barber_id ?? null,
  };
}

export function BookingEngine({
  shopId,
  security = OTP_DISABLED,
  rescheduleAppointmentId,
  shopHref: shopHrefProp,
}: {
  shopId: string;
  security?: PublicBookingSecurity;
  rescheduleAppointmentId?: string;
  /** "Back to shop" target; the branded /b/{slug} page keeps clients inside it. */
  shopHref?: string;
}) {
  const [supabase] = useState(() => createClient());
  const rpcClient = supabase as unknown as RpcClient;
  const { t, locale, dir, isRTL, FF, href, formatLocalDuration: formatDuration, formatLocalNumber: formatNumber, formatLocalDate: formatDate, formatLocalTime: formatTime } = useTranslation();
  const f = t.bookingFlow;
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const entry = useMemo(() => parseEntryParams(searchParams), [searchParams]);
  const rescheduleId = rescheduleAppointmentId ?? entry.rescheduleId;
  const rescheduling = !!rescheduleId;

  const errorText = useCallback((code?: string | null) => {
    const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
    return (code && codes?.[code]) || t.error.message;
  }, [t]);

  // ─── Data ───
  const catalog = useBookingCatalog(supabase, shopId);
  const { data, loading, error: loadError, refetch, servicesById, bookableBarbers } = catalog;
  const shop = data?.shop ?? null;
  const services = useMemo(() => data?.services ?? [], [data]);
  const currency = shop?.currency || "JOD";
  const timeZone = safeTimeZone(shop?.timezone);
  const policyHours = shop?.cancellation_policy_hours ?? 0;
  const today = useMemo(() => todayInZone(timeZone), [timeZone]);
  const tomorrow = useMemo(() => addDaysToDateStr(today, 1), [today]);

  // ─── Selection state ───
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<BookingStep>("services");
  const [lines, setLines] = useState<Line[]>([]);
  const [barber, setBarber] = useState<string | null>(null); // uuid | "any"
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<ChosenSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [otp, setOtp] = useState<OtpState | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeNotice, setTimeNotice] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [slotStale, setSlotStale] = useState(false);
  const [booked, setBooked] = useState<BookedSummary | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRenderRef = useRef(true);

  // ─── Seed once the catalogue is loaded: reschedule > saved session > URL ───
  useEffect(() => {
    if (ready || !data) return;
    let cancelled = false;
    const valid = new Set(data.services.map((s) => s.id));
    const barberOk = (id: string | null) =>
      id === "any" || (!!id && (data.barbers ?? []).some((b) => b.id === id && b.online_bookable));

    (async () => {
      if (rescheduleId) {
        const db = supabase as unknown as {
          from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
        };
        const { data: row, error } = await db
          .from("appointments")
          .select("id, shop_id, barber_id, service_ids, status")
          .eq("id", rescheduleId)
          .maybeSingle();
        if (cancelled) return;
        const appt = row as RescheduleRow | null;
        if (error || !appt || appt.shop_id !== shopId) {
          setRescheduleError(errorText("APPT_NOT_FOUND"));
          setReady(true);
          return;
        }
        // Variants and notes come from the stored lines when present.
        const linesRes = await (supabase as unknown as {
          from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string) => PromiseLike<{ data: unknown; error: unknown }> } } };
        })
          .from("appointment_services")
          .select("service_id, variant_id, client_note, sort")
          .eq("appointment_id", appt.id)
          .order("sort")
          .then((r) => r, () => ({ data: null, error: true }));
        if (cancelled) return;
        const stored = (linesRes.data as { service_id: string | null; variant_id: string | null; client_note: string | null }[] | null) ?? [];
        const seeded: Line[] = stored.length
          ? stored.filter((l) => l.service_id && valid.has(l.service_id)).map((l) => ({ serviceId: l.service_id!, variantId: l.variant_id, note: l.client_note ?? "" }))
          : (appt.service_ids ?? []).filter((id) => valid.has(id)).map((id) => ({ serviceId: id, variantId: null, note: "" }));
        // Services the shop no longer offers online still move with the booking.
        const ids = seeded.length ? seeded : (appt.service_ids ?? []).map((id) => ({ serviceId: id, variantId: null, note: "" }));
        setLines(ids);
        setBarber(appt.barber_id ?? "any");
        setStep("time");
        setReady(true);
        return;
      }

      let restored = null;
      try {
        restored = deserializeBooking(window.sessionStorage.getItem(persistKey(shopId)), shopId);
      } catch {
        restored = null;
      }
      if (restored) {
        const restoredLines = restored.lines.filter((l) => valid.has(l.serviceId));
        if (restoredLines.length) {
          const restoredBarber = barberOk(restored.barber) ? restored.barber : null;
          const restoredSlot = restoredBarber ? freshSlot(restored.slot) : null;
          setLines(restoredLines);
          setBarber(restoredBarber);
          setDate(restored.date);
          setSlot(restoredSlot);
          setName(restored.name);
          setPhone(restored.phone);
          setNotes(restored.notes);
          setOtp(restored.otp);
          setStep(initialStep(entry, { ...restored, lines: restoredLines, barber: restoredBarber, slot: restoredSlot }, valid));
          setReady(true);
          return;
        }
      }

      const preset = entry.serviceIds.filter((id) => valid.has(id));
      if (preset.length) {
        setLines(preset.map((id) => ({ serviceId: id, variantId: null, note: "" })));
        const presetBarber = barberOk(entry.barberId) ? entry.barberId : null;
        setBarber(presetBarber);
        setStep(initialStep({ ...entry, barberId: presetBarber }, null, valid));
      } else if (barberOk(entry.barberId)) {
        setBarber(entry.barberId);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [ready, data, rescheduleId, shopId, supabase, entry, errorText]);

  // ─── Persist (sessionStorage) so a refresh keeps every selection ───
  useEffect(() => {
    if (!ready || booked || rescheduling) return;
    try {
      window.sessionStorage.setItem(
        persistKey(shopId),
        serializeBooking({ shopId, step, lines, barber, date, slot, name, phone, notes, otp }),
      );
    } catch {
      // Private mode / storage blocked: the flow still works without it.
    }
  }, [ready, booked, rescheduling, shopId, step, lines, barber, date, slot, name, phone, notes, otp]);

  // ─── Signed-in prefill (own profile only) ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (cancelled || !user) return;
        setIsSignedIn(true);
        const [{ data: profile }, phonesRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() as unknown as Promise<{ data: { full_name: string | null } | null }>,
          supabase.rpc("get_profile_phones"),
        ]);
        if (cancelled || !profile) return;
        const ownPhone = ((phonesRes.data ?? []) as { id: string; phone: string | null }[]).find((r) => r.id === user.id)?.phone;
        setName((prev) => prev || profile.full_name || "");
        setPhone((prev) => prev || ownPhone || "");
      } catch {
        // Guest booking works without a session.
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // Focus the new step's heading (screen readers + keyboard) and scroll up.
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
  }, [step, booked]);

  // ─── Derived ───
  const serviceIds = useMemo(() => lines.map((l) => l.serviceId), [lines]);
  const eligibleBarbers = useMemo(
    () => bookableBarbers.filter((b) => offersAll(b.barber_services, serviceIds)),
    [bookableBarbers, serviceIds],
  );
  const chosenBarber = barber && barber !== "any" ? bookableBarbers.find((b) => b.id === barber) ?? null : null;
  const total = useMemo(
    () => quoteLines(lines, servicesById, chosenBarber?.barber_services ?? null),
    [lines, servicesById, chosenBarber],
  );
  const barberLabel = barber === "any" || !barber ? t.booking.anyBarber : chosenBarber?.full_name?.trim() || t.booking.anyBarber;
  const localName = useCallback(
    (id: string) => {
      const s = servicesById.get(id);
      return s ? (isRTL && s.name_ar ? s.name_ar : s.name) : "";
    },
    [servicesById, isRTL],
  );
  const nameValid = name.trim().length >= 2;
  const phoneValid = isValidPhone(phone);
  const otpOk = !security.otpRequired || otpSatisfied(otp, phone) || false;
  const waNumber = toWhatsAppNumber(shop?.whatsapp ?? shop?.phone);
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;

  // Re-check the chosen time when the review step opens (it may have gone).
  useEffect(() => {
    if (step !== "review" || !slot || !serviceIds.length) return;
    let cancelled = false;
    isSlotBookable(rpcClient, {
      shopId,
      start: slot.startIso,
      items: serviceIds,
      barberId: barber && barber !== "any" ? barber : null,
      ignoreAppointmentId: rescheduleId ?? undefined,
    })
      .then((ok) => { if (!cancelled) setSlotStale(!ok); })
      .catch(() => { if (!cancelled) setSlotStale(false); });
    return () => { cancelled = true; };
  }, [step, slot, serviceIds, barber, shopId, rpcClient, rescheduleId]);

  // ─── Handlers ───
  const resetAttempt = () => { idempotencyKeyRef.current = null; setSubmitError(null); };

  const onToggle = (serviceId: string, variantId?: string | null) => {
    resetAttempt();
    setSelectionNotice(null);
    setSlot(null);
    setLines((prev) => {
      const next = toggleLine(prev, serviceId, variantId ?? null);
      if (next.length === prev.length && !prev.some((l) => l.serviceId === serviceId)) toast.info(f.maxServices);
      const ids = next.map((l) => l.serviceId);
      if (chosenBarber && !offersAll(chosenBarber.barber_services, ids)) setBarber(null);
      return next;
    });
  };

  const onLineNote = (serviceId: string, note: string) =>
    setLines((prev) => prev.map((l) => (l.serviceId === serviceId ? { ...l, note: note.slice(0, 300) } : l)));

  const goFromServices = () => {
    setSelectionNotice(null);
    // One barber can do it all: skip the barber step.
    if (eligibleBarbers.length === 1) {
      setBarber(eligibleBarbers[0].id);
      setStep("time");
      return;
    }
    if (barber && barber !== "any" && !eligibleBarbers.some((b) => b.id === barber)) setBarber(null);
    setStep("barber");
  };

  const chooseBarber = (id: string) => {
    if (id !== barber) { setSlot(null); resetAttempt(); }
    setBarber(id);
    setTimeNotice(null);
    setStep("time");
  };

  const chooseSlot = (s: AvailableSlot) => {
    setSlot({ startIso: s.startIso, localDate: s.localDate, localTime: s.localTime });
    setDate(s.localDate);
    setTimeNotice(null);
    setSlotStale(false);
    resetAttempt();
    setStep("review");
  };

  const backFromTime = () => {
    if (rescheduling) return;
    setStep(eligibleBarbers.length === 1 ? "services" : "barber");
  };

  const resetCaptcha = () => {
    if (!security.turnstileSiteKey) return;
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  const postJson = async (url: string, body: unknown, idemKey?: string): Promise<SubmitOutcome> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idemKey ? { "Idempotency-Key": idemKey } : {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; booking?: BookingResultLike; code?: string } | null;
      if (res.ok && json?.success && json.booking) return toOutcome(json.booking);
      return { ok: false, code: json?.code ?? (res.status === 429 ? "RATE_LIMITED" : "INTERNAL") };
    } catch {
      return { ok: false, code: "NETWORK", network: true };
    } finally {
      clearTimeout(timer);
    }
  };

  const submitBooking = async (): Promise<SubmitOutcome> => {
    if (!slot) return { ok: false, code: "SLOT_TAKEN" };
    if (rescheduleId) {
      return postJson("/api/booking/reschedule", {
        appointmentId: rescheduleId,
        date: slot.localDate,
        time: slot.localTime,
        barberId: barber && barber !== "any" && isUuid(barber) ? barber : null,
      });
    }
    const payload = buildBookingPayload({
      shopId, lines, barber, name, phone: normalizePhone(phone), startIso: slot.startIso, notes,
      src: entry.src, entry: entry.entry, otpToken: otp?.token ?? null, captchaToken,
    });
    if (MOCK_DATA_ENABLED) {
      // Local preview: the server route has no mock client, so call the RPC directly.
      const c = supabase as unknown as { rpc: (f: string, a: unknown) => PromiseLike<{ data: unknown; error: { message?: string } | null }> };
      const { data: row, error } = await c.rpc("create_public_booking", {
        p_shop_id: shopId, p_client_name: payload.clientName, p_client_phone: payload.clientPhone,
        p_service_ids: serviceIds, p_barber_id: payload.barberId, p_start_time: payload.startTime,
        p_source: "online", p_notes: payload.notes ?? null,
      });
      return row && !error ? toOutcome(row as BookingResultLike) : { ok: false, code: error?.message ?? "INTERNAL" };
    }
    idempotencyKeyRef.current ??= newIdempotencyKey();
    return postJson("/api/booking", payload, idempotencyKeyRef.current);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || !slot) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const outcome = await submitBooking();
      if (outcome.ok) {
        idempotencyKeyRef.current = null;
        try { window.sessionStorage.removeItem(persistKey(shopId)); } catch { /* ignore */ }
        const bookedBarber = outcome.barberId ? bookableBarbers.find((b) => b.id === outcome.barberId) : null;
        setBooked({
          appointmentId: outcome.appointmentId,
          startIso: outcome.startIso,
          endIso: outcome.endIso,
          price: outcome.price ?? total.price,
          currency: outcome.currency ?? currency,
          isFrom: total.isFrom,
          barberLabel: bookedBarber?.full_name?.trim() || barberLabel,
          servicesLabel: lines.map((l) => localName(l.serviceId)).filter(Boolean).join(isRTL ? "، " : ", "),
        });
        toast.success(rescheduling ? f.rescheduledTitle : t.booking.allSet);
        return;
      }
      if (outcome.network) {
        // Same idempotency key on retry, so it can't create a second booking.
        setSubmitError(t.booking.networkError);
        return;
      }
      idempotencyKeyRef.current = null;
      resetCaptcha();
      const message = errorText(outcome.code);
      switch (errorRoute(outcome.code)) {
        case "time":
          setSlot(null);
          setTimeNotice(message);
          setSlotRefresh((n) => n + 1);
          setStep("time");
          toast.error(message);
          return;
        case "services":
        case "barber":
          setSlot(null);
          setSelectionNotice(message);
          refetch();
          setStep(errorRoute(outcome.code) === "barber" ? "barber" : "services");
          toast.error(message);
          return;
        case "otp":
          setOtp((prev) => (prev ? { ...prev, token: null, verifiedAt: null } : prev));
          setSubmitError(message);
          return;
        default:
          setSubmitError(message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ─── Labels ───
  const amountBase = money(total.price, currency, locale);
  const amountLabel = total.isFrom ? interpolate(f.fromPrice, { price: amountBase }) : amountBase;
  // CLDR plurals + localised digits (Arabic: "خدمتان", Arabic-Indic digits like the price).
  const countLabel = lines.length
    ? pluralLabel(t.primitives.servicesCount, lines.length, locale, formatNumber(lines.length))
    : null;
  const metaLabel = [countLabel, total.duration ? formatDuration(total.duration) : null].filter(Boolean).join(" · ") || null;
  // The H1 already names the step, so the eyebrow is just the position.
  const stepLabel = (i: number) => `${t.booking.step} ${formatNumber(i + 1)} ${t.booking.of} ${formatNumber(STEPS.length)}`;
  const ratingText = (avg: number) => formatNumber(avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const policyText = policyHours > 0
    ? interpolate(t.booking.freeCancellationHours, { hours: formatNumber(policyHours) })
    : t.booking.freeCancellation;
  const shopHref = shopHrefProp ?? href(`/shop/${shopId}`);
  const slideX = isRTL ? -12 : 12;
  // Crossfade + a 12px slide in reading direction; opacity only under reduced motion.
  const motionProps = {
    initial: { opacity: 0, x: reduceMotion ? 0 : slideX },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reduceMotion ? 0 : -slideX },
    transition: { duration: 0.28, ease: [0.05, 0.7, 0.1, 1] as const },
  };

  // ─── Whole-page states ───
  if ((loading && !data) || (data && !ready)) {
    return (
      <div role="status" aria-busy="true" aria-label={t.common.loading} style={{ width: "100%", maxWidth: 1120, margin: "0 auto" }} dir={dir}>
        <Skeleton variant="text" style={{ height: 14, width: 120, marginBottom: 12 }} />
        <Skeleton variant="text" style={{ height: 32, width: "60%", marginBottom: 24 }} />
        <CardsSkeleton label={t.common.loading} />
      </div>
    );
  }
  if (loadError) {
    return (
      <EmptyState
        tone="error" icon={AlertCircle} title={t.error.title} description={t.error.message}
        action={{ label: t.error.tryAgain, onClick: refetch, icon: RefreshCw }}
      />
    );
  }
  if (!shop) {
    return (
      <EmptyState
        icon={Store} title={t.booking.shopNotFound} description={t.booking.shopNotFoundDesc}
        action={{ label: t.booking.browseShops, href: href("/explore") }} headingLevel={2}
      />
    );
  }
  if (rescheduleError) {
    return (
      <EmptyState
        tone="error" icon={AlertCircle} title={rescheduleError}
        action={{ label: t.booking.backToShop, href: shopHref }} headingLevel={2}
      />
    );
  }

  const stepIndex = STEPS.indexOf(step);
  const header = (title: string, onBack?: () => void) => (
    <StepHeader
      stepIndex={stepIndex} title={title} label={stepLabel(stepIndex)} isRTL={isRTL} FF={FF}
      headingRef={headingRef} onBack={onBack} backLabel={t.common.back} progressLabel={t.booking.progress}
      stepLabels={[t.booking.services, t.booking.barber, t.booking.timeLabel, t.common.confirm]}
    />
  );
  const shopName = isRTL && shop.name_ar ? shop.name_ar : shop.name;
  const importantInfo = (isRTL ? shop.important_info_ar || shop.important_info_en : shop.important_info_en || shop.important_info_ar) || null;
  const rating = data?.rating ?? { avg: 0, count: 0 };
  const shopFill = placeholderFill(shop.id);
  const showAside = !booked && step !== "review";
  // Desktop: the summary aside carries the step's primary action (§6.5).
  const asideAction: { onClick: () => void; disabled: boolean } | null =
    step === "services"
      ? { onClick: goFromServices, disabled: lines.length === 0 }
      : step === "barber"
        ? {
            onClick: () => { if (barber) chooseBarber(barber); },
            disabled: !barber || (barber !== "any" && !eligibleBarbers.some((b) => b.id === barber)),
          }
        : step === "time"
          ? { onClick: () => { if (slot) setStep("review"); }, disabled: !slot }
          : null;

  // Desktop summary (≥ 960px container): what's chosen so far, live.
  const summaryAside = (
    <aside className="bk-aside" aria-label={t.booking.summary}>
      <div className="bk-summary-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 56, height: 56, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              backgroundImage: `repeating-linear-gradient(135deg, ${shopFill.hatch} 0 2px, transparent 2px 12px), ${shopFill.bg}`,
              color: shopFill.fg, fontSize: 19, fontWeight: 800,
            }}
          >
            {placeholderInitials(shopName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="text-title" dir="auto" style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{shopName}</p>
            {shop.address && (
              <p className="text-meta" dir="auto" style={{ color: "var(--color-ink-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{shop.address}</p>
            )}
          </div>
        </div>

        {lines.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: "16px 0 0", borderTop: "1px solid var(--color-line)", display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.map((l) => {
              const svc = servicesById.get(l.serviceId);
              if (!svc) return null;
              const q = lineQuote(svc, l.variantId, chosenBarber?.barber_services.find((r) => r.service_id === svc.id) ?? null);
              const price = svc.price_type === "free" ? f.free : q.isFrom ? interpolate(f.fromPrice, { price: money(q.price, currency, locale) }) : money(q.price, currency, locale);
              return (
                <li key={l.serviceId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 500, overflowWrap: "anywhere" }}>{localName(l.serviceId)}</span>
                    <span className="text-meta" style={{ display: "block", color: "var(--color-ink-muted)" }}>{formatDuration(q.duration)}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{price}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-meta" style={{ margin: 0, padding: "16px 0 0", borderTop: "1px solid var(--color-line)", color: "var(--color-ink-muted)" }}>{t.booking.selectServices}</p>
        )}

        {(barber || slot) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--color-ink-soft)" }}>
            {barber && (
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <User size={16} aria-hidden="true" style={{ color: "var(--color-ink-muted)", flexShrink: 0 }} />
                {barberLabel}
              </p>
            )}
            {slot && (
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarClock size={16} aria-hidden="true" style={{ color: "var(--color-ink-muted)", flexShrink: 0 }} />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatDate(new Date(slot.startIso), { weekday: "short", day: "numeric", month: "short", timeZone })} · {formatTime(slot.localTime)}
                </span>
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingTop: 16, borderTop: "1px solid var(--color-line)" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{t.booking.total}</span>
          {lines.length ? (
            <span style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{amountLabel}</span>
          ) : (
            <span className="text-meta" style={{ color: "var(--color-ink-muted)", textAlign: "end" }}>{f.selectAtLeastOne}</span>
          )}
        </div>
        {asideAction && (
          <button
            type="button"
            onClick={asideAction.onClick}
            disabled={asideAction.disabled}
            className="bk-cta bk-aside-cta"
          >
            {f.continue}
            {isRTL ? <ArrowLeft size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
          </button>
        )}
        <p className="text-meta" style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6, color: "var(--color-ink-muted)" }}>
          <ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-success)" }} />
          <span>{t.booking.payInShop} · {policyText}</span>
        </p>
      </div>
    </aside>
  );

  return (
    <div className="bk-root" style={{ width: "100%", fontFamily: FF, maxWidth: showAside ? 1120 : 960, margin: "0 auto" }} dir={dir}>
      <div className={showAside ? "bk-layout" : undefined}>
      <div style={{ minWidth: 0, maxWidth: showAside ? 720 : undefined, width: "100%" }}>
      <AnimatePresence mode="wait" initial={false}>
        {booked ? (
          <motion.div key="booked" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <StepSuccess
              booked={booked}
              shop={{ id: shop.id, name: shopName, address: shop.address, phone: shop.phone, whatsapp: shop.whatsapp }}
              timeZone={timeZone}
              clientPhone={phone}
              policyHours={policyHours}
              isSignedIn={isSignedIn}
              rescheduled={rescheduling}
              headingRef={headingRef}
            />
          </motion.div>
        ) : step === "services" ? (
          <motion.section key="services" {...motionProps}>
            <div className="bk-card bk-shop-card" style={{ padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    backgroundImage: `repeating-linear-gradient(135deg, ${shopFill.hatch} 0 2px, transparent 2px 12px), ${shopFill.bg}`,
                    color: shopFill.fg, fontSize: 17, fontWeight: 800,
                  }}
                >
                  {placeholderInitials(shopName)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="text-title" dir="auto" style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{shopName}</p>
                  {shop.address && (
                    <p className="text-meta" style={{ color: "var(--color-ink-muted)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                      <bdi style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.address}</bdi>
                    </p>
                  )}
                </div>
                {rating.count > 0 && (
                  <span
                    style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
                    aria-label={`${interpolate(t.shopPage.ratingLabel, { rating: ratingText(rating.avg) })} · ${pluralLabel(t.primitives.reviewsCount, rating.count, locale, formatNumber(rating.count))}`}
                  >
                    <Star size={15} aria-hidden="true" className="fill-accent text-accent" />
                    {ratingText(rating.avg)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-muted)" }}>({formatNumber(rating.count)})</span>
                  </span>
                )}
              </div>
              <p className="text-meta" style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6, color: "var(--color-ink-muted)" }}>
                <ShieldCheck size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "var(--color-success)" }} />
                <span>{t.booking.payInShop} · {policyText}</span>
              </p>
            </div>

            {header(t.booking.selectServices)}
            {selectionNotice && <div style={{ marginBottom: 16 }}><InlineAlert>{selectionNotice}</InlineAlert></div>}

            <StepServices
              services={services}
              categories={data?.categories ?? []}
              lines={lines}
              currency={currency}
              onToggle={onToggle}
              shopHref={shopHref}
            />

            <BottomBar>
              <Totals amount={amountLabel} meta={metaLabel} />
              <NextButton onClick={goFromServices} disabled={lines.length === 0} label={t.common.next} isRTL={isRTL} />
            </BottomBar>
          </motion.section>
        ) : step === "barber" ? (
          <motion.section key="barber" {...motionProps}>
            {header(t.booking.chooseBarber, () => setStep("services"))}
            {selectionNotice && <div style={{ marginBottom: 16 }}><InlineAlert>{selectionNotice}</InlineAlert></div>}
            {eligibleBarbers.length === 0 && bookableBarbers.length > 0 ? (
              <EmptyState
                size="sm" icon={Scissors} title={t.booking.noBarberForServices}
                action={{ label: t.common.back, onClick: () => setStep("services") }}
              />
            ) : (
              <StepBarber
                client={rpcClient}
                shopId={shopId}
                barbers={eligibleBarbers}
                lines={lines}
                servicesById={servicesById}
                selected={barber}
                onChoose={chooseBarber}
                currency={currency}
                today={today}
                tomorrow={tomorrow}
              />
            )}
            <BottomBar>
              <Totals amount={amountLabel} meta={metaLabel} />
              <NextButton
                onClick={() => barber && chooseBarber(barber)}
                disabled={!barber || (barber !== "any" && !eligibleBarbers.some((b) => b.id === barber))}
                label={t.common.next}
                isRTL={isRTL}
              />
            </BottomBar>
          </motion.section>
        ) : step === "time" || !slot ? (
          <motion.section key="time" {...motionProps}>
            {rescheduling && <div style={{ marginBottom: 16 }}><InlineAlert tone="info">{t.booking.rescheduling}</InlineAlert></div>}
            {header(t.booking.pickDateTime, rescheduling ? undefined : backFromTime)}
            <StepTime
              client={rpcClient}
              shopId={shopId}
              serviceIds={serviceIds}
              barberId={barber && barber !== "any" ? barber : null}
              today={today}
              tomorrow={tomorrow}
              date={date}
              onDate={(d) => { setDate(d); setTimeNotice(null); }}
              selected={slot}
              onChoose={chooseSlot}
              notice={timeNotice}
              ignoreAppointmentId={rescheduleId}
              onAnyBarber={!rescheduling && barber !== "any" && eligibleBarbers.length > 1 ? () => { setBarber("any"); setSlot(null); } : null}
              waHref={waHref}
              refreshKey={slotRefresh}
            />
            <BottomBar>
              <Totals amount={amountLabel} meta={[barberLabel, metaLabel].filter(Boolean).join(" · ")} />
              <NextButton onClick={() => slot && setStep("review")} disabled={!slot} label={t.common.next} isRTL={isRTL} />
            </BottomBar>
          </motion.section>
        ) : (
          <motion.section key="review" {...motionProps}>
            {header(rescheduling ? f.confirmNewTime : t.booking.confirmBooking, () => setStep("time"))}
            <StepReview
              lines={lines}
              servicesById={servicesById}
              barberServices={chosenBarber?.barber_services ?? null}
              barberLabel={barberLabel}
              slot={slot}
              timeZone={timeZone}
              currency={currency}
              total={total}
              policyHours={policyHours}
              importantInfo={importantInfo}
              onLineNote={onLineNote}
              name={name}
              phone={phone}
              notes={notes}
              setName={(v) => { setName(v); resetAttempt(); }}
              setPhone={(v) => { setPhone(v); resetAttempt(); }}
              setNotes={setNotes}
              nameValid={nameValid}
              phoneValid={phoneValid}
              security={security}
              otp={otp}
              onOtp={setOtp}
              otpOk={otpOk}
              captchaToken={captchaToken}
              onCaptcha={setCaptchaToken}
              captchaKey={captchaKey}
              client={supabase}
              submitting={submitting}
              error={submitError}
              staleNotice={slotStale ? (
                <div style={{ marginBottom: 12 }}>
                  <InlineAlert>
                    {errorText("SLOT_TAKEN")}{" "}
                    <button type="button" className="bk-link" onClick={() => { setSlot(null); setStep("time"); setSlotRefresh((n) => n + 1); }}>
                      {t.booking.pickAnotherTime}
                    </button>
                  </InlineAlert>
                </div>
              ) : null}
              onSubmit={handleSubmit}
              rescheduling={rescheduling}
              isSignedIn={isSignedIn}
            />
          </motion.section>
        )}
      </AnimatePresence>
      </div>
      {showAside && summaryAside}
      </div>

      <style>{BOOKING_CSS}</style>
    </div>
  );
}
