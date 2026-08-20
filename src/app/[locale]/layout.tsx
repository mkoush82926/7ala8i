import type { Metadata } from "next";
import { Inter, Fraunces, Noto_Sans_Arabic, Noto_Naskh_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "../globals.css";

// ── Arabic body font: Noto Sans Arabic ─────────────────────────────────────
// Clean, humanist sans for body copy, labels and UI chrome — optimized for
// legibility at small sizes, not for display presence.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ── Arabic display font: Noto Naskh Arabic ─────────────────────────────────
// A real Naskh with genuine calligraphic character (varying stroke weight,
// proper cursive joins) for headlines — the Arabic-script counterpart to
// Fraunces below, so both scripts carry the same "crafted, not generic SaaS"
// presence instead of Arabic getting the plain-sans leftovers.
const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-naskh-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ── English body font: Inter (variable) — "InterVar" ───────────────────────
// UI chrome, body copy, buttons, labels.
const interVar = Inter({
  variable: "--font-intervar",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ── English display font: Fraunces ─────────────────────────────────────────
// A characterful serif with ink-trap detailing for headlines — the "Ink &
// Brass" identity's answer to the old all-Inter, deliberately-personality-
// free system. Used for H1/H2 display type only, never body/UI text.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
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
        className={`${notoSansArabic.variable} ${notoNaskhArabic.variable} ${interVar.variable} ${fraunces.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
