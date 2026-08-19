import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "../globals.css";

// ── Arabic font: Noto Sans Arabic ──────────────────────────────────────────
// Modern, humanist sans with no serif clash against InterVar — keeps the
// "data observatory" system feeling like one typographic voice across
// both languages instead of pairing in a second personality.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ── English font: Inter (variable) — "InterVar" ────────────────────────────
// Sole typeface across nav, body, buttons, and headings. Google's Inter
// export already loads as a variable font across the full weight range.
const interVar = Inter({
  variable: "--font-intervar",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
        className={`${notoSansArabic.variable} ${interVar.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
