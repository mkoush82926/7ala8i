"use client";

import { Suspense } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { BookingEngine } from "@/components/booking/booking-engine";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";

/** Page chrome for /[locale]/book/[shop_id]: one header, one exit, the engine. */
export function BookingShell({ shopId, shopName }: { shopId: string; shopName: string | null }) {
  const { t, FF, dir, href } = useTranslation();
  const shopHref = href(`/shop/${shopId}`);

  return (
    <div
      dir={dir}
      style={{ minHeight: "100dvh", background: "var(--bg-secondary)", color: "var(--text-primary)", fontFamily: FF }}
    >
      <a href="#booking-main" className="skip-link">{t.booking.skipToBooking}</a>

      <header
        style={{
          position: "sticky", top: 0, zIndex: 50, height: 60,
          background: "var(--bg-primary)", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center",
        }}
      >
        <div
          style={{
            maxWidth: 760, width: "100%", margin: "0 auto", padding: "0 16px",
            display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 44px", alignItems: "center", gap: 8,
          }}
        >
          {/* Symmetry spacer: the in-flow step header owns "back"; this bar only exits. */}
          <span aria-hidden="true" />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, textAlign: "center" }}>
            <span
              style={{
                fontWeight: 900, fontSize: 16, maxWidth: "100%",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {shopName || t.booking.bookAppointment}
            </span>
            {shopName && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                {t.booking.bookAppointment}
              </span>
            )}
          </div>

          <Link
            href={shopHref}
            aria-label={t.booking.exitBooking}
            className="focus-ring"
            style={{
              width: 44, height: 44, borderRadius: 10, display: "inline-flex", alignItems: "center",
              justifyContent: "center", color: "var(--text-secondary)",
            }}
          >
            <X size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="booking-main" style={{ paddingTop: 20, paddingBottom: 32 }}>
        <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", padding: "0 16px" }}>
          {/* BookingEngine reads ?service= and ?reschedule= via useSearchParams. */}
          <Suspense
            fallback={
              <div role="status" aria-busy="true" aria-label={t.common.loading}>
                <Skeleton variant="text" style={{ height: 14, width: 120, marginBottom: 12 }} />
                <Skeleton variant="text" style={{ height: 32, width: "60%", marginBottom: 24 }} />
                <Skeleton variant="card" style={{ height: 240, width: "100%" }} />
              </div>
            }
          >
            <BookingEngine shopId={shopId} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
