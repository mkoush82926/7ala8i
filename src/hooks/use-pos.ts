"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";

export type PaymentMethod = "cash" | "card";

interface CheckoutOptions {
  appointmentId: string;
  clientName: string;
  barberName: string;
  serviceLabel: string;
  scheduledTime: string;
  amount: number;
  method: PaymentMethod;
}

export function usePos() {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const markPaid = useCallback(async (opts: CheckoutOptions) => {
    if (!shopId) return;
    setLoadingId(opts.appointmentId);

    const now = new Date();
    const saleTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    try {
      await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        payment_method: opts.method,
        amount_paid: opts.amount,
      } as Record<string, unknown>).eq("id", opts.appointmentId);

      await supabase.from("daily_sales").insert({
        shop_id: shopId,
        appointment_id: opts.appointmentId,
        client_name: opts.clientName,
        service_name: opts.serviceLabel,
        barber_name: opts.barberName || "Barber",
        amount: opts.amount,
        payment_method: opts.method,
        sale_time: saleTime,
      } as Record<string, unknown>);
    } finally {
      setLoadingId(null);
    }
  }, [shopId, supabase]);

  const markNoShow = useCallback(async (appointmentId: string) => {
    if (!shopId) return;
    setLoadingId(appointmentId);
    try {
      await supabase.from("appointments").update({
        status: "no_show",
        no_show: true,
      } as Record<string, unknown>).eq("id", appointmentId);
    } finally {
      setLoadingId(null);
    }
  }, [shopId, supabase]);

  const cancelAppointment = useCallback(async (appointmentId: string) => {
    if (!shopId) return;
    setLoadingId(appointmentId);
    try {
      await supabase.from("appointments").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      } as Record<string, unknown>).eq("id", appointmentId);
    } finally {
      setLoadingId(null);
    }
  }, [shopId, supabase]);

  return { markPaid, markNoShow, cancelAppointment, loadingId };
}

