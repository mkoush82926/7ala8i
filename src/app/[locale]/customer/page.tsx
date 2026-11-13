"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Compass,
  History,
  LogOut,
  Repeat,
  Star,
  UserRound,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import type { MyAppointment } from "@/lib/supabase/database.types";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { coverForShop, shopInitials } from "../shop/shop-utils";
import {
  cancellationState,
  classifyAppointment,
  errorMessageFor,
  isValidOptionalPhone,
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
    <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="w-[52px] h-[52px] rounded-[12px] shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="space-y-2 shrink-0">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { t, dir, isRTL, FF, FFD, href, formatCurrency, formatDate, formatTime, formatNumber } = useTranslation();
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
  const [reviewHover, setReviewHover] = useState(0);
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
        router.replace(href("/auth/login"));
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

      // Links client rows matching the account's CONFIRMED email/phone. Ownership
      // is clients.auth_user_id only; failures here are not fatal.
      await supabase.rpc("link_customer_client");

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
  const initials = shopInitials(user?.full_name || user?.email || "U");
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
    const phone = editPhone.trim();
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
    setReviewHover(0);
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
    router.replace(href("/auth/login"));
  }

  // ─── Rendering helpers ───
  const statusBadge = (appt: MyAppointment) => {
    const s = statusOf(appt);
    const map: Record<string, { label: string; color: string }> = {
      confirmed: { label: t.customer.statusConfirmed, color: "var(--accent-text)" },
      pending: { label: t.customer.statusPending, color: "var(--text-secondary)" },
      completed: { label: t.customer.completed, color: "var(--accent-text)" },
      no_show: { label: t.customer.statusNoShow, color: "var(--text-secondary)" },
      cancelled: { label: t.customer.cancelled, color: "var(--accent-rose)" },
    };
    return map[s] ?? map.pending;
  };

  const zoned = (appt: MyAppointment): Intl.DateTimeFormatOptions => ({ timeZone: appt.shop_timezone || undefined });

  const tabs: { key: AppointmentTab; label: string; count: number; icon: typeof CalendarDays }[] = [
    { key: "upcoming", label: t.customer.upcoming, count: grouped.upcoming.length, icon: CalendarDays },
    { key: "past", label: t.customer.past, count: grouped.past.length, icon: History },
    { key: "cancelled", label: t.customer.cancelled, count: grouped.cancelled.length, icon: CalendarX },
  ];

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = isRTL ? "ArrowLeft" : "ArrowRight";
    const backward = isRTL ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === forward) next = (index + 1) % tabs.length;
    else if (e.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActiveTab(tabs[next].key);
    document.getElementById(`tab-${tabs[next].key}`)?.focus();
  };

  const cancelInfo = cancelTarget ? cancellationState(cancelTarget, now) : null;

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: FF }} dir={dir}>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col fixed top-0 start-0 h-full w-[240px] bg-[var(--bg-primary)] border-e border-[var(--border-subtle)] z-40">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <Link href={href("/landing")} className="text-lg font-black text-[var(--text-primary)] rounded-sm" style={{ fontFamily: FFD }}>
            Halaqy.
          </Link>
        </div>

        <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
          {loading && !user ? (
            <SkeletonGroup className="flex items-center gap-3">
              <Skeleton variant="avatar" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </SkeletonGroup>
          ) : (
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm shrink-0"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{user?.full_name || user?.email}</p>
                {user?.full_name && <p className="text-[11px] text-[var(--text-secondary)] truncate">{user.email}</p>}
              </div>
            </div>
          )}
        </div>

        <nav aria-label={t.customer.accountNav} className="px-2.5 py-3 flex-1 overflow-y-auto space-y-0.5">
          <Link href={href("/customer")} aria-current="page" className="portal-nav-item active">
            <CalendarDays size={19} aria-hidden="true" />
            {t.customer.myAppointments}
          </Link>
          <Link href={href("/explore")} className="portal-nav-item">
            <Compass size={19} aria-hidden="true" />
            {t.customer.discoverShops}
          </Link>
          <button type="button" onClick={openEditProfile} disabled={!user} className="portal-nav-item">
            <UserRound size={19} aria-hidden="true" />
            {t.customer.editProfile}
          </button>
        </nav>

        <div className="px-2.5 pt-3 pb-5">
          <button type="button" onClick={() => setLogoutConfirm(true)} className="portal-nav-item" style={{ color: "var(--accent-rose)" }}>
            <LogOut size={19} aria-hidden="true" />
            {t.customer.signOut}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 h-16 px-4 flex items-center justify-between bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
        <Link href={href("/landing")} className="text-[17px] font-black text-[var(--text-primary)] rounded-sm" style={{ fontFamily: FFD }}>
          Halaqy.
        </Link>
        <div className="flex items-center gap-2">
          <Link href={href("/explore")} className="btn btn-primary text-[13px]" style={{ minHeight: 38, padding: "0 14px" }}>
            {t.customer.bookNow}
          </Link>
          <button
            type="button"
            onClick={() => setLogoutConfirm(true)}
            aria-label={t.customer.signOut}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="lg:ps-[240px]">
        <main id="main" className="pt-16 lg:pt-0 pb-28 lg:pb-12">
          <div className="max-w-[760px] mx-auto px-4 sm:px-5">
            {/* Header */}
            <div className="pt-8 pb-6">
              <p
                className="text-[11px] font-bold text-[var(--text-secondary)] mb-1"
                style={{ letterSpacing: headingTracking(isRTL, "0.08em") }}
              >
                {firstName ? interpolate(t.customer.welcomeName, { name: firstName }) : t.customer.welcomeBack}
              </p>
              <h1 className="font-black text-[var(--text-primary)] m-0" style={{ fontSize: "clamp(24px, 4vw, 34px)", fontFamily: FFD }}>
                {t.customer.myAppointments}
              </h1>
            </div>

            {/* Stats */}
            <dl className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-8">
              {[
                { label: t.customer.completed, value: completedCount, icon: CheckCircle2 },
                { label: t.customer.upcoming, value: grouped.upcoming.length, icon: CalendarClock },
                { label: t.customer.thisMonth, value: thisMonthCount, icon: CalendarDays },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex flex-col rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-3 sm:px-4 sm:py-3.5 min-w-0">
                  <Icon size={16} aria-hidden="true" className="text-[var(--accent-brass)]" />
                  {/* dt first for screen readers; shown under the number. */}
                  <dt className="order-last text-[11px] font-semibold text-[var(--text-secondary)] truncate">{label}</dt>
                  <dd className="text-2xl font-black text-[var(--text-primary)] mt-1 mb-0.5 ms-0 tabular-nums" style={{ fontFamily: FFD }}>
                    {loading ? <Skeleton className="h-7 w-8" /> : formatNumber(value)}
                  </dd>
                </div>
              ))}
            </dl>

            {/* CTA */}
            <div className="rounded-[12px] bg-[var(--bg-secondary)] px-5 py-5 sm:px-7 sm:py-6 mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-black text-[var(--text-primary)] mb-1">{t.customer.readyForNext}</h2>
                <p className="text-[13px] text-[var(--text-secondary)] m-0">{t.customer.browseShops}</p>
              </div>
              <Link href={href("/explore")} className="btn btn-primary text-[13px] shrink-0 self-start sm:self-auto" style={{ minHeight: 40 }}>
                {t.customer.exploreShops}
              </Link>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label={t.customer.appointmentsTabs} className="flex border-b border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
              {tabs.map((tab, i) => {
                const selected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    id={`tab-${tab.key}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="appointments-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(tab.key)}
                    onKeyDown={(e) => onTabKeyDown(e, i)}
                    className={`portal-tab-btn${selected ? " active" : ""}`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        className="ms-1.5 text-[11px] font-bold px-1.5 py-px rounded-full tabular-nums"
                        style={{
                          background: selected ? "var(--bg-secondary)" : "transparent",
                          color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                      >
                        {formatNumber(tab.count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div id="appointments-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="mt-4">
              {/* Rebooking nudge */}
              {activeTab === "upcoming" && nudge && (
                <div className="flex items-center gap-3.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-4 sm:px-5 mb-4">
                  <span aria-hidden="true" className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center shrink-0">
                    <Repeat size={18} />
                  </span>
                  <p className="flex-1 min-w-0 text-[13px] font-bold text-[var(--text-primary)] m-0">
                    {interpolate(t.customer.rebookNudge, { barber: nudge.barberName || t.customer.yourBarber })}
                  </p>
                  <Link href={href(`/book/${nudge.shopId}`)} className="btn btn-primary text-[12px] shrink-0" style={{ minHeight: 36, padding: "0 14px" }}>
                    {t.customer.bookAgain}
                  </Link>
                </div>
              )}

              {loading ? (
                <SkeletonGroup className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
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
                  action={activeTab === "upcoming" ? { label: t.customer.exploreShops, href: href("/explore") } : undefined}
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {displayList.map((appt, i) => {
                    const badge = statusBadge(appt);
                    const cancelState = cancellationState(appt, now);
                    const isUpcoming = activeTab === "upcoming";
                    const cover = coverForShop(appt.shop_id);
                    const detailHref = href(`/customer/${appt.id}`);
                    const subtitle = [appt.service_name, appt.barber_name].filter(Boolean).join(" · ");
                    return (
                      <motion.li
                        key={appt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04 }}
                        className="relative rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--accent-brass)] focus-within:border-[var(--accent-brass)] transition-colors"
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start gap-3.5 sm:gap-4">
                            <div
                              aria-hidden="true"
                              className="w-[52px] h-[52px] rounded-[12px] shrink-0 flex items-center justify-center font-extrabold"
                              style={{ background: cover.bg, color: cover.fg, fontFamily: FFD }}
                            >
                              {shopInitials(appt.shop_name)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--bg-secondary)]" style={{ color: badge.color }}>
                                  {badge.label}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)]">
                                  {interpolate(t.customer.reference, { ref: appt.id.slice(0, 7).toUpperCase() })}
                                </span>
                              </div>
                              <h3 className="font-extrabold text-[15px] leading-snug text-[var(--text-primary)] m-0 truncate" style={{ fontFamily: FFD }}>
                                {/* Stretched link → appointment details; action buttons sit above it. */}
                                <Link
                                  href={detailHref}
                                  aria-label={interpolate(t.customer.viewDetailsFor, { shop: appt.shop_name })}
                                  className="after:absolute after:inset-0 after:rounded-[12px] after:content-[''] focus-visible:outline-none"
                                >
                                  {appt.shop_name}
                                </Link>
                              </h3>
                              {subtitle && <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 mb-0 truncate">{subtitle}</p>}
                            </div>

                            <div className="text-end shrink-0">
                              <p className="font-bold text-sm text-[var(--text-primary)] m-0">
                                <time dateTime={appt.start_time}>{formatDate(appt.start_time, { day: "numeric", month: "short", ...zoned(appt) })}</time>
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] my-px">{formatTime(appt.start_time, zoned(appt))}</p>
                              <p className="font-extrabold text-sm text-[var(--text-primary)] m-0 whitespace-nowrap">
                                {formatCurrency(Number(appt.price) || 0, appt.currency || "JOD")}
                              </p>
                            </div>
                          </div>

                          {isUpcoming && cancelState.deadline && (
                            <p className="relative flex items-start gap-1.5 mt-3 mb-0 text-xs text-[var(--text-secondary)]">
                              <Info size={13} aria-hidden="true" className="shrink-0 mt-px" />
                              {cancelState.canCancel
                                ? interpolate(t.customer.freeCancelUntil, {
                                    date: formatDate(cancelState.deadline, {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                      hour: "numeric",
                                      minute: "2-digit",
                                      ...zoned(appt),
                                    }),
                                  })
                                : interpolate(t.customer.cancelWindowClosed, { hours: cancelState.policyHours })}
                            </p>
                          )}

                          {/* Actions (z-10 keeps them above the stretched link) */}
                          <div className="relative z-10 flex gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]">
                            {isUpcoming ? (
                              cancelState.canCancel ? (
                                <>
                                  <Link
                                    href={href(`/book/${appt.shop_id}?reschedule=${appt.id}`)}
                                    className="flex-1 inline-flex items-center justify-center min-h-[40px] rounded-[8px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-bold hover:text-[var(--text-primary)] transition-colors"
                                  >
                                    {t.customer.reschedule}
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancelReason("");
                                      setCancelTarget(appt);
                                    }}
                                    className="flex-1 inline-flex items-center justify-center min-h-[40px] rounded-[8px] text-xs font-bold border transition-colors"
                                    style={{ background: "var(--accent-rose-muted)", color: "var(--accent-rose)", borderColor: "var(--accent-rose-muted)" }}
                                  >
                                    {t.customer.cancel}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Link
                                    href={detailHref}
                                    className="flex-1 inline-flex items-center justify-center min-h-[40px] rounded-[8px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-bold"
                                  >
                                    {t.customer.details}
                                  </Link>
                                  {appt.shop_phone && (
                                    <a
                                      href={`tel:${appt.shop_phone.replace(/[^\d+]/g, "")}`}
                                      className="flex-1 inline-flex items-center justify-center min-h-[40px] rounded-[8px] bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold"
                                    >
                                      {t.customer.callShop}
                                    </a>
                                  )}
                                </>
                              )
                            ) : (
                              <>
                                <Link
                                  href={href(`/book/${appt.shop_id}`)}
                                  className="flex-1 inline-flex items-center justify-center min-h-[40px] rounded-[8px] bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold hover:opacity-90 transition-opacity"
                                >
                                  {t.customer.bookAgain}
                                </Link>
                                {statusOf(appt) === "completed" && !appt.has_review && (
                                  <button
                                    type="button"
                                    onClick={() => openReview(appt)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-[8px] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs font-bold"
                                  >
                                    <Star size={14} aria-hidden="true" className="text-[var(--accent-brass)]" />
                                    {t.customer.review}
                                  </button>
                                )}
                                {appt.has_review && (
                                  <span className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full bg-[var(--bg-secondary)] text-xs font-bold text-[var(--accent-text)]">
                                    <CheckCircle2 size={14} aria-hidden="true" />
                                    {t.customer.reviewed}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label={t.customer.accountNav}
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around items-center px-4 pt-2.5 bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <Link href={href("/explore")} className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-secondary)] rounded-[8px]">
          <Compass size={21} aria-hidden="true" />
          {t.customer.explore}
        </Link>
        <Link
          href={href("/customer")}
          aria-current="page"
          className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-primary)] rounded-[8px]"
        >
          <span aria-hidden="true" className="w-10 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <CalendarCheck size={19} />
          </span>
          {t.explore.navBookings}
        </Link>
        <button
          type="button"
          onClick={openEditProfile}
          disabled={!user}
          className="flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold text-[var(--text-secondary)] rounded-[8px] disabled:opacity-50"
        >
          <UserRound size={21} aria-hidden="true" />
          {t.explore.navAccount}
        </button>
      </nav>

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
            <button type="button" className="btn btn-ghost" onClick={() => setEditProfile(false)} disabled={saving}>
              {t.common.cancel}
            </button>
            <button type="submit" form="customer-profile-form" className="btn btn-primary" disabled={saving} aria-busy={saving}>
              {saving ? t.customer.saving : t.common.save}
            </button>
          </DialogFooter>
        }
      >
        <form id="customer-profile-form" onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="profile-name" className="field-label">
              {t.customer.fullName}
            </label>
            <input
              id="profile-name"
              data-autofocus
              type="text"
              className="field-input w-full"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="name"
              maxLength={80}
              required
              aria-invalid={!!profileErrors.name}
              aria-describedby={profileErrors.name ? "profile-name-error" : undefined}
            />
            {profileErrors.name && (
              <p id="profile-name-error" className="field-error" role="alert">
                {profileErrors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="profile-email" className="field-label">
              {t.customer.email}
            </label>
            <input
              id="profile-email"
              type="email"
              className="field-input w-full"
              value={user?.email || ""}
              readOnly
              aria-readonly="true"
              aria-describedby="profile-email-hint"
              dir="ltr"
              style={{ opacity: 0.75 }}
            />
            <p id="profile-email-hint" className="text-xs text-[var(--text-muted)] mt-1.5 mb-0">
              {t.customer.emailReadOnly}
            </p>
          </div>
          <div>
            <label htmlFor="profile-phone" className="field-label">
              {t.customer.phone}
            </label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              className="field-input w-full text-start"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              maxLength={20}
              aria-invalid={!!profileErrors.phone}
              aria-describedby={profileErrors.phone ? "profile-phone-error" : undefined}
            />
            {profileErrors.phone && (
              <p id="profile-phone-error" className="field-error" role="alert">
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
            <button type="button" className="btn btn-ghost" onClick={closeReview} disabled={submittingReview}>
              {t.common.cancel}
            </button>
            <button
              type="submit"
              form="customer-review-form"
              className="btn btn-primary"
              disabled={submittingReview || reviewRating === 0}
              aria-busy={submittingReview}
            >
              {submittingReview ? t.customer.submitting : t.customer.submitReview}
            </button>
          </DialogFooter>
        }
      >
        <form id="customer-review-form" onSubmit={handleSubmitReview} noValidate>
          <fieldset className="border-0 p-0 m-0 mb-5">
            <legend className="field-label">{t.customer.ratingLabel}</legend>
            <div className="flex justify-center gap-2" onMouseLeave={() => setReviewHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                const lit = star <= (reviewHover || reviewRating);
                return (
                  <button
                    key={star}
                    type="button"
                    data-autofocus={star === 1 ? true : undefined}
                    onClick={() => {
                      setReviewRating(star);
                      setReviewError(null);
                    }}
                    onMouseEnter={() => setReviewHover(star)}
                    aria-label={interpolate(t.customer.starLabel, { count: star })}
                    aria-pressed={reviewRating === star}
                    className="p-1.5 rounded-[8px] transition-transform active:scale-90"
                  >
                    <Star
                      size={36}
                      aria-hidden="true"
                      strokeWidth={1.5}
                      style={{ color: lit ? "var(--accent-brass)" : "var(--border-primary)", fill: lit ? "var(--accent-brass)" : "transparent" }}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label htmlFor="review-comment" className="field-label">
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
            className="field-input w-full resize-none py-3"
            style={{ height: "auto" }}
          />
          <p id="review-comment-count" className="text-xs text-[var(--text-muted)] text-end mt-1 mb-0 tabular-nums">
            {formatNumber(reviewComment.length)}/{formatNumber(REVIEW_MAX)}
          </p>
          {reviewError && (
            <p className="field-error" role="alert">
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
            <p className="text-sm text-[var(--text-primary)] font-semibold m-0">
              {cancelTarget.shop_name} ·{" "}
              {formatDate(cancelTarget.start_time, { weekday: "short", day: "numeric", month: "short", ...zoned(cancelTarget) })}{" "}
              {formatTime(cancelTarget.start_time, zoned(cancelTarget))}
            </p>
            {cancelInfo?.deadline && cancelInfo.canCancel && (
              <p className="text-xs text-[var(--text-secondary)] m-0">
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
              <label htmlFor="cancel-reason" className="field-label">
                {t.customer.cancelReasonLabel}
              </label>
              <input
                id="cancel-reason"
                type="text"
                className="field-input w-full"
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
    </div>
  );
}
