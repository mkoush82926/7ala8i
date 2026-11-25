"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { BookingEngine } from "@/components/booking/booking-engine";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonClasses } from "@/components/ui/recipes";
import { useTranslation } from "@/hooks/use-translation";
import type { PublicBookingSecurity } from "@/lib/otp/config";

/**
 * Focus chrome for /[locale]/book/[shop_id] (§6.5): no marketplace nav, one
 * sticky header (shop name centred, one exit at the inline-end) and the
 * engine. The in-flow step header owns "back"; the engine lays out its own
 * summary aside once the flow is wide enough.
 */
export function BookingShell({
  shopId, shopName, security,
}: { shopId: string; shopName: string | null; security?: PublicBookingSecurity }) {
  const { t, FF, dir, href, isRTL } = useTranslation();
  const router = useRouter();
  const shopHref = href(`/shop/${shopId}`);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div dir={dir} className="min-h-dvh bg-page text-ink" style={{ fontFamily: FF }}>
      <a href="#booking-main" className="skip-link">{t.booking.skipToBooking}</a>

      <header className="sticky top-0 z-50 h-16 border-b border-line bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 px-4 sm:px-6">
          {/* Back (start) returns to where the visitor came from; close (end) exits to the shop. */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) router.back();
              else router.push(shopHref);
            }}
            aria-label={t.common.back}
            className={buttonClasses({ variant: "ghost", size: "icon" })}
          >
            <BackIcon aria-hidden="true" />
          </button>

          <div className="flex min-w-0 flex-col items-center text-center">
            <span dir="auto" className="max-w-full truncate text-[15px] font-semibold text-ink">
              {shopName || t.booking.bookAppointment}
            </span>
            {shopName && <span className="text-meta text-ink-muted">{t.booking.bookAppointment}</span>}
          </div>

          <Link
            href={shopHref}
            aria-label={t.booking.exitBooking}
            className={buttonClasses({ variant: "ghost", size: "icon" })}
          >
            <X aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="booking-main" className="pb-10 pt-6 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          {/* BookingEngine reads ?service(s)= ?staff= ?src= ?entry= ?reschedule= via useSearchParams. */}
          <Suspense
            fallback={
              <div role="status" aria-busy="true" aria-label={t.common.loading} className="mx-auto max-w-3xl">
                <Skeleton className="mb-6 h-1 w-full rounded-full" />
                <Skeleton className="mb-3 h-3.5 w-32" />
                <Skeleton className="mb-6 h-8 w-3/5" />
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} variant="card" className="h-[76px] w-full rounded-xl" />
                  ))}
                </div>
              </div>
            }
          >
            <BookingEngine shopId={shopId} security={security} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
