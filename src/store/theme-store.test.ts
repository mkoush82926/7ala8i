import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "./theme-store";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "light", direction: "ltr", locale: "en" });
  });

  it("sets the theme directly", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("toggles the theme between light and dark", () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("setting the locale to ar also switches direction to rtl", () => {
    useThemeStore.getState().setLocale("ar");
    expect(useThemeStore.getState()).toMatchObject({ locale: "ar", direction: "rtl" });
  });

  it("setting the locale to en also switches direction to ltr", () => {
    useThemeStore.setState({ locale: "ar", direction: "rtl" });
    useThemeStore.getState().setLocale("en");
    expect(useThemeStore.getState()).toMatchObject({ locale: "en", direction: "ltr" });
  });

  it("toggleLocale flips both locale and direction together", () => {
    useThemeStore.getState().toggleLocale();
    expect(useThemeStore.getState()).toMatchObject({ locale: "ar", direction: "rtl" });
    useThemeStore.getState().toggleLocale();
    expect(useThemeStore.getState()).toMatchObject({ locale: "en", direction: "ltr" });
  });
});
