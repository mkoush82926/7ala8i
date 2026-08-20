"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { format, isAfter, startOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, headingTracking } from "@/hooks/use-translation";

function useWindowWidth() {
  const [w, setW] = useState(1280);
  useEffect(() => {
    const update = () => setW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return w;
}

interface CustomerAppointment {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  client_name: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  barber_id: string | null;
  barber_name: string | null;
  service_name: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  confirmed:  { label: "Upcoming",  bgColor: "#f7f1e4", textColor: "#a67c3d" },
  pending:    { label: "Pending",   bgColor: "#f7f1e4", textColor: "#5a5147" },
  cancelled:  { label: "Cancelled", bgColor: "#f7f1e4", textColor: "#ba1a1a" },
  completed:  { label: "Completed", bgColor: "#f7f1e4", textColor: "#a67c3d" },
  no_show:    { label: "No-show",   bgColor: "#f7f1e4", textColor: "#5a5147" },
};

const SHOP_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA7Bsh2lEbD6ZTy5h9T1ZG2MfsCUuywaaZd_nDq-ITBCub76GRU6XIlZTHFIOusrp-JJ09EY9hZIjSKHLqnLzJfWCNu69nSF9e1itU_wlbDpZS5P3oKnHge0HXclB_FldVVgc0CztwnMJvSXaFvlCVR-NgFXTd--q1AfHMIHEy0DUze4UyYtmmM0GoN-gVDSNGchj-GxzY4-HtCnSHTY5Qs2s-4Tfv3m3YaHGC1dWQF9kDDUDLMwPV5_NaI5cgUrBO8y0bjvwJEh01V",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDSCFMQFuOkdgX7Yi5aFyGJXWyFRL_0nsmIzQuSp9pTlpt0Jvzq7s8XQDRzmyMREhhu_R0pMPnXp1r9E7-w7Sl1lcker-7vzu2GkfOzpBimNcBYFpgelUb0ov4bh9zAzfSXHDJpnrLD7ON1LD3w9DS08fanZhKmjYKr_ovtIKPYVWSWY3XKrJhIm-fJ4XGFofFMjZ5sfasoDqch4mdVsdubVvgiVb50yUWBFIPtQpctKjRGuCABoP2bWgRF2sLf3Pwz3dLtvd9JKI-9",
];

type Tab = "upcoming" | "past" | "cancelled";

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ede3cd", padding: 20 }}>
      <div className="flex items-start gap-4">
        <div className="shimmer-card rounded-xl shrink-0" style={{ width: 56, height: 56 }} />
        <div className="flex-1 space-y-2">
          <div className="shimmer-card rounded-full" style={{ height: 14, width: "33%" }} />
          <div className="shimmer-card rounded-lg" style={{ height: 20, width: "65%" }} />
          <div className="shimmer-card rounded-lg" style={{ height: 14, width: "50%" }} />
        </div>
        <div className="space-y-2 shrink-0" style={{ textAlign: "right" }}>
          <div className="shimmer-card rounded-lg" style={{ height: 14, width: 48 }} />
          <div className="shimmer-card rounded-lg" style={{ height: 18, width: 60 }} />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, href, exact = false }: { icon: string; label: string; href: string; exact?: boolean }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`portal-nav-item${isActive ? " active" : ""}`}
      style={{ textDecoration: "none" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </Link>
  );
}

