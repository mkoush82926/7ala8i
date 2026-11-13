import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cairo } from "next/font/google";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
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

const SUPPORTED_LOCALES = ["en", "ar"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? "");
}

/** Absolute origin used to resolve OG/canonical URLs. */
function siteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate);
    } catch {
      // try the next candidate
    }
  }
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

// No-flash theme bootstrap. Mirrors `themeInitScript` in
// src/components/theme-provider.tsx (kept inline here because that module is a
// client module, so its string exports are client references on the server).
// Dark mode only ever applies on the app-shell routes; public pages stay light.
const THEME_INIT_SCRIPT = `(function(){try{var p=location.pathname.replace(/^\\/(en|ar)(?=\\/|$)/,"");var f=p.split("/").filter(Boolean)[0]||"";var ok=["","analytics","calendar","clients","leads","my-day","services","settings","team"].indexOf(f)>-1;var s=JSON.parse(localStorage.getItem("halaqy-theme-v2")||"{}");var d=ok&&s&&s.state&&s.state.theme==="dark";var r=document.documentElement;r.classList.toggle("dark",!!d);r.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await props.params;
  const locale: SupportedLocale = rawLocale === "ar" ? "ar" : "en";
  const t = locale === "ar" ? ar : en;
  const title = t.landing.metaTitle;
  const description = t.landing.metaDescription;

  return {
    metadataBase: siteUrl(),
    // Child pages set a short title ("Explore barbershops"); the brand is appended.
    title: { default: title, template: `%s — ${t.sidebar.brand}` },
    description,
    applicationName: t.sidebar.brand,
    keywords: ["barbershop", "barber", "booking", "appointments", "CRM", "Jordan", "Amman", "حلاق", "صالون حلاقة", "حجز موعد"],
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      siteName: t.sidebar.brand,
      title,
      description,
      locale: locale === "ar" ? "ar_JO" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_JO"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [{ color: "#ffffff" }],
};

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!isSupportedLocale(locale)) notFound();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const { children } = props;

  return (
    <html lang={locale} dir={dir} data-lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${cairo.variable} ${bdoGrotesk.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
