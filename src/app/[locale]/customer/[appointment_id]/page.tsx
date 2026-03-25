"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

interface AppointmentDetail {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  client_name: string;
  barber_name: string | null;
  service_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  source: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-secondary-container text-on-secondary-container",
  pending: "bg-tertiary-fixed text-on-tertiary-fixed",
  cancelled: "bg-error-container text-on-error-container",
  completed: "bg-surface-container-high text-on-surface",
};

export default function BookingDetailPage() {
  const params = useParams();
  const appointmentId = params.appointment_id as string;
  const router = useRouter();
  const supabase = createClient();

  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/auth/login"); return; }

      const { data: apptRow } = await supabase
        .from("appointments")
        .select("id, shop_id, client_name, barber_id, service_name, start_time, end_time, status, price, source")
        .eq("id", appointmentId)
        .single();

      if (!apptRow) { setLoading(false); return; }

      const [shopRes, barberRes] = await Promise.all([
        supabase.from("shops").select("name, address, phone").eq("id", apptRow.shop_id).single(),
        apptRow.barber_id
          ? supabase.from("profiles").select("full_name").eq("id", apptRow.barber_id).single()
          : Promise.resolve({ data: null }),
      ]);

      setAppt({
        id: apptRow.id,
        shop_id: apptRow.shop_id,
        shop_name: shopRes.data?.name || "Barbershop",
        shop_address: shopRes.data?.address || null,
        shop_phone: shopRes.data?.phone || null,
        client_name: apptRow.client_name,
        barber_name: (barberRes as any).data?.full_name || null,
        service_name: apptRow.service_name || null,
        start_time: apptRow.start_time,
        end_time: apptRow.end_time,
        status: apptRow.status,
        price: apptRow.price,
        source: apptRow.source || null,
      });
      setLoading(false);
    }
    load();
  }, [appointmentId]);

  async function handleCancel() {
    if (!appt) return;
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_public_booking", { p_appointment_id: appt.id });
    if (error) {
      alert("Failed to cancel: " + error.message);
      setCancelling(false);
      return;
    }
    setAppt((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-outline">event_busy</span>
        </div>
        <h2 className="font-headline text-xl font-bold mb-2">Booking Not Found</h2>
        <p className="text-on-surface-variant text-sm mb-6">This appointment does not exist or you don&apos;t have access to it.</p>
        <Link href="/customer" className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold text-sm">
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isUpcoming = new Date(appt.start_time) >= new Date() && appt.status !== "cancelled";
  const statusLabel = appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
  const statusStyle = STATUS_STYLES[appt.status] || "bg-surface-container text-on-surface";

  return (
    <div style={{ background: "#f7f9fb" }} className="font-body text-[#191c1e] min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white h-16 border-b border-neutral-100">
        <div className="flex justify-between items-center max-w-3xl mx-auto px-6 h-full">
          <Link href="/customer" className="flex items-center gap-2 text-neutral-500 hover:text-black transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-sm font-bold">My Bookings</span>
          </Link>
          <span className="font-bold text-sm">Appointment Detail</span>
        </div>
      </header>

      <main className="pt-20 pb-28 max-w-3xl mx-auto px-5 lg:px-6">
        {/* Status Badge */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${statusStyle}`}>
            {statusLabel}
          </span>
          <span className="text-xs font-medium text-neutral-400">Ref #{appt.id.slice(0, 7).toUpperCase()}</span>
        </div>

        {/* Main Detail Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden mb-6">
          {/* Shop Banner */}
          <div className="bg-black p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)" }} />
            <div className="relative z-10">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Your Appointment</p>
              <h1 className="font-black text-3xl text-white">{appt.shop_name}</h1>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-0 divide-y divide-neutral-100">
            <div className="flex justify-between items-start py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Date & Time</p>
                <p className="font-headline font-bold text-lg">{format(new Date(appt.start_time), "EEEE, MMMM d, yyyy")}</p>
                <p className="text-on-surface-variant text-sm">{format(new Date(appt.start_time), "h:mm a")} — {format(new Date(appt.end_time), "h:mm a")}</p>
              </div>
              <span className="material-symbols-outlined text-outline">calendar_today</span>
            </div>

            {appt.service_name && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Service</p>
                  <p className="font-bold">{appt.service_name}</p>
                </div>
                <span className="material-symbols-outlined text-outline">content_cut</span>
              </div>
            )}

            {appt.barber_name && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Barber</p>
                  <p className="font-bold">{appt.barber_name}</p>
                </div>
                <span className="material-symbols-outlined text-outline">person</span>
              </div>
            )}

            {appt.shop_address && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Location</p>
                  <p className="font-bold">{appt.shop_address}</p>
                </div>
                <span className="material-symbols-outlined text-outline">location_on</span>
              </div>
            )}

            {appt.shop_phone && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Contact</p>
                  <a href={`tel:${appt.shop_phone}`} className="font-bold hover:underline">{appt.shop_phone}</a>
                </div>
                <span className="material-symbols-outlined text-outline">call</span>
              </div>
            )}

            <div className="flex justify-between items-center py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Total</p>
                <p className="font-headline font-black text-2xl">{appt.price} JOD</p>
                <p className="text-xs text-on-surface-variant">Payment in-store</p>
              </div>
              <span className="material-symbols-outlined text-outline">payments</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-col sm:flex-row">
          {isUpcoming && (
            <>
              <Link
                href={`/book/${appt.shop_id}`}
                className="flex-1 text-center py-4 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
              >
                Reschedule
              </Link>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-4 bg-surface-container-lowest text-error border border-error/20 rounded-lg font-bold text-sm hover:bg-error/5 active:scale-95 transition-all disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Appointment"}
              </button>
            </>
          )}
          {!isUpcoming && (
            <Link
              href={`/book/${appt.shop_id}`}
              className="flex-1 text-center py-4 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
            >
              Book Again
            </Link>
          )}
        </div>

        {/* Shop Link */}
        <div className="mt-6 text-center">
          <Link href={`/shop/${appt.shop_id}`} className="text-sm font-bold text-on-surface-variant underline underline-offset-4 decoration-2 hover:text-on-surface transition-colors">
            View Shop Profile
          </Link>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pb-8 pt-4 md:hidden bg-white/80 backdrop-blur-xl border-t border-neutral-100 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Link className="flex flex-col items-center justify-center text-neutral-400" href="/explore">
          <span className="material-symbols-outlined">search</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest mt-1">Explore</span>
        </Link>
        <Link className="flex flex-col items-center justify-center bg-black text-white rounded-full w-12 h-12 scale-90 active:scale-100 transition-transform" href="/customer">
          <span className="material-symbols-outlined">event_note</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-neutral-400" href="/customer">
          <span className="material-symbols-outlined">person</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest mt-1">Account</span>
        </Link>
      </nav>
    </div>
  );
}
