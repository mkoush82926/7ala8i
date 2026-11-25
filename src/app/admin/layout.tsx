import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { AdminProviders } from "./_components/admin-providers";
import "../globals.css";

// Root layout for the platform back office. It is a separate root from
// [locale]/layout.tsx: /admin is internal, English-only and never localised.
// Authorisation happens in (console)/layout.tsx, which 404s non-platform users.

const bdoGrotesk = localFont({
  variable: "--font-bdo-grotesk",
  display: "swap",
  src: [
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-DemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../fonts/bdo-grotesk/BDOGrotesk-Bold.woff2", weight: "700", style: "normal" },
  ],
});

// Applies the persisted dashboard theme before first paint (same storage key
// as the business dashboard, so an agent's dark-mode choice carries over).
const THEME_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("halaqy-theme-v2")||"{}");var d=s&&s.state&&s.state.theme==="dark";var r=document.documentElement;r.classList.toggle("dark",!!d);r.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export const metadata: Metadata = {
  title: { default: ADMIN_COPY.meta.title, template: `%s · ${ADMIN_COPY.meta.title}` },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-lang="en" className={bdoGrotesk.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased bg-card text-ink">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
