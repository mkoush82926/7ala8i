"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { useThemeStore, THEME_STORAGE_KEY } from "@/store/theme-store";
import { useTranslation } from "@/hooks/use-translation";
import { ToastContainer } from "@/components/ui/toast";

/**
 * Route segments (first segment after the locale) that belong to the
 * authenticated app shell — the only surfaces with a theme toggle and the
 * only ones whose styles are fully token-driven. Public pages (landing,
 * explore, shop, booking, auth, customer portal, legal) are designed for the
 * light "Ink & Brass" palette and always render light.
 */
export const THEMED_SEGMENTS = [
  "", // dashboard overview at /{locale}
  "analytics",
  "calendar",
  "clients",
  "leads",
  "my-day",
  "services",
  "settings",
  "team",
] as const;

/** True when `pathname` (with or without a locale prefix) is an app-shell route. */
export function isThemedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const withoutLocale = pathname.replace(/^\/(en|ar)(?=\/|$)/, "");
  const first = withoutLocale.split("/").filter(Boolean)[0] ?? "";
  return (THEMED_SEGMENTS as readonly string[]).includes(first);
}

/**
 * Inline, render-blocking script for <head> in [locale]/layout.tsx that
 * applies the persisted theme before first paint (prevents a light flash on
 * dark app routes). Usage:
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 */
export const themeInitScript = `(function(){try{var p=location.pathname.replace(/^\\/(en|ar)(?=\\/|$)/,"");var f=p.split("/").filter(Boolean)[0]||"";var ok=${JSON.stringify(
  THEMED_SEGMENTS,
)}.indexOf(f)>-1;var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"{}");var d=ok&&s&&s.state&&s.state.theme==="dark";var r=document.documentElement;r.classList.toggle("dark",!!d);r.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const { locale, dir } = useTranslation();
  const pathname = usePathname();
  const themed = isThemedPath(pathname);

  useEffect(() => {
    const root = document.documentElement;
    const effective = themed && theme === "dark" ? "dark" : "light";

    // ── Theme ─────────────────────────────────────────
    root.classList.toggle("dark", effective === "dark");
    root.setAttribute("data-theme", effective);

    // ── Direction & Language ──────────────────────────
    root.setAttribute("dir", dir);
    root.setAttribute("lang", locale);
    // CSS uses [lang="ar"] / [dir="rtl"] to switch to Cairo
    root.setAttribute("data-lang", locale);
  }, [theme, themed, dir, locale]);

  return (
    // Honour the OS "reduce motion" setting for every framer-motion
    // animation in the app (CSS animations are handled in globals.css).
    <MotionConfig reducedMotion="user">
      {children}
      {/* App-wide toast outlet. Safe alongside other <ToastContainer/>s:
          only one instance renders at a time. */}
      <ToastContainer />
    </MotionConfig>
  );
}
