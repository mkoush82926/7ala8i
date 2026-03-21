"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, direction } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("dir", direction);
  }, [theme, direction, mounted]);

  if (!mounted) {
    // Avoid hydration mismatch by rendering bare children initially
    // or you could return null if you prefer to hide until mounted.
    return <>{children}</>;
  }

  return <>{children}</>;
}
