"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Compass,
  History,
  Info,
  Phone,
  Repeat,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import type { MyAppointment } from "@/lib/supabase/database.types";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { RatingInput } from "@/components/ui/rating-stars";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  buttonClasses,
  errorTextClasses,
  helperClasses,
  inputClasses,
  labelClasses,
  textareaClasses,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { PortalShell } from "./_components/portal-shell";
import {
  cancellationState,
  classifyAppointment,
  errorMessageFor,
  isValidOptionalPhone,
  normalizeOptionalPhone,
  rebookingNudge,
  rpcErrorCode,
  statusOf,
  type AppointmentTab,
} from "./customer-utils";

interface PortalUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

const REVIEW_MAX = 500;
const REASON_MAX = 200;

function AppointmentSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card sm:grid sm:grid-cols-[200px_minmax(0,1fr)]">
      <Skeleton className="aspect-[3/1] w-full rounded-none sm:aspect-auto sm:h-full sm:min-h-[180px]" />
      <div className="space-y-3 p-4 sm:p-5">
        <Skeleton variant="pill" className="h-6 w-24" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-2/5" />
        <div className="flex gap-2 border-t border-line pt-4">
          <Skeleton variant="button" className="h-9 w-28" />
          <Skeleton variant="button" className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { t, href, formatCurrency, formatDate, formatTime, formatNumber } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<PortalUser | null>(null);
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [activeTab, setActiveTab] = useState<AppointmentTab>("upcoming");
  const [now, setNow] = useState(() => new Date());

  // Profile dialog
  const [editProfile, setEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileErrors, setProfileErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  // Review dialog
  const [reviewAppt, setReviewAppt] = useState<MyAppointment | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Confirmations
  const [cancelTarget, setCancelTarget] = useState<MyAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const errorText = useCallback((code: string | null) => errorMessageFor(t.error, code), [t.error]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        router.replace(href("/customer/login"));
        return;
      }

      // profiles.phone is private: the own-row phone comes from get_profile_phones.
      const [{ data: profile }, phonesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", authUser.id).maybeSingle(),
        supabase.rpc("get_profile_phones"),
      ]);
      const ownPhone = ((phonesRes.data ?? []) as { id: string; phone: string | null }[]).find(
        (r) => r.id === authUser.id,
      )?.phone;

      if (profile?.role && profile.role !== "customer") {
        router.replace(href("/"));
        return;
      }

      const fullName = profile?.full_name || (authUser.user_metadata?.full_name as string | undefined) || "";
      const phone = ownPhone || "";
      setUser({ id: authUser.id, full_name: fullName, email: authUser.email || "", phone });

      // Links client rows (any shop) matching the account's VERIFIED phone or
      // email. Ownership is clients.auth_user_id only; failures are not fatal.
      // Falls back to the legacy RPC until migration 002900 is applied.
      const rpc = supabase as unknown as { rpc: (fn: string) => PromiseLike<{ error: unknown }> };
      const claim = await rpc.rpc("claim_customer_identity");
      if (claim.error) await supabase.rpc("link_customer_client");

      const { data, error } = await supabase.rpc("get_my_appointments");
      if (error) {
        setStatus("error");
        return;
      }
      setAppointments((data ?? []) as MyAppointment[]);
      setNow(new Date());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [supabase, router, href]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep "upcoming" honest while the page stays open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // /customer/profile redirects here with ?edit=profile.
  useEffect(() => {
    if (status !== "ok" || !user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") === "profile") {
        openEditProfile();
        params.delete("edit");
        const qs = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user]);

  const grouped = useMemo(() => {
    const upcoming: MyAppointment[] = [];
    const past: MyAppointment[] = [];
    const cancelled: MyAppointment[] = [];
    for (const a of appointments) {
      const tab = classifyAppointment(a, now);
      (tab === "upcoming" ? upcoming : tab === "past" ? past : cancelled).push(a);
    }
    // Soonest first for upcoming; newest first otherwise.
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    return { upcoming, past, cancelled };
  }, [appointments, now]);

  const displayList = grouped[activeTab];
  const completedCount = appointments.filter((a) => statusOf(a) === "completed").length;
  const thisMonthCount = appointments.filter((a) => {
    const d = new Date(a.start_time);
    return statusOf(a) !== "cancelled" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const nudge = useMemo(
    () => (status === "ok" && grouped.upcoming.length === 0 ? rebookingNudge(appointments, now) : null),
    [status, grouped.upcoming.length, appointments, now],
  );
  const loading = status === "loading";
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "";

  // ─── Profile ───
  function openEditProfile() {
    setEditName(user?.full_name || "");
    setEditPhone(user?.phone || "");
    setProfileErrors({});
    setEditProfile(true);
  }

  async function handleSaveProfile(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) return;
    const name = editName.trim().replace(/\s+/g, " ");
    const phone = normalizeOptionalPhone(editPhone);
    const errors: { name?: string; phone?: string } = {};
    if (name.length < 2 || name.length > 80) errors.name = t.customer.nameRequired;
    if (!isValidOptionalPhone(phone)) errors.phone = t.customer.phoneInvalid;
    setProfileErrors(errors);
    if (errors.name || errors.phone) return;

    setSaving(true);
    // Phone lives on profiles (contact only) — never in auth metadata, and it
    // is never used to match bookings.
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone: phone || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(errorText(rpcErrorCode(error)) || t.customer.profileSaveFailed);
      return;
    }
    setUser({ ...user, full_name: name, phone });
    setEditProfile(false);
    toast.success(t.customer.profileSaved);
  }

  // ─── Reviews ───
  function openReview(appt: MyAppointment) {
    setReviewAppt(appt);
    setReviewRating(0);
    setReviewComment("");
    setReviewError(null);
  }

  function closeReview() {
    if (submittingReview) return;
    setReviewAppt(null);
  }

  async function handleSubmitReview(e?: React.FormEvent) {
    e?.preventDefault();
    if (!reviewAppt) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError(t.customer.ratingRequired);
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    const target = reviewAppt;
    const { error } = await supabase.rpc("submit_review", {
      p_appointment_id: target.id,
      p_rating: reviewRating,
      p_comment: reviewComment.trim() ? reviewComment.trim().slice(0, REVIEW_MAX) : null,
    });
    setSubmittingReview(false);
    const code = rpcErrorCode(error);
    if (error && code !== "ALREADY_REVIEWED") {
      setReviewError(errorText(code));
      return;
    }
    setAppointments((prev) => prev.map((a) => (a.id === target.id ? { ...a, has_review: true } : a)));
    setReviewAppt(null);
    toast.success(t.customer.reviewThanks);
  }

  // ─── Cancel ───
  async function confirmCancel() {
    if (!cancelTarget) return;
    const target = cancelTarget;
    const { data, error } = await supabase.rpc("cancel_customer_booking", {
      p_appointment_id: target.id,
      p_reason: cancelReason.trim() ? cancelReason.trim().slice(0, REASON_MAX) : null,
    });
    if (error) {
      const code = rpcErrorCode(error);
      if (code === "INSIDE_CANCELLATION_WINDOW") {
        const hours = Number((error as { details?: string }).details) || target.cancellation_policy_hours || 0;
        throw new Error(interpolate(t.customer.cancelWindowClosed, { hours }));
      }
      throw new Error(errorText(code));
    }
    const cancelledAt = (data as { cancelled_at?: string } | null)?.cancelled_at ?? new Date().toISOString();
    setAppointments((prev) =>
      prev.map((a) => (a.id === target.id ? { ...a, status: "cancelled", cancelled_at: cancelledAt } : a)),
    );
    setCancelTarget(null);
    setCancelReason("");
    toast.success(t.customer.appointmentCancelled);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(t.error.message);
    toast.success(t.customer.signedOut);
    router.replace(href("/customer/login"));
  }

  // ─── Rendering helpers ───
  const statusBadge = (appt: MyAppointment): { label: string; tone: PillTone } => {
    const s = statusOf(appt);
    const map: Record<string, { label: string; tone: PillTone }> = {
      confirmed: { label: t.customer.statusConfirmed, tone: "brand" },
      pending: { label: t.customer.statusPending, tone: "warning" },
      completed: { label: t.customer.completed, tone: "success" },
      no_show: { label: t.customer.statusNoShow, tone: "danger" },
      cancelled: { label: t.customer.cancelled, tone: "neutral" },
    };
    return map[s] ?? map.pending;
  };

  const zoned = (appt: MyAppointment): Intl.DateTimeFormatOptions => ({ timeZone: appt.shop_timezone || undefined });

  const tabs: { key: AppointmentTab; label: string; count: number; icon: typeof CalendarDays }[] = [
    { key: "upcoming", label: t.customer.upcoming, count: grouped.upcoming.length, icon: CalendarDays },
    { key: "past", label: t.customer.past, count: grouped.past.length, icon: History },
    { key: "cancelled", label: t.customer.cancelled, count: grouped.cancelled.length, icon: CalendarX },
  ];

  const cancelInfo = cancelTarget ? cancellationState(cancelTarget, now) : null;
  const enter = (i: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12 } }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, ease: [0.05, 0.7, 0.1, 1] as const, delay: Math.min(i, 4) * 0.04 },
        };

  const deadlineText = (appt: MyAppointment, deadline: Date | string) =>
    formatDate(deadline, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", ...zoned(appt) });

  // Upcoming visit: large image-led card (§6.9).
  const renderUpcoming = (appt: MyAppointment, i: number) => {
    const badge = statusBadge(appt);
    const cancelState = cancellationState(appt, now);
    const detailHref = href(`/customer/${appt.id}`);
    const subtitle = [appt.service_name, appt.barber_name].filter(Boolean).join(" · ");
    return (
      <motion.li
        key={appt.id}
        {...enter(i)}
        className="group relative overflow-hidden rounded-2xl border border-line bg-card shadow-card transition-shadow duration-200 ease-standard hover:shadow-raised focus-within:shadow-raised sm:grid sm:grid-cols-[200px_minmax(0,1fr)]"
      >
        <PhotoFrame
          alt=""
          ratio="none"
          seed={appt.shop_id}
          fallbackName={appt.shop_name}
          className="aspect-[3/1] sm:aspect-auto sm:h-full sm:min-h-[180px]"
          initialsClassName="text-[28px] md:text-[34px]"
        />
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Pill tone={badge.tone} size="md">
              {badge.label}
            </Pill>
            <span className="text-meta">{interpolate(t.customer.reference, { ref: appt.id.slice(0, 7).toUpperCase() })}</span>
          </div>
          <p className="text-h3 m-0 tabular-nums text-ink">
            <time dateTime={appt.start_time}>
              {formatDate(appt.start_time, { weekday: "short", day: "numeric", month: "short", ...zoned(appt) })}
              <span aria-hidden="true" className="mx-1.5 text-ink-disabled">·</span>
              {formatTime(appt.start_time, zoned(appt))}
            </time>
          </p>
          <h3 className="text-title m-0 mt-1 truncate text-ink">
            {/* Stretched link → appointment details; action buttons sit above it. */}
            <Link
              href={detailHref}
              aria-label={interpolate(t.customer.viewDetailsFor, { shop: appt.shop_name })}
              className="no-underline after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            >
              {appt.shop_name}
            </Link>
          </h3>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            {subtitle ? <p className="text-meta m-0 min-w-0 truncate">{subtitle}</p> : <span />}
            <p className="text-price m-0 shrink-0 whitespace-nowrap text-ink">
              {formatCurrency(Number(appt.price) || 0, appt.currency || "JOD")}
            </p>
          </div>

          {cancelState.deadline && (
            <p className="m-0 mt-3 flex items-start gap-1.5 text-[13px] leading-[18px] text-ink-muted">
              <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {cancelState.canCancel
                ? interpolate(t.customer.freeCancelUntil, { date: deadlineText(appt, cancelState.deadline) })
                : interpolate(t.customer.cancelWindowClosed, { hours: cancelState.policyHours })}
            </p>
          )}

          {/* Actions (z-10 keeps them above the stretched link) */}
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-line pt-4 sm:mt-auto">
            {cancelState.canCancel ? (
              <>
                <Link
                  href={href(`/book/${appt.shop_id}?reschedule=${appt.id}`)}
                  className={buttonClasses({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" })}
                >
                  <CalendarClock aria-hidden="true" />
                  {t.customer.reschedule}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCancelReason("");
                    setCancelTarget(appt);
                  }}
                  className={buttonClasses({ variant: "destructive-soft", size: "sm", className: "flex-1 sm:flex-none" })}
                >
                  {t.customer.cancel}
                </button>
              </>
            ) : (
              <>
                <Link href={detailHref} className={buttonClasses({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" })}>
                  {t.customer.details}
                </Link>
                {appt.shop_phone && (
                  <a
                    href={`tel:${appt.shop_phone.replace(/[^\d+]/g, "")}`}
                    className={buttonClasses({ variant: "soft", size: "sm", className: "flex-1 sm:flex-none" })}
                  >
                    <Phone aria-hidden="true" />
                    {t.customer.callShop}
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </motion.li>
    );
  };

  // Past / cancelled: compact list rows with "Book again" (§6.9).
  const renderRow = (appt: MyAppointment, i: number) => {
    const badge = statusBadge(appt);
    const detailHref = href(`/customer/${appt.id}`);
    const s = statusOf(appt);
    const meta = [
      formatDate(appt.start_time, { day: "numeric", month: "short", year: "numeric", ...zoned(appt) }),
      formatTime(appt.start_time, zoned(appt)),
      appt.service_name,
    ].filter(Boolean) as string[];
    return (
      <motion.li
        key={appt.id}
        {...enter(i)}
        className="relative flex flex-col gap-3 px-4 py-4 transition-colors duration-150 hover:bg-sunken/60 focus-within:bg-sunken/60 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PhotoFrame
            alt=""
            ratio="1/1"
            seed={appt.shop_id}
            fallbackName={appt.shop_name}
            rounded="lg"
            className="size-12 shrink-0"
            initialsClassName="text-base md:text-base"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-title m-0 truncate text-ink">
              <Link
                href={detailHref}
                aria-label={interpolate(t.customer.viewDetailsFor, { shop: appt.shop_name })}
                className="no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
              >
                {appt.shop_name}
              </Link>
            </h3>
            <p className="text-meta m-0 mt-0.5 truncate tabular-nums">{meta.join(" · ")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-price whitespace-nowrap text-ink">
              {formatCurrency(Number(appt.price) || 0, appt.currency || "JOD")}
            </span>
            {s !== "completed" && (
              <Pill tone={badge.tone} size="sm">
                {badge.label}
              </Pill>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2 ps-[60px] sm:ps-0">
          <Link href={href(`/book/${appt.shop_id}`)} className={buttonClasses({ variant: "soft", size: "sm" })}>
            <Repeat aria-hidden="true" />
            {t.customer.bookAgain}
          </Link>
          {s === "completed" && !appt.has_review && (
            <button type="button" onClick={() => openReview(appt)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Star aria-hidden="true" className="fill-accent text-accent" />
              {t.customer.review}
            </button>
          )}
          {appt.has_review && (
            <Pill tone="success" size="lg" icon={<CheckCircle2 aria-hidden="true" />}>
              {t.customer.reviewed}
            </Pill>
          )}
        </div>
      </motion.li>
    );
  };

  const stats = [
    { label: t.customer.upcoming, value: grouped.upcoming.length, icon: CalendarClock },
    { label: t.customer.completed, value: completedCount, icon: CheckCircle2 },
    { label: t.customer.thisMonth, value: thisMonthCount, icon: CalendarDays },
  ];

  return (
    <>
      <PortalShell
        active="bookings"
        profile={{ name: user?.full_name, detail: user?.email || user?.phone, loading }}
        onSignOut={() => setLogoutConfirm(true)}
      >
        {/* Header */}
        <div className="mb-6 flex flex-col gap-1">
          <p className="m-0 text-sm font-medium text-ink-muted">
            {firstName ? interpolate(t.customer.welcomeName, { name: firstName }) : t.customerAccount.eyebrow}
          </p>
          <h1 className="text-h1 m-0 text-ink">{t.customer.myAppointments}</h1>
        </div>

        {/* Stats */}
        <dl className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex min-w-0 flex-col rounded-xl border border-line bg-card p-3 shadow-card sm:p-4">
              <span aria-hidden="true" className="mb-2 hidden size-8 place-items-center rounded-lg bg-brand-soft text-brand-text sm:grid">
                <Icon size={16} />
              </span>
              {/* dt first for screen readers; shown under the number. */}
              <dt className="order-last truncate text-xs font-medium text-ink-muted sm:text-sm">{label}</dt>
              <dd className="text-stat m-0 mb-0.5 text-ink">
                {loading ? <Skeleton className="h-8 w-10" /> : formatNumber(value)}
              </dd>
            </div>
          ))}
        </dl>

        {/* Tabs */}
        <SegmentedControl
          semantics="tabs"
          variant="underline"
          idPrefix="appts"
          ariaLabel={t.customer.appointmentsTabs}
          value={activeTab}
          onChange={setActiveTab}
          options={tabs.map((tab) => ({
            value: tab.key,
            label: tab.label,
            badge:
              tab.count > 0 ? (
                <span
                  className={cn(
                    "ms-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    activeTab === tab.key ? "bg-inverse text-on-inverse" : "bg-sunken text-ink-muted",
                  )}
                >
                  {formatNumber(tab.count)}
                </span>
              ) : undefined,
          }))}
        />

        <div id={`appts-panel-${activeTab}`} role="tabpanel" aria-labelledby={`appts-tab-${activeTab}`} className="mt-5">
          {/* Rebooking nudge */}
          {activeTab === "upcoming" && nudge && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-brand-soft p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                  <Repeat size={18} />
                </span>
                <p className="m-0 min-w-0 text-[15px] font-semibold text-brand-pressed dark:text-ink">
                  {interpolate(t.customer.rebookNudge, { barber: nudge.barberName || t.customer.yourBarber })}
                </p>
              </div>
              <Link href={href(`/book/${nudge.shopId}`)} className={buttonClasses({ variant: "primary", size: "sm", className: "self-start sm:self-auto" })}>
                {t.customer.bookAgain}
              </Link>
            </div>
          )}

          {loading ? (
            <SkeletonGroup className="flex flex-col gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <AppointmentSkeleton key={i} />
              ))}
            </SkeletonGroup>
          ) : status === "error" ? (
            <EmptyState
              icon={CalendarX}
              tone="error"
              title={t.customer.loadErrorTitle}
              description={t.customer.loadErrorDesc}
              action={{ label: t.common.retry, onClick: load }}
            />
          ) : displayList.length === 0 ? (
            <EmptyState
              icon={activeTab === "upcoming" ? CalendarDays : activeTab === "past" ? History : CalendarX}
              title={activeTab === "upcoming" ? t.customer.noUpcoming : activeTab === "past" ? t.customer.noPast : t.customer.noCancelled}
              description={activeTab === "upcoming" ? t.customer.noUpcomingDesc : activeTab === "past" ? t.customer.noPastDesc : undefined}
              action={{ label: t.customer.exploreShops, href: href("/explore"), icon: Compass }}
            />
          ) : activeTab === "upcoming" ? (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">{displayList.map(renderUpcoming)}</ul>
          ) : (
            <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-xl border border-line bg-card p-0 shadow-card">
              {displayList.map(renderRow)}
            </ul>
          )}
        </div>

        {/* Next-visit CTA */}
        {status === "ok" && (
          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span aria-hidden="true" className="bg-hatch-ink grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text">
                <Compass size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="text-h3 m-0 mb-1 text-ink">{t.customer.readyForNext}</h2>
                <p className="m-0 text-sm text-ink-muted">{t.customer.browseShops}</p>
              </div>
            </div>
            <Link href={href("/explore")} className={buttonClasses({ variant: "secondary", size: "md", className: "shrink-0 self-start sm:self-auto" })}>
              {t.customer.exploreShops}
            </Link>
          </div>
        )}
      </PortalShell>

      {/* ── Edit profile ── */}
      <Dialog
        open={editProfile}
        onClose={() => !saving && setEditProfile(false)}
        title={t.customer.editProfile}
        description={t.customer.editProfileDesc}
        size="sm"
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        footer={
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditProfile(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="customer-profile-form" loading={saving}>
              {saving ? t.customer.saving : t.common.save}
            </Button>
          </DialogFooter>
        }
      >
        <form id="customer-profile-form" onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-5">
          <div>
            <label htmlFor="profile-name" className={labelClasses}>
              {t.customer.fullName}
            </label>
            <input
              id="profile-name"
              data-autofocus
              type="text"
              className={inputClasses()}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="name"
              maxLength={80}
              required
              aria-invalid={!!profileErrors.name}
              aria-describedby={profileErrors.name ? "profile-name-error" : undefined}
            />
            {profileErrors.name && (
              <p id="profile-name-error" className={errorTextClasses} role="alert">
                {profileErrors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="profile-email" className={labelClasses}>
              {t.customer.email}
            </label>
            <input
              id="profile-email"
              type="email"
              className={inputClasses({ className: "bg-sunken text-ink-soft hover:border-line-strong focus:ring-0" })}
              value={user?.email || ""}
              readOnly
              aria-readonly="true"
              aria-describedby="profile-email-hint"
              dir="ltr"
            />
            <p id="profile-email-hint" className={cn(helperClasses, "mb-0")}>
              {t.customer.emailReadOnly}
            </p>
          </div>
          <div>
            <label htmlFor="profile-phone" className={labelClasses}>
              {t.customer.phone}
            </label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              className={inputClasses({ className: "text-start tabular-nums" })}
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              maxLength={20}
              aria-invalid={!!profileErrors.phone}
              aria-describedby={profileErrors.phone ? "profile-phone-error" : undefined}
            />
            {profileErrors.phone && (
              <p id="profile-phone-error" className={errorTextClasses} role="alert">
                {profileErrors.phone}
              </p>
            )}
          </div>
        </form>
      </Dialog>

      {/* ── Review ── */}
      <Dialog
        open={!!reviewAppt}
        onClose={closeReview}
        title={t.customer.reviewTitle}
        description={reviewAppt ? interpolate(t.customer.reviewPrompt, { shop: reviewAppt.shop_name }) : undefined}
        size="sm"
        closeOnBackdrop={!submittingReview}
        closeOnEscape={!submittingReview}
        footer={
          <DialogFooter>
            <Button variant="ghost" onClick={closeReview} disabled={submittingReview}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="customer-review-form" loading={submittingReview} disabled={reviewRating === 0}>
              {submittingReview ? t.customer.submitting : t.customer.submitReview}
            </Button>
          </DialogFooter>
        }
      >
        <form id="customer-review-form" onSubmit={handleSubmitReview} noValidate>
          <div className="mb-6 flex flex-col items-center gap-2 rounded-xl bg-sunken px-4 py-5">
            <p id="review-rating-label" className="m-0 text-sm font-semibold text-ink">
              {t.customer.ratingLabel}
            </p>
            <RatingInput
              value={reviewRating}
              onChange={(n) => {
                setReviewRating(n);
                setReviewError(null);
              }}
              label={t.customer.ratingLabel}
              getStarLabel={(n) => interpolate(t.customer.starLabel, { count: n })}
              disabled={submittingReview}
            />
          </div>
          <label htmlFor="review-comment" className={labelClasses}>
            {t.customer.reviewCommentLabel}
          </label>
          <textarea
            id="review-comment"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value.slice(0, REVIEW_MAX))}
            placeholder={t.customer.reviewPlaceholder}
            maxLength={REVIEW_MAX}
            rows={4}
            aria-describedby="review-comment-count"
            className={textareaClasses({ className: "resize-none" })}
          />
          <p id="review-comment-count" className="mb-0 mt-1.5 text-end text-xs tabular-nums text-ink-muted">
            {formatNumber(reviewComment.length)}/{formatNumber(REVIEW_MAX)}
          </p>
          {reviewError && (
            <p className={errorTextClasses} role="alert">
              {reviewError}
            </p>
          )}
        </form>
      </Dialog>

      {/* ── Cancel confirmation ── */}
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        destructive
        title={t.customer.cancelTitle}
        description={t.customer.cancelDesc}
        confirmLabel={t.customer.cancelConfirm}
        cancelLabel={t.customer.keepAppointment}
      >
        {cancelTarget && (
          <div className="space-y-3 text-start">
            <p className="m-0 text-sm font-semibold text-ink">
              {cancelTarget.shop_name} ·{" "}
              {formatDate(cancelTarget.start_time, { weekday: "short", day: "numeric", month: "short", ...zoned(cancelTarget) })}{" "}
              {formatTime(cancelTarget.start_time, zoned(cancelTarget))}
            </p>
            {cancelInfo?.deadline && cancelInfo.canCancel && (
              <p className="m-0 text-[13px] text-ink-muted">
                {interpolate(t.customer.freeCancelUntil, {
                  date: formatDate(cancelInfo.deadline, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    ...zoned(cancelTarget),
                  }),
                })}
              </p>
            )}
            <div>
              <label htmlFor="cancel-reason" className={labelClasses}>
                {t.customer.cancelReasonLabel}
              </label>
              <input
                id="cancel-reason"
                type="text"
                className={inputClasses()}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, REASON_MAX))}
                placeholder={t.customer.cancelReasonPlaceholder}
                maxLength={REASON_MAX}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* ── Sign out confirmation ── */}
      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={handleSignOut}
        title={t.customer.signOutTitle}
        description={t.customer.signOutDesc}
        confirmLabel={t.customer.signOut}
      />
    </>
  );
}
