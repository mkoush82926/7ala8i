"use client";

import React, { useEffect, useState } from "react";
import { BookingEngine } from "@/components/booking/booking-engine";
import { useThemeStore } from "@/store/theme-store";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FF = "'Inter','Manrope',system-ui,-apple-system,sans-serif";

export default function BookingShopPage() {
  const params = useParams();
  const shopId = params.shop_id as string;
  const isRTL  = useThemeStore((s) => s.direction) === "rtl";
  const supabase = createClient();
  const router   = useRouter();
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    if (!shopId) return;
    supabase.from("shops").select("name").eq("id", shopId).single()
      .then(({ data }) => setShopName(data?.name || "Halaqy"));
  }, [shopId, supabase]);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: FF, color: "#111827" }}>

      {/* ── Fixed minimal header ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #e5e7eb",
        height: 60,
        display: "flex", alignItems: "center",
      }}>
        <div style={{
          maxWidth: 760, width: "100%", margin: "0 auto",
          padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button
            onClick={() => router.back()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, color: "#374151", fontFamily: FF,
              padding: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {isRTL ? "arrow_forward" : "arrow_back"}
            </span>
            {isRTL ? "رجوع" : "Back"}
          </button>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>
              {shopName || "Halaqy"}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>
              Book Appointment
            </span>
          </div>

          {/* symmetry spacer */}
          <div style={{ width: 64 }} />
        </div>
      </header>

      {/* ── Page body ── */}
      <main style={{ paddingTop: 80, paddingBottom: 64, minHeight: "100vh" }}>
        {/* Centered container — inline styles only, no Tailwind */}
        <div style={{
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          padding: "0 24px",
        }}>
          <BookingEngine shopId={shopId} />
        </div>
      </main>
    </div>
  );
}
