import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// ── Cairo: Best Arabic+Latin font for Halaqy ──────────────────────────────
// Used by Careem, Noon, and major Arab-market tech brands.
// Supports Arabic (wght 200–900) and Latin in the same geometric system.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halaqy — The Digital Standard for Barbershops",
  description:
    "Elevate your atelier with booking, analytics, and CRM reimagined for the modern era.",
  keywords: ["barbershop", "management", "CRM", "booking", "reservation", "Jordan"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${cairo.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
