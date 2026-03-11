import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lumina — Barbershop Management Platform",
  description:
    "Ultra-minimalist, glassmorphism-inspired barbershop management, CRM, and reservation system.",
  keywords: ["barbershop", "management", "CRM", "booking", "reservation"],
  alternates: {
    languages: {
      "ar-JO": "/ar",
      "en-US": "/en",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${cairo.variable} antialiased font-sans`}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
