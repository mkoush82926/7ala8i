import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { publicBookingSecurity } from "@/lib/otp/config";
import { PhoneLoginForm } from "./phone-login-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.customerLogin.metaTitle,
    description: t.customerLogin.subtitle,
    robots: { index: false, follow: false },
  };
}

/**
 * /{locale}/customer/login — phone-first sign-in for clients (WS-1J).
 * With NEXT_PUBLIC_OTP_MODE unset ("off") it explains that phone sign-in is
 * not available yet and points to the email login, which keeps working.
 */
export default async function CustomerLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  // Only browser-safe fields (mode, channel, Turnstile site key) reach the client.
  return <PhoneLoginForm security={publicBookingSecurity()} next={next} />;
}
