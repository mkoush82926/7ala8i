"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Scissors, Calendar, Clock, MapPin, LogOut, User, CalendarPlus, Loader2,
  ChevronRight, X, Save, RefreshCw, XCircle, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  barber_name: string | null;
}

export default function CustomerDashboard() {
  const [user, setUser] = useState<{ id: string; full_name: string; email: string; phone: string } | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", authUser.id)
        .single();

      if (profile?.role !== "customer") {
        router.push("/");
        return;
      }

      const phone = authUser.user_metadata?.phone || "";
      setUser({ id: authUser.id, full_name: profile.full_name, email: authUser.email || "", phone });
      setEditName(profile.full_name);
      setEditPhone(phone);

      const { data: clientRecords } = await supabase
        .from("clients")
        .select("id")
        .or(`email.eq.${authUser.email},phone.eq.${phone || "NONE"}`);

      if (clientRecords && clientRecords.length > 0) {
        const clientIds = clientRecords.map((c) => c.id);

        const { data: appts } = await supabase
          .from("appointments")
          .select("id, client_name, start_time, end_time, status, price, shop_id, barber_id")
          .in("client_id", clientIds)
          .order("start_time", { ascending: false });

        if (appts && appts.length > 0) {
          const shopIds = [...new Set(appts.map((a) => a.shop_id))];
          const barberIds = [...new Set(appts.map((a) => a.barber_id).filter(Boolean))] as string[];

          const [shopsRes, barbersRes] = await Promise.all([
            supabase.from("shops").select("id, name, address").in("id", shopIds),
            barberIds.length > 0
              ? supabase.from("profiles").select("id, full_name").in("id", barberIds)
              : { data: [] },
          ]);

          const shopMap = new Map(shopsRes.data?.map((s) => [s.id, s]) || []);
          const barberMap = new Map((barbersRes.data || []).map((b: { id: string; full_name: string }) => [b.id, b.full_name]));

          setAppointments(appts.map((a) => ({
            id: a.id,
            shop_id: a.shop_id,
            shop_name: shopMap.get(a.shop_id)?.name || "Barbershop",
            shop_address: shopMap.get(a.shop_id)?.address || null,
            client_name: a.client_name,
            start_time: a.start_time,
            end_time: a.end_time,
            status: a.status,
            price: a.price,
            barber_name: a.barber_id ? barberMap.get(a.barber_id) || null : null,
          })));
        }
      }

      setLoading(false);
    }

    load();
  }, [supabase, router]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ full_name: editName } as Record<string, unknown>).eq("id", user.id);
    setUser({ ...user, full_name: editName, phone: editPhone });
    setEditProfile(false);
    setSaving(false);
  }

  async function handleCancel(apptId: string) {
    if (!confirm("Cancel this appointment?")) return;
    await supabase.from("appointments").update({ status: "cancelled" } as Record<string, unknown>).eq("id", apptId);
    setAppointments((prev) => prev.map((a) => a.id === apptId ? { ...a, status: "cancelled" } : a));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--accent-mint)]" size={32} />
      </div>
    );
  }

  const upcoming = appointments.filter((a) => new Date(a.start_time) >= new Date() && a.status !== "cancelled");
  const past = appointments.filter((a) => new Date(a.start_time) < new Date() || a.status === "cancelled");

  const statusColors: Record<string, string> = {
    pending: "text-[var(--accent-amber)] bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]/20",
    confirmed: "text-[var(--accent-blue)] bg-[var(--accent-blue-muted)] border-[var(--accent-blue)]/20",
    completed: "text-[var(--accent-mint)] bg-[var(--accent-mint-muted)] border-[var(--accent-mint)]/20",
    cancelled: "text-[var(--accent-rose)] bg-[var(--accent-rose-muted)] border-[var(--accent-rose)]/20",
    "no-show": "text-[var(--text-muted)] bg-[var(--bg-surface)] border-[var(--border-primary)]",
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

      <header
        className="flex items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl sticky top-0 z-30"
        style={{ height: 72, paddingLeft: 28, paddingRight: 28 }}
      >
        <div className="flex items-center" style={{ gap: 14 }}>
          <div className="rounded-xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center" style={{ width: 36, height: 36 }}>
            <Scissors size={16} className="text-[#050507]" />
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-tertiary)] uppercase font-medium">Welcome back</p>
            <h1 className="text-[15px] text-[var(--text-primary)] font-bold">{user?.full_name}</h1>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button
            onClick={handleSignOut}
            style={{ height: 36, padding: "0 16px" }}
            className="flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[12px] font-medium hover:text-[var(--accent-rose)] hover:border-[var(--accent-rose)]/30 transition-all cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div className="relative z-10" style={{ maxWidth: 800, marginLeft: "auto", marginRight: "auto", padding: "48px 32px" }}>
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 18, marginBottom: 48 }}>
          <Link
            href="/explore"
            className="glass-card-premium flex items-center group cursor-pointer"
            style={{ padding: 22 }}
          >
            <div className="rounded-xl bg-[var(--accent-mint-muted)] flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, marginRight: 16 }}>
              <CalendarPlus size={20} className="text-[var(--accent-mint)]" />
            </div>
            <div className="flex-1">
              <p className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 15 }}>Book Appointment</p>
              <p className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>Find a barbershop near you</p>
            </div>
            <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--accent-mint)] transition-colors" />
          </Link>

          <button
            onClick={() => setEditProfile(true)}
            className="glass-card-premium flex items-center cursor-pointer group text-start"
            style={{ padding: 22 }}
          >
            <div className="rounded-xl bg-[var(--accent-lavender)]/15 flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, marginRight: 16 }}>
              <User size={20} className="text-[var(--accent-lavender)]" />
            </div>
            <div className="flex-1">
              <p className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 15 }}>My Profile</p>
              <p className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>{user?.email}</p>
            </div>
            <Pencil size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent-lavender)] transition-colors" />
          </button>
        </div>

        {/* Upcoming Appointments */}
        <div style={{ marginBottom: 48 }}>
          <h2 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 22, marginBottom: 24 }}>
            Upcoming Appointments
          </h2>
          {upcoming.length === 0 ? (
            <div className="glass-card-premium text-center" style={{ padding: "56px 28px" }}>
              <Calendar size={32} className="text-[var(--text-muted)] mx-auto" style={{ marginBottom: 16 }} />
              <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, marginBottom: 20 }}>
                No upcoming appointments
              </p>
              <Link
                href="/explore"
                style={{ height: 48, padding: "0 24px" }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] font-semibold text-[14px] hover:opacity-90 transition-opacity cursor-pointer relative z-20"
              >
                <CalendarPlus size={16} /> Book Now
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {upcoming.map((appt) => (
                <div key={appt.id} className="glass-card-premium" style={{ padding: 26 }}>
                  <div className="flex items-start justify-between" style={{ marginBottom: 20 }}>
                    <div>
                      <p className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 15 }}>{appt.shop_name}</p>
                      {appt.shop_address && (
                        <p className="text-[var(--text-tertiary)] flex items-center" style={{ fontSize: 12, gap: 4, marginTop: 4 }}>
                          <MapPin size={11} /> {appt.shop_address}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize", statusColors[appt.status] || statusColors.pending)}>
                      {appt.status}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap" style={{ gap: 16, marginBottom: 16 }}>
                    <span className="text-[var(--text-secondary)] flex items-center" style={{ fontSize: 13, gap: 6 }}>
                      <Calendar size={13} /> {format(new Date(appt.start_time), "EEE, MMM d")}
                    </span>
                    <span className="text-[var(--text-secondary)] flex items-center" style={{ fontSize: 13, gap: 6 }}>
                      <Clock size={13} /> {format(new Date(appt.start_time), "h:mm a")}
                    </span>
                    {appt.barber_name && (
                      <span className="text-[var(--text-secondary)] flex items-center" style={{ fontSize: 13, gap: 6 }}>
                        <Scissors size={13} /> {appt.barber_name}
                      </span>
                    )}
                    <span className="text-[var(--accent-mint)] font-semibold" style={{ fontSize: 13 }}>
                      {appt.price} JOD
                    </span>
                  </div>
                  {appt.status !== "cancelled" && (
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <Link
                        href={`/book/${appt.shop_id}`}
                        style={{ height: 34, padding: "0 16px" }}
                        className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-[12px] font-medium flex items-center gap-1.5 hover:border-[var(--border-hover)] transition-all relative z-20"
                      >
                        <RefreshCw size={12} /> Reschedule
                      </Link>
                      <button
                        onClick={() => handleCancel(appt.id)}
                        style={{ height: 34, padding: "0 16px" }}
                        className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[12px] font-medium flex items-center gap-1.5 hover:text-[var(--accent-rose)] hover:border-[var(--accent-rose)]/30 transition-all cursor-pointer relative z-20"
                      >
                        <XCircle size={12} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Appointments */}
        {past.length > 0 && (
          <div>
            <h2 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 22, marginBottom: 24 }}>
              Past Appointments
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {past.slice(0, 10).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)]" style={{ padding: "16px 20px", minHeight: 54 }}>
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <div className="rounded-lg bg-[var(--bg-surface-hover)] flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                      <Scissors size={14} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <p className="text-[var(--text-primary)] font-medium" style={{ fontSize: 13 }}>{appt.shop_name}</p>
                      <p className="text-[var(--text-muted)]" style={{ fontSize: 11 }}>
                        {format(new Date(appt.start_time), "MMM d, yyyy")} · {format(new Date(appt.start_time), "h:mm a")}
                        {appt.barber_name && ` · ${appt.barber_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <div className="text-end">
                      <p className="text-[var(--text-primary)] font-medium" style={{ fontSize: 13 }}>{appt.price} JOD</p>
                      <span className={cn("text-[10px] font-medium capitalize", appt.status === "completed" ? "text-[var(--accent-mint)]" : "text-[var(--text-muted)]")}>
                        {appt.status}
                      </span>
                    </div>
                    {appt.status === "completed" && (
                      <Link
                        href={`/book/${appt.shop_id}`}
                        className="h-7 px-3 rounded-lg bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] text-[11px] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity relative z-20"
                      >
                        <RefreshCw size={10} /> Rebook
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile Edit Modal */}
      {editProfile && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setEditProfile(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setEditProfile(false)}>
            <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-2xl" style={{ padding: "28px 28px 24px" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <h3 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 18 }}>Edit Profile</h3>
                <button onClick={() => setEditProfile(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col" style={{ gap: 18 }}>
                <div>
                  <label style={{ marginBottom: 8 }} className="block text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ height: 42, padding: "0 14px" }}
                    className="w-full rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] transition-all"
                  />
                </div>
                <div>
                  <label style={{ marginBottom: 8 }} className="block text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Email</label>
                  <div style={{ height: 42, padding: "0 14px" }} className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center">
                    <span className="text-[13px] text-[var(--text-muted)]">{user?.email}</span>
                  </div>
                </div>
                <div>
                  <label style={{ marginBottom: 8 }} className="block text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{ height: 42, padding: "0 14px" }}
                    className="w-full rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-xl bg-[var(--accent-mint)] text-[#0A0A0A] font-semibold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                  style={{ height: 42, marginTop: 24 }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
