"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { format, startOfDay, endOfDay } from "date-fns";
import { CheckCircle, UserX, XCircle, Loader2, Sun, Users } from "lucide-react";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { usePos } from "@/hooks/use-pos";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface Appt {
  id: string;
  client_name: string;
  start_time: string;
  barber_id: string | null;
  status: string | null;
  price: number;
  payment_status: string | null;
  service_name: string | null;
}

// An appointment that's already paid, completed, no-showed, or cancelled has
// nothing left for the barber to do with it mid-shift.
function isResolved(appt: Appt): boolean {
  return (
    appt.payment_status === "paid" ||
    appt.status === "completed" ||
    appt.status === "no_show" ||
    appt.status === "cancelled"
  );
}

function resolvedLabel(appt: Appt, isRTL: boolean): string {
  if (appt.payment_status === "paid" || appt.status === "completed") {
    return isRTL ? "مدفوع" : "Paid";
  }
  if (appt.status === "no_show") return isRTL ? "لم يحضر" : "No-show";
  if (appt.status === "cancelled") return isRTL ? "ملغى" : "Cancelled";
  return appt.status || "";
}

async function loadTodayAppointments(
  supabase: ReturnType<typeof createClient>,
  shopId: string,
  barberId: string,
): Promise<Appt[]> {
  const today = new Date();
  const start = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const end = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, client_name, start_time, barber_id, status, price, payment_status, service_name",
    )
    .eq("shop_id", shopId)
    .eq("barber_id", barberId)
    .gte("start_time", start)
    .lte("start_time", end)
    .order("start_time", { ascending: true });

  return (data ?? []) as Appt[];
}

