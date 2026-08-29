import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import "../globals.css";

// ── Arabic font (body + display): Cairo ────────────────────────────────────
// One versatile geometric sans used for both body copy and headlines — reads
// cleanly at small UI sizes and carries enough weight range (400-900) for
// display use, replacing the previous Noto Sans/Naskh Arabic pairing.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

// ── English font (body + display): BDO Grotesk ─────────────────────────────
// A contemporary neo-grotesque (Lokal Container Tipografi, SIL OFL 1.1) used
// for both body copy and headlines, replacing the previous Inter/Fraunces
// pairing — one consistent grotesque sans across weights 300-900.
const bdoGrotesk = localFont({
  variable: "--font-bdo-grotesk",
  display: "swap",
  src: [
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Light.woff2", weight: "300", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-DemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Black.woff2", weight: "900", style: "normal" },
  ],
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
        className={`${cairo.variable} ${bdoGrotesk.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
