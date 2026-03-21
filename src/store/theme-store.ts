import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";
type Direction = "ltr" | "rtl";
type Locale = "en" | "ar";

interface ThemeState {
  theme: Theme;
  direction: Direction;
  locale: Locale;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      direction: "ltr",
      locale: "en",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setLocale: (locale) =>
        set({
          locale,
          direction: locale === "ar" ? "rtl" : "ltr",
        }),
      toggleLocale: () =>
        set((state) => ({
          locale: state.locale === "en" ? "ar" : "en",
          direction: state.locale === "en" ? "rtl" : "ltr",
        })),
    }),
    { name: "halaqy-theme-v2" },
  ),
);
