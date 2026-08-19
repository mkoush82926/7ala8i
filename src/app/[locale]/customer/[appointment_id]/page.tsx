"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/use-translation";

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
  pending: "bg-surface-container text-on-surface",
  cancelled: "bg-error-container text-on-error-container",
  completed: "bg-surface-container-high text-on-surface",
};

export default function BookingDetailPage() {
  const params = useParams();
  const appointmentId = params.appointment_id as string;
  const router = useRouter();
  const supabase = createClient();
  const { t, dir, isRTL } = useTranslation();

  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
        barber_name: (barberRes.data as { full_name: string | null } | null)?.full_name || null,
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
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_customer_booking", { p_appointment_id: appt.id });
    setCancelling(false);
    if (error) {
      showToast(isRTL ? `فشل الإلغاء: ${error.message}` : `Failed to cancel: ${error.message}`);
      return;
    }
    setAppt((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    setShowCancelConfirm(false);
    showToast(isRTL ? "تم إلغاء الموعد." : "Appointment cancelled.");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#091135] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir={dir}>
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-outline">event_busy</span>
        </div>
        <h2 className="font-headline text-xl font-bold mb-2">{isRTL ? "الحجز غير موجود" : "Booking Not Found"}</h2>
        <p className="text-on-surface-variant text-sm mb-6">{isRTL ? "هذا الموعد غير موجود أو لا تملك صلاحية الوصول إليه." : "This appointment does not exist or you don't have access to it."}</p>
        <Link href="/customer" className="bg-tertiary-fixed text-on-tertiary-fixed px-6 py-3 rounded-[8px] font-bold text-sm">
          {isRTL ? "العودة إلى مواعيدي" : "Back to My Bookings"}
        </Link>
      </div>
    );
  }

  const isUpcoming = new Date(appt.start_time) >= new Date() && appt.status !== "cancelled";
  const STATUS_LABELS: Record<string, string> = {
    confirmed: t.customer.upcoming,
    pending: isRTL ? "قيد الانتظار" : "Pending",
    cancelled: t.customer.cancelled,
    completed: t.customer.completed,
    no_show: isRTL ? "لم يحضر" : "No-show",
  };
  const statusLabel = STATUS_LABELS[appt.status] || (appt.status.charAt(0).toUpperCase() + appt.status.slice(1));
  const statusStyle = STATUS_STYLES[appt.status] || "bg-surface-container text-on-surface";

  return (
    <div style={{ background: "#ffffff" }} className="font-body text-[#091135] min-h-screen" dir={dir}>
      {/* ── Toast notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] bg-primary text-on-primary px-5 py-3 rounded-xl text-[13px] font-bold flex items-center gap-2 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white h-16 border-b border-outline-variant">
        <div className="flex justify-between items-center max-w-3xl mx-auto px-6 h-full">
          <Link href="/customer" className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-sm font-bold">{t.customer.myAppointments}</span>
          </Link>
          <span className="font-bold text-sm">{isRTL ? "تفاصيل الموعد" : "Appointment Detail"}</span>
        </div>
      </header>

      <main className="pt-20 pb-28 max-w-3xl mx-auto px-5 lg:px-6">
        {/* Status Badge */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${statusStyle}`}>
            {statusLabel}
          </span>
          <span className="text-xs font-medium text-on-surface-variant">{isRTL ? "مرجع #" : "Ref #"}{appt.id.slice(0, 7).toUpperCase()}</span>
        </div>

        {/* Main Detail Card */}
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden mb-6">
          {/* Shop Banner */}
          <div className="bg-primary p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" />
            <div className="relative z-10">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">{isRTL ? "موعدك" : "Your Appointment"}</p>
              <h1 className="font-black text-3xl text-white">{appt.shop_name}</h1>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-0 divide-y divide-outline-variant">
            <div className="flex justify-between items-start py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "التاريخ والوقت" : "Date & Time"}</p>
                <p className="font-headline font-bold text-lg">{format(new Date(appt.start_time), "EEEE, MMMM d, yyyy")}</p>
                <p className="text-on-surface-variant text-sm">{format(new Date(appt.start_time), "h:mm a")} — {format(new Date(appt.end_time), "h:mm a")}</p>
              </div>
              <span className="material-symbols-outlined text-outline">calendar_today</span>
            </div>

            {appt.service_name && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "الخدمة" : "Service"}</p>
                  <p className="font-bold">{appt.service_name}</p>
                </div>
                <span className="material-symbols-outlined text-outline">content_cut</span>
              </div>
            )}

            {appt.barber_name && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "الحلاق" : "Barber"}</p>
                  <p className="font-bold">{appt.barber_name}</p>
                </div>
                <span className="material-symbols-outlined text-outline">person</span>
              </div>
            )}

            {appt.shop_address && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "الموقع" : "Location"}</p>
                  <p className="font-bold">{appt.shop_address}</p>
                </div>
                <span className="material-symbols-outlined text-outline">location_on</span>
              </div>
            )}

            {appt.shop_phone && (
              <div className="flex justify-between items-start py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "التواصل" : "Contact"}</p>
                  <a href={`tel:${appt.shop_phone}`} className="font-bold hover:underline">{appt.shop_phone}</a>
                </div>
                <span className="material-symbols-outlined text-outline">call</span>
              </div>
            )}

            <div className="flex justify-between items-center py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline mb-1">{isRTL ? "الإجمالي" : "Total"}</p>
                <p className="font-headline font-black text-2xl">{appt.price} JOD</p>
                <p className="text-xs text-on-surface-variant">{isRTL ? "الدفع في المتجر" : "Payment in-store"}</p>
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
                className="flex-1 text-center py-4 bg-tertiary-fixed text-on-tertiary-fixed rounded-[8px] font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
              >
                {isRTL ? "احجز موعداً جديداً" : "Book a New Time"}
              </Link>
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelling}
                className="flex-1 py-4 bg-surface-container-lowest text-error border border-error/20 rounded-[8px] font-bold text-sm hover:bg-error/5 active:scale-95 transition-all disabled:opacity-50"
              >
                {cancelling ? (isRTL ? "جارٍ الإلغاء..." : "Cancelling...") : (isRTL ? "إلغاء الموعد" : "Cancel Appointment")}
              </button>
            </>
          )}
          {!isUpcoming && (
            <Link
              href={`/book/${appt.shop_id}`}
              className="flex-1 text-center py-4 bg-tertiary-fixed text-on-tertiary-fixed rounded-[8px] font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
            >
              {t.customer.bookAgain}
            </Link>
          )}
        </div>
        {isUpcoming && (
          <p className="text-xs text-on-surface-variant mt-3 text-center sm:text-left">
            {isRTL
              ? "يبقى حجزك الحالي فعالاً — قم بإلغائه أعلاه إذا لم تعد بحاجة إليه."
              : "Your current booking stays active — cancel it above if you don't need it anymore."}
          </p>
        )}

        {/* Shop Link */}
        <div className="mt-6 text-center">
          <Link href={`/shop/${appt.shop_id}`} className="text-sm font-bold text-on-surface-variant underline underline-offset-4 decoration-2 hover:text-on-surface transition-colors">
            {isRTL ? "عرض ملف المتجر" : "View Shop Profile"}
          </Link>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pb-8 pt-4 md:hidden bg-white border-t border-outline-variant rounded-t-2xl">
        <Link className="flex flex-col items-center justify-center text-on-surface-variant" href="/explore">
          <span className="material-symbols-outlined">search</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest mt-1">{t.customer.explore}</span>
        </Link>
        <Link className="flex flex-col items-center justify-center bg-primary text-on-primary rounded-full w-12 h-12 scale-90 active:scale-100 transition-transform" href="/customer">
          <span className="material-symbols-outlined">event_note</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-on-surface-variant" href="/customer">
          <span className="material-symbols-outlined">person</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest mt-1">{isRTL ? "الحساب" : "Account"}</span>
        </Link>
      </nav>

      {/* ── Cancel Confirm Modal ── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCancelConfirm(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-7 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-error">event_busy</span>
              </div>
              <h3 className="font-bold text-lg mb-2">{isRTL ? "إلغاء هذا الموعد؟" : "Cancel this appointment?"}</h3>
              <p className="text-sm text-on-surface-variant mb-6">
                {isRTL ? "لا يمكن التراجع عن هذا. سيتم تحرير الموعد." : "This cannot be undone. The slot will be released."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="h-11 rounded-[8px] bg-surface-container text-on-surface-variant font-bold text-sm"
                >
                  {isRTL ? "الاحتفاظ به" : "Keep It"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="h-11 rounded-[8px] bg-error text-on-error font-bold text-sm disabled:opacity-50"
                >
                  {cancelling ? (isRTL ? "جارٍ الإلغاء…" : "Cancelling…") : (isRTL ? "إلغاء الحجز" : "Cancel Booking")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
