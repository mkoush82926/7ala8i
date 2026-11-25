"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { useThemeStore } from "@/store/theme-store";
import { ToastContainer } from "@/components/ui/toast";

/**
 * Back-office providers: applies the shared light/dark theme (the business
 * ThemeProvider forces light outside dashboard routes) and mounts the toast
 * outlet.
 */
export function AdminProviders({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const dark = theme === "dark";
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "dark" : "light");
  }, [theme]);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <ToastContainer />
    </MotionConfig>
  );
}
