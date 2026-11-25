import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { isManageToken } from "@/lib/messaging/manage";
import { ManageBookingView } from "./manage-booking";

type Params = Promise<{ locale: string; token: string }>;

/**
 * /[locale]/m/[token] — the magic link from booking messages (WS-1C).
 * Works logged out: everything goes through the rate-limited token RPCs
 * (get_booking_by_token, confirm_by_token, cancel_by_token,
 * reschedule_by_token), which never return phone numbers. The token is a
 * bearer secret, so the page is never indexed and sends no referrer.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.manageBooking.metaTitle,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

export default async function ManageBookingPage({ params }: { params: Params }) {
  const { token } = await params;
  const value = decodeURIComponent(token ?? "");
  return <ManageBookingView token={isManageToken(value) ? value : null} />;
}
