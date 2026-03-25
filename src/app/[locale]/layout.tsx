import type { Metadata } from "next";
import { Tajawal, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "../globals.css";

// ── Arabic font: Tajawal ──────────────────────────────────────────────────
// Clean, modern, light — the premium choice for Arab-market apps.
// Designed for readability at all weights. Used extensively in KSA/Jordan tech.
const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  display: "swap",
});

// ── English font: Plus Jakarta Sans ──────────────────────────────────────
// The closest free equivalent to Styrene (used by Claude/Anthropic).
// Geometric, clean, slightly distinctive letterforms — very premium feel.
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halaqy — The Digital Standard for Barbershops",
  description:
    "Elevate your atelier with booking, analytics, and CRM reimagined for the modern era.",
  keywords: ["barbershop", "management", "CRM", "booking", "reservation", "Jordan", "حلاقة", "مواعيد"],
};

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const locale = params?.locale || "en";
  const dir = locale === "ar" ? "rtl" : "ltr";
  const { children } = props;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${tajawal.variable} ${plusJakarta.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
