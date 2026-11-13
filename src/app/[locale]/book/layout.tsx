import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.booking.bookAppointment,
    description: t.booking.metaDescription,
    openGraph: {
      title: t.booking.bookAppointment,
      description: t.booking.metaDescription,
      type: "website",
      locale: locale === "ar" ? "ar_JO" : "en_US",
    },
  };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