export default function CustomerDashboard() {
  const [user, setUser] = useState<{ id: string; full_name: string; email: string; phone: string } | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [reviewAppt, setReviewAppt] = useState<CustomerAppointment | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userReviewedApptIds, setUserReviewedApptIds] = useState<Set<string>>(new Set());
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { t, dir, isRTL, FF } = useTranslation();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    async function load() {
      // 1. Auth check
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      // 2. Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", authUser.id)
        .single();

      if (profile?.role && profile.role !== "customer") {
        router.push("/");
        return;
      }

      const phone = authUser.user_metadata?.phone || "";
      setUser({
        id: authUser.id,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || "",
        email: authUser.email || "",
        phone,
      });
      setEditName(profile?.full_name || "");
      setEditPhone(phone);

      // 2.5. Establish a durable client<->auth link for future reliability.
      // Idempotent (returns the existing link if already linked, does nothing
      // destructive if no match found) — safe to call on every load. Does not
      // replace the fuzzy matching below in this pass.
      await supabase.rpc("link_customer_client");

      // 3. Find customer's appointments via multiple strategies
      const email = authUser.email || "";
      let allAppts: CustomerAppointment[] = [];

      // Strategy A: Look up by client records linked to email or phone
      const { data: clientRecords } = await supabase
        .from("clients")
        .select("id")
        .or(
          [
            `email.eq.${email}`,
            phone ? `phone.eq.${phone}` : null,
          ]
            .filter(Boolean)
            .join(",")
        );

      if (clientRecords && clientRecords.length > 0) {
        const clientIds = clientRecords.map((c: { id: string }) => c.id);

        const { data: appts } = await supabase
          .from("appointments")
          .select("id, client_name, start_time, end_time, status, price, shop_id, barber_id, service_name, source")
          .in("client_id", clientIds)
          .order("start_time", { ascending: false });

        if (appts && appts.length > 0) {
          const shopIds = [...new Set(appts.map((a: { shop_id: string }) => a.shop_id))];
          const barberIds = [...new Set(appts.map((a: { barber_id: string | null }) => a.barber_id).filter(Boolean))] as string[];

          const [shopsRes, barbersRes] = await Promise.all([
            supabase.from("shops").select("id, name, address").in("id", shopIds),
            barberIds.length > 0
              ? supabase.from("profiles").select("id, full_name").in("id", barberIds)
              : Promise.resolve({ data: [] }),
          ]);

          const shopMap = new Map(
            (shopsRes.data || []).map((s: { id: string; name: string; address: string }) => [s.id, s])
          );
          const barberMap = new Map(
            (barbersRes.data || []).map((b: { id: string; full_name: string }) => [b.id, b.full_name])
          );

          allAppts = appts.map((a: {
            id: string; shop_id: string; client_name: string;
            start_time: string; end_time: string; status: string; price: number;
            barber_id: string | null; service_name: string | null;
          }) => {
            const shopInfo = shopMap.get(a.shop_id) as { id: string; name: string; address: string } | undefined;
            return {
              id: a.id,
              shop_id: a.shop_id,
              shop_name: shopInfo?.name || "Barbershop",
              shop_address: shopInfo?.address || null,
              client_name: a.client_name,
              start_time: a.start_time,
              end_time: a.end_time,
              status: a.status,
              price: a.price || 0,
              barber_id: a.barber_id,
              barber_name: a.barber_id ? (barberMap.get(a.barber_id) || null) : null,
              service_name: a.service_name || null,
            };
          });
        }
      }

      // Strategy B: Try looking up by client_name matching user's full name
      if (allAppts.length === 0 && profile?.full_name) {
        const { data: apptsByName } = await supabase
          .from("appointments")
          .select("id, client_name, start_time, end_time, status, price, shop_id, barber_id, service_name")
          .ilike("client_name", `%${profile.full_name}%`)
          .order("start_time", { ascending: false });

        if (apptsByName && apptsByName.length > 0) {
          const shopIds = [...new Set(apptsByName.map((a: { shop_id: string }) => a.shop_id))];
          const { data: shopsData } = await supabase
            .from("shops")
            .select("id, name, address")
            .in("id", shopIds);

          const shopMap = new Map(
            (shopsData || []).map((s: { id: string; name: string; address: string }) => [s.id, s])
          );

          allAppts = apptsByName.map((a: {
            id: string; shop_id: string; client_name: string;
            start_time: string; end_time: string; status: string; price: number;
            barber_id: string | null; service_name: string | null;
          }) => {
            const shopInfo = shopMap.get(a.shop_id) as { id: string; name: string; address: string } | undefined;
            return {
              id: a.id,
              shop_id: a.shop_id,
              shop_name: shopInfo?.name || "Barbershop",
              shop_address: shopInfo?.address || null,
              client_name: a.client_name,
              start_time: a.start_time,
              end_time: a.end_time,
              status: a.status,
              price: a.price || 0,
              barber_id: a.barber_id,
              barber_name: null,
              service_name: a.service_name || null,
            };
          });
        }
      }

      setAppointments(allAppts);

      // 4. Load reviewed appt IDs
      if (allAppts.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("appointment_id")
          .in("appointment_id", allAppts.map(a => a.id));
        setUserReviewedApptIds(new Set(reviews?.map((r: { appointment_id: string }) => r.appointment_id) || []));
      }

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: editName } as Record<string, unknown>)
      .eq("id", user.id);
    const { error: authError } = await supabase.auth.updateUser({ data: { phone: editPhone } });
    setSaving(false);
    if (profileError || authError) {
      alert("Failed to save profile: " + (profileError?.message || authError?.message));
      return;
    }
    setUser({ ...user, full_name: editName, phone: editPhone });
    setEditProfile(false);
    showToast("Profile saved!");
  }

  async function handleSubmitReview() {
    if (!user || !reviewAppt || reviewRating === 0) return;
    setSubmittingReview(true);
    try {
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .or(`email.eq.${user.email},phone.eq.${user.phone || "NONE"}`)
        .limit(1);
      const clientId = clients?.[0]?.id;
      if (!clientId) throw new Error("No client profile found.");
      const { error } = await supabase.from("reviews").insert({
        shop_id: reviewAppt.shop_id,
        client_id: clientId,
        appointment_id: reviewAppt.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      if (error) throw error;
      setUserReviewedApptIds(prev => new Set(prev).add(reviewAppt.id));
      setReviewAppt(null);
      setReviewRating(0);
      setReviewHover(0);
      setReviewComment("");
      showToast("Review submitted — thank you!");
    } catch (err: unknown) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleCancel(apptId: string) {
    const { error: rpcError } = await supabase.rpc("cancel_customer_booking", { p_appointment_id: apptId });
    if (rpcError) {
      alert("Failed to cancel: " + rpcError.message);
      return;
    }
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: "cancelled" } : a));
    setCancelConfirm(null);
    showToast("Appointment cancelled.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  // Tab filtering
  const today = startOfDay(new Date());
  const upcoming = appointments.filter(a =>
    a.status !== "cancelled" &&
    a.status !== "completed" &&
    a.status !== "no_show" &&
    isAfter(new Date(a.start_time), today)
  );
  const past = appointments.filter(a =>
    a.status !== "cancelled" &&
    (a.status === "completed" || a.status === "no_show" || !isAfter(new Date(a.start_time), today))
  );
  const cancelled = appointments.filter(a => a.status === "cancelled");

  const displayList = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;

  const thisMonthCount = appointments.filter(a => {
    const d = new Date(a.start_time);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const completedCount = appointments.filter(a => a.status === "completed").length;
  const initials = user?.full_name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";

  const windowW = useWindowWidth();

  // ─── Loyalty / rebooking nudge ───
  // For a client with 2+ completed visits with the same barber, work out their average
  // visit cadence and flag when they're overdue for the next one. Suppressed entirely if
  // there's already an upcoming booking, or if there isn't enough history to compute a cadence.
  const rebookingNudge = useMemo(() => {
    if (loading || upcoming.length > 0) return null;

    const completedByBarber = new Map<string, CustomerAppointment[]>();
    for (const a of appointments) {
      if (a.status === "completed" && a.barber_id) {
        const list = completedByBarber.get(a.barber_id) || [];
        list.push(a);
        completedByBarber.set(a.barber_id, list);
      }
    }

    for (const [, visits] of completedByBarber) {
      if (visits.length < 2) continue;
      const sorted = [...visits].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((new Date(sorted[i].start_time).getTime() - new Date(sorted[i - 1].start_time).getTime()) / 86400000);
      }
      const avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const mostRecent = sorted[sorted.length - 1];
      const daysSinceLast = (Date.now() - new Date(mostRecent.start_time).getTime()) / 86400000;
      if (daysSinceLast > avgGapDays) {
        return {
          shopId: mostRecent.shop_id,
          barberName: mostRecent.barber_name || (isRTL ? "حلاقك" : "your barber"),
        };
      }
    }
    return null;
  }, [appointments, loading, upcoming.length, isRTL]);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: FF, direction: dir }}>

      {/* ── Toast notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
              zIndex: 200, background: "#1c1611", color: "#fff",
              padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1", color: "#a67c3d" }}>check_circle</span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <aside
        style={{
          display: windowW >= 1024 ? "flex" : "none",
          flexDirection: "column",
          position: "fixed", left: 0, top: 0, height: "100%",
          width: 240, background: "#fff", borderRight: "1px solid #ede3cd", zIndex: 40
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #ede3cd" }}>
          <Link href="/landing" style={{ fontSize: 18, fontWeight: 900, color: "#1c1611", textDecoration: "none", letterSpacing: "0.015em", fontFamily: "var(--font-intervar),sans-serif" }}>
            Halaqy.
          </Link>
        </div>

        {/* User avatar */}
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #ede3cd" }}>
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="shimmer-card rounded-full shrink-0" style={{ width: 40, height: 40 }} />
              <div className="flex-1 space-y-1.5">
                <div className="shimmer-card rounded" style={{ height: 12, width: "65%" }} />
                <div className="shimmer-card rounded" style={{ height: 10, width: "50%" }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 flex items-center justify-center font-bold text-sm"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c1611", color: "#fff" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1611", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.full_name || "Customer"}
                </p>
                <p style={{ fontSize: 11, color: "#5a5147", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
          <NavItem icon="calendar_today" label={t.customer.myAppointments} href="/customer" exact />
          <NavItem icon="explore" label={t.customer.discoverShops} href="/customer/explore" />
          <NavItem icon="add_circle" label={t.customer.bookAppointment} href="/customer/explore" />
          <NavItem icon="settings" label={t.customer.settings} href="/customer" />
        </nav>

        <div style={{ padding: "12px 10px 20px" }}>
          <button
            onClick={() => setLogoutConfirm(true)}
            className="portal-nav-item w-full"
            style={{ color: "#ba1a1a" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
            {t.customer.signOut}
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Navbar ── */}
      <header
        style={{
          display: windowW < 1024 ? "flex" : "none",
          alignItems: "center", justifyContent: "space-between",
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          height: 64, padding: "0 20px",
          background: "#fff", borderBottom: "1px solid #ede3cd"
        }}
      >
        <Link href="/landing" style={{ fontSize: 17, fontWeight: 900, color: "#1c1611", textDecoration: "none", letterSpacing: "0.015em", fontFamily: "var(--font-intervar),sans-serif" }}>
          Halaqy.
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/customer/explore"
            style={{ background: "#1c1611", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            {t.customer.bookNow}
          </Link>
          <button
            onClick={() => setLogoutConfirm(true)}
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#f7f1e4", border: "none", cursor: "pointer", color: "#5a5147" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={{ paddingLeft: windowW >= 1024 ? 240 : 0 }}>
        <main style={{ paddingTop: windowW >= 1024 ? 0 : 64, paddingBottom: windowW >= 1024 ? 48 : 112 }}>
          {/* Inner container */}
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>

            {/* Page header */}
            <div style={{ paddingTop: 32, paddingBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.1em"), color: "#5a5147", marginBottom: 4 }}>
                {t.customer.welcomeBack}
              </p>
              {loading ? (
                <div className="shimmer-card rounded-xl" style={{ height: 40, width: 220, marginTop: 8 }} />
              ) : (
                <h1
                  style={{
                    fontSize: "clamp(24px, 4vw, 36px)",
                    fontWeight: 900,
                    color: "#1c1611",
                    letterSpacing: "0.015em",
                    fontFamily: "var(--font-intervar),sans-serif",
                    margin: 0,
                  }}
                >
                  {user?.full_name?.split(" ")[0] || "Hello"}&apos;s Portal
                </h1>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: t.customer.completed, value: loading ? "—" : completedCount, icon: "check_circle", color: "#a67c3d" },
                { label: t.customer.upcoming,  value: loading ? "—" : upcoming.length,  icon: "schedule",      color: "#a67c3d" },
                { label: t.customer.thisMonth, value: loading ? "—" : thisMonthCount,   icon: "calendar_month",color: "#5a5147" },
              ].map(stat => (
                <div
                  key={stat.label}
                  style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #ede3cd" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: stat.color, fontVariationSettings: "'FILL' 1" }}>
                    {stat.icon}
                  </span>
                  <p style={{ fontSize: 26, fontWeight: 900, color: "#1c1611", margin: "4px 0 2px", fontFamily: "var(--font-intervar),sans-serif" }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#5a5147" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* CTA Banner */}
            <div
              style={{
                borderRadius: 12,
                padding: "24px 28px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                overflow: "hidden",
                position: "relative",
                background: "#f7f1e4",
              }}
            >
              <div style={{ position: "absolute", inset: 0, opacity: 0.06 }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <h2 style={{ color: "#1c1611", fontWeight: 900, fontSize: 17, fontFamily: FF, margin: "0 0 4px" }}>
                  {t.customer.readyForNext}
                </h2>
                <p style={{ color: "#5a5147", fontSize: 13, margin: 0 }}>
                  {t.customer.browseShops}
                </p>
              </div>
              <Link
                href="/customer/explore"
                style={{
                  position: "relative", zIndex: 1, flexShrink: 0,
                  background: "#7c4a1e", color: "#fff",
                  padding: "10px 20px", borderRadius: 8,
                  fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap",
                }}
              >
                {t.customer.explore} →
              </Link>
            </div>

            {/* Tab Bar */}
            <div style={{ borderBottom: "1px solid #ede3cd", marginBottom: 0, display: "flex", gap: 0 }}>
              {([
                { key: "upcoming",  label: t.customer.upcoming,  count: upcoming.length  },
                { key: "past",      label: t.customer.past,      count: past.length      },
                { key: "cancelled", label: t.customer.cancelled, count: cancelled.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`portal-tab-btn${activeTab === tab.key ? " active" : ""}`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      style={{
                        marginLeft: 5, fontSize: 11, fontWeight: 700,
                        padding: "1px 6px", borderRadius: 9999,
                        background: activeTab === tab.key ? "#f7f1e4" : "#ffffff",
                        color: activeTab === tab.key ? "#1c1611" : "#5a5147",
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Loyalty / rebooking nudge */}
            {activeTab === "upcoming" && rebookingNudge && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#f7f1e4", border: "1px solid #ede3cd", borderRadius: 12,
                  padding: "16px 20px", marginTop: 16,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c1611", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#fff" }}>event_repeat</span>
                </div>
                <p style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#1c1611", margin: 0 }}>
                  {isRTL
                    ? `عادة ما تكون بحاجة لزيارة ${rebookingNudge.barberName} في مثل هذا الوقت — هل تحجز مرة أخرى؟`
                    : `You're usually due for a visit with ${rebookingNudge.barberName} around now — book again?`}
                </p>
                <Link
                  href={`/book/${rebookingNudge.shopId}`}
                  style={{ flexShrink: 0, background: "#7c4a1e", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                >
                  {isRTL ? "احجز" : "Book"}
                </Link>
              </div>
            )}

            {/* Appointment list */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
              ) : displayList.length === 0 ? (
                <div
                  style={{
                    background: "#fff", borderRadius: 12, border: "1px solid #ede3cd",
                    padding: "48px 24px", display: "flex", flexDirection: "column",
                    alignItems: "center", textAlign: "center",
                  }}
                >
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#f7f1e4", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <span className="material-symbols-outlined text-[#5a5147]" style={{ fontSize: 28 }}>
                      {activeTab === "upcoming" ? "calendar_today" : activeTab === "past" ? "history" : "cancel"}
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 700, color: "#1c1611", fontSize: 16, marginBottom: 6 }}>
                    {activeTab === "upcoming" ? t.customer.noUpcoming : activeTab === "past" ? t.customer.noPast : t.customer.noCancelled}
                  </h3>
                  <p style={{ fontSize: 13, color: "#5a5147", marginBottom: 20 }}>
                    {activeTab === "upcoming" ? t.customer.noUpcomingDesc : t.customer.noPastDesc}
                  </p>
                  {activeTab === "upcoming" && (
                    <Link
                      href="/customer/explore"
                      style={{
                        background: "#1c1611", color: "#fff", padding: "10px 24px",
                        borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none",
                      }}
                    >
                      {t.customer.exploreShops}
                    </Link>
                  )}
                </div>
              ) : (
                <AnimatePresence>
                  {displayList.map((appt, i) => {
                    // A lapsed (past-dated) appointment that was never explicitly
                    // marked completed/no-show/cancelled must not still read as
                    // "Upcoming" just because its raw status is still "confirmed" —
                    // the badge must match the tab it's actually rendered in.
                    const sc = (activeTab === "past" && appt.status === "confirmed")
                      ? STATUS_CONFIG.completed
                      : (STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending);
                    const date = new Date(appt.start_time);
                    const isUpcoming = activeTab === "upcoming";

                    return (
                      <motion.div
                        key={appt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: i * 0.04 }}
                        style={{
                          background: "#fff", borderRadius: 12, border: "1px solid #ede3cd",
                          transition: "transform 150ms ease",
                        }}
                        whileHover={{ y: -2 }}
                      >
                        <div style={{ padding: 20 }}>
                          <div className="flex items-start gap-4">
                            {/* Shop thumbnail */}
                            <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", background: "#f7f1e4", flexShrink: 0 }}>
                              <img
                                src={SHOP_IMAGES[i % SHOP_IMAGES.length]}
                                alt={appt.shop_name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>

                            {/* Main info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                                <span
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "2px 8px", borderRadius: 9999,
                                    fontSize: 11, fontWeight: 700,
                                    background: sc.bgColor, color: sc.textColor,
                                  }}
                                >
                                  {sc.label}
                                </span>
                                <span style={{ fontSize: 11, color: "#a89e8c" }}>#{appt.id.slice(0, 7).toUpperCase()}</span>
                              </div>
                              <h3
                                style={{
                                  fontWeight: 800, color: "#1c1611", fontSize: 15,
                                  lineHeight: 1.3, margin: 0, overflow: "hidden",
                                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  fontFamily: "var(--font-intervar),sans-serif",
                                }}
                              >
                                {appt.shop_name}
                              </h3>
                              {appt.service_name && (
                                <p style={{ fontSize: 13, color: "#5a5147", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {appt.service_name}{appt.barber_name ? ` · ${appt.barber_name}` : ""}
                                </p>
                              )}
                            </div>

                            {/* Date + price */}
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontWeight: 700, color: "#1c1611", fontSize: 14, margin: 0 }}>{format(date, "MMM d")}</p>
                              <p style={{ fontSize: 12, color: "#5a5147", margin: "1px 0" }}>{format(date, "h:mm a")}</p>
                              <p style={{ fontWeight: 800, color: "#1c1611", fontSize: 14, margin: 0 }}>{appt.price} JOD</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div
                            className="flex gap-2 mt-4 pt-3"
                            style={{ borderTop: "1px solid #ede3cd" }}
                          >
                            {isUpcoming ? (
                              <>
                                <Link
                                  href={`/book/${appt.shop_id}?reschedule=${appt.id}`}
                                  style={{
                                    flex: 1, textAlign: "center", padding: "8px",
                                    borderRadius: 8, background: "#f7f1e4",
                                    color: "#5a5147", fontSize: 12, fontWeight: 700,
                                    textDecoration: "none",
                                  }}
                                >
                                  {t.customer.reschedule}
                                </Link>
                                <button
                                  onClick={() => setCancelConfirm(appt.id)}
                                  style={{
                                    flex: 1, textAlign: "center", padding: "8px",
                                    borderRadius: 8, background: "rgba(186,26,26,0.06)",
                                    color: "#ba1a1a", fontSize: 12, fontWeight: 700,
                                    border: "1px solid rgba(186,26,26,0.2)", cursor: "pointer",
                                  }}
                                >
                                  {t.customer.cancel}
                                </button>
                              </>
                            ) : (
                              <>
                                <Link
                                  href={`/book/${appt.shop_id}`}
                                  style={{
                                    flex: 1, textAlign: "center", padding: "8px",
                                    borderRadius: 8, background: "#1c1611",
                                    color: "#fff", fontSize: 12, fontWeight: 700,
                                    textDecoration: "none",
                                  }}
                                >
                                  {t.customer.bookAgain}
                                </Link>
                                {appt.status === "completed" && !userReviewedApptIds.has(appt.id) && (
                                  <button
                                    onClick={() => setReviewAppt(appt)}
                                    style={{
                                      flex: 1, textAlign: "center", padding: "8px",
                                      borderRadius: 8, background: "#f7f1e4",
                                      color: "#1c1611", fontSize: 12, fontWeight: 700,
                                      border: "none", cursor: "pointer",
                                    }}
                                  >
                                    ★ {t.customer.review}
                                  </button>
                                )}
                                {userReviewedApptIds.has(appt.id) && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 12px", background: "#f7f1e4", borderRadius: 9999 }}>
                                    {[1,2,3,4,5].map(s => (
                                      <span key={s} className="material-symbols-outlined" style={{ fontSize: 13, color: "#a67c3d", fontVariationSettings: "'FILL' 1" }}>star</span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-4 pt-2.5"
        style={{
          background: "#ffffff",
          borderTop: "1px solid #ede3cd",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <Link href="/customer/explore" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none", color: "#5a5147" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>explore</span>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{t.customer.explore}</span>
        </Link>
        <Link href="/customer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textDecoration: "none" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c1611", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>event_note</span>
          </div>
        </Link>
        <button
          onClick={() => setEditProfile(true)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "#5a5147" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>person</span>
          <span style={{ fontSize: 10, fontWeight: 700 }}>Account</span>
        </button>
      </nav>

      {/* ── Edit Profile Modal ── */}
      <AnimatePresence>
        {editProfile && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditProfile(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25,1,0.5,1] }}
              style={{
                position: "relative", width: "100%", maxWidth: 480,
                background: "#fff", borderRadius: "12px 12px 0 0",
                padding: "32px 28px",
              }}
              className="sm:rounded-xl sm:mb-4"
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#1c1611", fontFamily: FF }}>{isRTL ? "تعديل الملف الشخصي" : "Edit Profile"}</h3>
                <button
                  onClick={() => setEditProfile(false)}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "#f7f1e4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: isRTL ? "الاسم الكامل" : "Full Name", value: editName, setter: setEditName, type: "text", readOnly: false },
                  { label: isRTL ? "البريد الإلكتروني" : "Email", value: user?.email || "", setter: () => {}, type: "email", readOnly: true },
                  { label: isRTL ? "الهاتف" : "Phone", value: editPhone, setter: setEditPhone, type: "tel", readOnly: false },
                ].map(field => (
                  <div key={field.label}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.08em"), color: "#5a5147", marginBottom: 6 }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      readOnly={field.readOnly}
                      style={{
                        width: "100%", height: 48, padding: "0 16px", borderRadius: 8,
                        background: field.readOnly ? "#ffffff" : "#f7f1e4",
                        border: "1.5px solid #ede3cd", outline: "none",
                        fontSize: 14, fontWeight: 500, color: field.readOnly ? "#5a5147" : "#1c1611",
                        fontFamily: FF, boxSizing: "border-box",
                        opacity: field.readOnly ? 0.7 : 1,
                      }}
                      onFocus={e => { if (!field.readOnly) { e.target.style.borderColor = "#a67c3d"; e.target.style.background = "#fff"; e.target.style.boxShadow = "var(--shadow-focus)"; } }}
                      onBlur={e => { if (!field.readOnly) { e.target.style.borderColor = "#ede3cd"; e.target.style.background = "#f7f1e4"; e.target.style.boxShadow = "none"; } }}
                    />
                  </div>
                ))}
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{
                    width: "100%", height: 48, background: saving ? "#a67c3d" : "#7c4a1e",
                    color: "#fff", borderRadius: 8, border: "none", fontWeight: 700,
                    fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                    marginTop: 4, fontFamily: FF,
                  }}
                >
                  {saving ? (isRTL ? "جارٍ الحفظ…" : "Saving…") : (isRTL ? "حفظ التغييرات" : "Save Changes")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Cancel Confirm Modal ── */}
      <AnimatePresence>
        {cancelConfirm && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCancelConfirm(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                position: "relative", width: "100%", maxWidth: 360,
                background: "#fff", borderRadius: 12, padding: "32px 28px",
                textAlign: "center",
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(186,26,26,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#ba1a1a" }}>event_busy</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1c1611", marginBottom: 8 }}>{isRTL ? "إلغاء هذا الموعد؟" : "Cancel this appointment?"}</h3>
              <p style={{ fontSize: 13, color: "#5a5147", marginBottom: 24 }}>{isRTL ? "لا يمكن التراجع عن هذا. سيتم تحرير الموعد." : "This cannot be undone. The slot will be released."}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCancelConfirm(null)}
                  style={{ height: 44, borderRadius: 8, background: "#f7f1e4", color: "#5a5147", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                >{isRTL ? "الاحتفاظ به" : "Keep It"}</button>
                <button
                  onClick={() => handleCancel(cancelConfirm)}
                  style={{ height: 44, borderRadius: 8, background: "#ba1a1a", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                >{isRTL ? "إلغاء الحجز" : "Cancel Booking"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Logout Confirm Modal ── */}
      <AnimatePresence>
        {logoutConfirm && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLogoutConfirm(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                position: "relative", width: "100%", maxWidth: 320,
                background: "#fff", borderRadius: 12, padding: "28px 24px",
                textAlign: "center",
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1c1611", marginBottom: 8 }}>{isRTL ? "تسجيل الخروج من حلاقي؟" : "Sign out of Halaqy?"}</h3>
              <p style={{ fontSize: 13, color: "#5a5147", marginBottom: 24 }}>{isRTL ? "يمكنك تسجيل الدخول مرة أخرى في أي وقت." : "You can always sign back in at any time."}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLogoutConfirm(false)}
                  style={{ height: 44, borderRadius: 8, background: "#f7f1e4", color: "#5a5147", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                >{isRTL ? "البقاء" : "Stay"}</button>
                <button
                  onClick={handleSignOut}
                  style={{ height: 44, borderRadius: 8, background: "#7c4a1e", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                >{t.customer.signOut}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewAppt && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setReviewAppt(null); setReviewRating(0); }}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25,1,0.5,1] }}
              style={{
                position: "relative", width: "100%", maxWidth: 480,
                background: "#fff", borderRadius: "12px 12px 0 0",
                padding: "32px 28px",
              }}
              className="sm:rounded-xl sm:mb-4"
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#1c1611", fontFamily: FF }}>{isRTL ? "أضف تقييماً" : "Leave a Review"}</h3>
                <button
                  onClick={() => { setReviewAppt(null); setReviewRating(0); }}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "#f7f1e4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#5a5147", marginBottom: 20 }}>
                {isRTL ? (
                  <>كيف كانت زيارتك إلى <strong style={{ color: "#1c1611" }}>{reviewAppt.shop_name}</strong>؟</>
                ) : (
                  <>How was your visit at <strong style={{ color: "#1c1611" }}>{reviewAppt.shop_name}</strong>?</>
                )}
              </p>
              {/* Stars */}
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex", transition: "transform 120ms ease" }}
                    onMouseDown={e => { e.currentTarget.style.transform = "scale(0.85)"; }}
                    onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 40,
                        color: star <= (reviewHover || reviewRating) ? "#a67c3d" : "#ede3cd",
                        fontVariationSettings: star <= (reviewHover || reviewRating) ? "'FILL' 1" : "'FILL' 0",
                        transition: "color 100ms ease",
                      }}
                    >star</span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value.slice(0, 280))}
                placeholder={isRTL ? "أخبرنا بما أعجبك… (اختياري)" : "Tell us what you loved… (optional)"}
                style={{
                  width: "100%", height: 100, padding: 14, borderRadius: 8,
                  background: "#f7f1e4", border: "none", outline: "none",
                  fontSize: 14, fontWeight: 500, fontFamily: FF, resize: "none",
                  marginBottom: 16, boxSizing: "border-box", color: "#1c1611",
                }}
                onFocus={e => { e.target.style.background = "#fff"; e.target.style.boxShadow = "var(--shadow-focus)"; }}
                onBlur={e => { e.target.style.background = "#f7f1e4"; e.target.style.boxShadow = "none"; }}
              />
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || reviewRating === 0}
                style={{
                  width: "100%", height: 48, background: submittingReview || reviewRating === 0 ? "#a89e8c" : "#7c4a1e",
                  color: "#fff", borderRadius: 8, border: "none", fontWeight: 700,
                  fontSize: 14, cursor: submittingReview || reviewRating === 0 ? "not-allowed" : "pointer",
                  fontFamily: FF,
                }}
              >
                {submittingReview ? (isRTL ? "جارٍ الإرسال…" : "Submitting…") : (isRTL ? "إرسال التقييم" : "Submit Review")}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
