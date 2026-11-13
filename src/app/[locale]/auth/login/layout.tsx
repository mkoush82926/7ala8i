import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.auth.signInBtn,
    description: t.landing.metaDescription,
    robots: { index: false, follow: true },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
