import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

/** localStorage key used by the persist middleware (and the no-flash init script). */
export const THEME_STORAGE_KEY = "halaqy-theme-v2";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme: theme === "dark" ? "dark" : "light" }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);
