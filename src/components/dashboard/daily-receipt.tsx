"use client";

import React from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { FileText, CreditCard, Banknote, Loader2, Download } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getTodayAppointments } from "@/lib/queries/appointments";

interface Sale {
  id: string;
  clientName: string;
  service: string;
  amount: number;
  time: string;
  paymentMethod: "cash" | "card";
}

export function DailyReceipt() {
  const t = useTranslation();
  const { shopId } = useWorkspaceStore();
  const supabase = createClient();

  const { data: rawAppts, loading } = useSupabaseQuery(
    () => getTodayAppointments(supabase, shopId),
    [shopId],
    { enabled: !!shopId },
  );

  const sales: Sale[] = ((rawAppts as Record<string, unknown>[]) ?? [])
    .filter((a) => (a.status as string) === "completed")
    .map((a) => ({
      id: a.id as string,
      clientName: a.client_name as string,
      service: "Appointment",
      amount: Number(a.price),
      time: new Date(a.start_time as string).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false,
      }),
      paymentMethod: "cash" as const,
    }));

  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const cashSales  = sales.filter((s) => s.paymentMethod === "cash");
  const cardSales  = sales.filter((s) => s.paymentMethod === "card");
  const cashTotal  = cashSales.reduce((sum, s) => sum + s.amount, 0);
  const cardTotal  = cardSales.reduce((sum, s) => sum + s.amount, 0);

  if (loading) {
    return (
      <div style={{
        background: "#ffffff",
        border: "1px solid #eceef0",
        borderRadius: 20,
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <Loader2 size={24} style={{ color: "#b0b3b8" }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      background: "#191c1e",   /* dark premium card */
      border: "none",
      borderRadius: 20,
      padding: "32px 32px 28px",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle background pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "radial-gradient(circle at 100% 0%, #fff 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ marginBottom: 28, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 6px" }}>
              Today
            </p>
            <h3 style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              margin: 0,
            }}>
              {t.dashboard.dailySummary || "Daily Summary"}
            </h3>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
          </div>
        </div>
      </div>

      {/* Payment method rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, position: "relative" }}>

        {/* Cash row */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Banknote size={18} style={{ color: "rgba(255,255,255,0.85)" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", margin: "0 0 2px" }}>
                {t.dashboard.cash || "Cash"}
              </p>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                {cashSales.length} transactions
              </p>
            </div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", fontFamily: "Manrope, sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(cashTotal)}
          </span>
        </motion.div>

        {/* Card row */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18 }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CreditCard size={18} style={{ color: "rgba(255,255,255,0.85)" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", margin: "0 0 2px" }}>
                {t.dashboard.card || "Card"}
              </p>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                {cardSales.length} transactions
              </p>
            </div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", fontFamily: "Manrope, sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(cardTotal)}
          </span>
        </motion.div>

        {/* Empty state */}
        {sales.length === 0 && (
          <p style={{
            fontSize: 11, color: "rgba(255,255,255,0.3)",
            textAlign: "center", padding: "8px 0", margin: 0,
          }}>
            No completed sales yet today
          </p>
        )}

        {/* Transaction list */}
        {sales.length > 0 && (
          <div style={{ marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
            {sales.map((sale, index) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: index < sales.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "0 0 2px" }}>{sale.clientName}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: 0 }}>{sale.time}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                  {sale.amount.toFixed(2)} JOD
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — Total Volume */}
      <div style={{
        marginTop: 20,
        paddingTop: 20,
        borderTop: "1px solid rgba(255,255,255,0.1)",
        position: "relative",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 4px" }}>
              Total Volume
            </p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: 0 }}>VAT Included (16%)</p>
          </div>
          <span style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 28,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}>
            {formatCurrency(totalSales)}
          </span>
        </div>

        {/* Export buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn" style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.8)",
            padding: "0 16px", minHeight: 44, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            <Download size={14} />
            PDF
          </button>
          <button className="btn" style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.8)",
            padding: "0 16px", minHeight: 44, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>
    </div>
  );
}