export default function MyDayPage() {
  const { isRTL, FF } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const { markPaid, markNoShow, cancelAppointment, loadingId } = usePos();

  const [supabase] = useState(() => createClient());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  // Barber-role users see only their own day — resolve their profile id.
  useEffect(() => {
    if (role !== "barber") return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [role, supabase]);

  // Shop admins default to the first barber on the team — derived at render
  // time rather than synced through an effect, so picking one just overrides
  // the fallback.
  const activeBarberId =
    role === "barber" ? currentUserId : selectedBarberId ?? barbers[0]?.id ?? null;
  const activeBarberName =
    barbers.find((b) => b.id === activeBarberId)?.name || "Barber";

  // Refetch after a POS action (event-handler triggered, not effect-driven).
  const refetch = useCallback(async () => {
    if (!shopId || !activeBarberId) return;
    const data = await loadTodayAppointments(supabase, shopId, activeBarberId);
    setAppointments(data);
  }, [supabase, shopId, activeBarberId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!shopId || !activeBarberId) return;
      const data = await loadTodayAppointments(supabase, shopId, activeBarberId);
      if (!cancelled) {
        setAppointments(data);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [supabase, shopId, activeBarberId]);

  async function handleMarkPaid(appt: Appt) {
    await markPaid({
      appointmentId: appt.id,
      clientName: appt.client_name,
      barberName: activeBarberName,
      serviceLabel: appt.service_name || (isRTL ? "موعد" : "Appointment"),
      scheduledTime: format(new Date(appt.start_time), "HH:mm"),
      amount: appt.price,
      method: "cash",
    });
    toast("success", isRTL ? "تم تسجيل الدفع" : "Marked as paid");
    refetch();
  }

  async function handleNoShow(appt: Appt) {
    await markNoShow(appt.id);
    toast("success", isRTL ? "تم التسجيل كغياب" : "Marked as no-show");
    refetch();
  }

  async function handleCancel(appt: Appt) {
    await cancelAppointment(appt.id);
    toast("success", isRTL ? "تم إلغاء الموعد" : "Appointment cancelled");
    refetch();
  }

  const showBarberPicker = role !== "barber";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Header */}
      <div>
        <h2
          style={{
            fontFamily: FF,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: headingTracking(isRTL, "0.014em"),
            color: "#1c1611",
            margin: 0,
          }}
        >
          {isRTL ? "يومي" : "My Day"}
        </h2>
        <p style={{ fontSize: 14, color: "#5a5147", marginTop: 6, fontWeight: 400 }}>
          {format(new Date(), "EEEE, d MMMM yyyy")}
        </p>
      </div>

      {/* Barber picker — admins pick whose day to view, minimal tap chips */}
      {showBarberPicker && barbers.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {barbers.map((b) => {
            const active = b.id === activeBarberId;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBarberId(b.id)}
                style={{
                  flexShrink: 0,
                  padding: "10px 18px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  border: active ? "1px solid #1c1611" : "1px solid #ede3cd",
                  background: active ? "#1c1611" : "#ffffff",
                  color: active ? "#ffffff" : "#5a5147",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      {showBarberPicker && barbers.length === 0 ? (
        <EmptyState
          icon={<Users size={26} style={{ color: "#a89e8c" }} />}
          title={isRTL ? "لا يوجد حلاقون بعد" : "No barbers on your team yet"}
          subtitle={
            isRTL
              ? "أضف حلاقًا من صفحة الفريق لعرض جدول يومه"
              : "Add a barber from the Team page to view their day"
          }
        />
      ) : role === "barber" && !currentUserId ? (
        <LoadingState />
      ) : loading ? (
        <LoadingState />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Sun size={26} style={{ color: "#a89e8c" }} />}
          title={isRTL ? "لا مواعيد اليوم" : "No appointments today"}
          subtitle={isRTL ? "استمتع بيوم هادئ" : "Enjoy the quiet day"}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {appointments.map((appt) => {
            const resolved = isResolved(appt);
            const busy = loadingId === appt.id;
            return (
              <div
                key={appt.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #ede3cd",
                  borderRadius: 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Client + time/price */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "#1c1611", margin: 0, fontFamily: "var(--font-intervar), sans-serif" }}>
                      {appt.client_name}
                    </p>
                    <p style={{ fontSize: 14, color: "#5a5147", margin: "4px 0 0" }}>
                      {appt.service_name || (isRTL ? "موعد" : "Appointment")}
                    </p>
                  </div>
                  <div style={{ textAlign: "end", flexShrink: 0 }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#1c1611", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {format(new Date(appt.start_time), "HH:mm")}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#5a5147", margin: "4px 0 0" }}>
                      {formatCurrency(appt.price)}
                    </p>
                  </div>
                </div>

                {/* Actions or resolved badge */}
                {resolved ? (
                  <span
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "#f7f1e4",
                      color: "#a67c3d",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: headingTracking(isRTL, "0.1em"),
                    }}
                  >
                    {resolvedLabel(appt, isRTL)}
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      disabled={busy}
                      onClick={() => handleMarkPaid(appt)}
                      style={{
                        flex: 1,
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        border: "none",
                        borderRadius: 12,
                        background: "#a67c3d",
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: busy ? "default" : "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                      {isRTL ? "دفع" : "Mark Paid"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleNoShow(appt)}
                      title={isRTL ? "لم يحضر" : "No-show"}
                      style={{
                        minHeight: 52,
                        minWidth: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #ede3cd",
                        borderRadius: 12,
                        background: "#ffffff",
                        color: "#5a5147",
                        cursor: busy ? "default" : "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <UserX size={20} />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleCancel(appt)}
                      title={isRTL ? "إلغاء" : "Cancel"}
                      style={{
                        minHeight: 52,
                        minWidth: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(186,26,26,0.3)",
                        borderRadius: 12,
                        background: "rgba(186,26,26,0.06)",
                        color: "#ba1a1a",
                        cursor: busy ? "default" : "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
      <Loader2 className="animate-spin" size={26} style={{ color: "#5a5147" }} />
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "56px 24px",
        background: "#ffffff",
        border: "1px solid #ede3cd",
        borderRadius: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "#f7f1e4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#5a5147", margin: "0 0 6px" }}>{title}</p>
        <p style={{ fontSize: 12, color: "#5a5147", margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}
