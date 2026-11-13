import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.customer.metaTitle,
    description: t.customer.metaDescription,
    // Private, per-user pages: keep them out of search results.
    robots: { index: false, follow: false },
  };
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[var(--bg-primary)]">{children}</div>;
}
