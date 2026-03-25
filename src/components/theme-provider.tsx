"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, direction, locale } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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
    root.setAttribute("dir", direction);
    root.setAttribute("lang", locale);

    // ── Font switching via data attribute ─────────────
    // CSS uses [lang="ar"] to switch to Tajawal, LTR gets Plus Jakarta Sans
    root.setAttribute("data-lang", locale);
  }, [theme, direction, locale, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
