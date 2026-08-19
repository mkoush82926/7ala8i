"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";
import { useTranslation } from "@/hooks/use-translation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  const { locale, dir } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Detect client-side mount so hydration-sensitive persisted state (theme)
    // isn't rendered before it's safe to read — there is no non-effect way to
    // know we're past hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;

    // ── Theme ─────────────────────────────────────────
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }

    // ── Direction & Language ──────────────────────────
    root.setAttribute("dir", dir);
    root.setAttribute("lang", locale);

    // ── Font switching via data attribute ─────────────
    // CSS uses [lang="ar"] to switch to Tajawal, LTR gets Plus Jakarta Sans
    root.setAttribute("data-lang", locale);
  }, [theme, dir, locale, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
