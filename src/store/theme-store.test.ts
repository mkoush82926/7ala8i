import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "./theme-store";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "light" });
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
});
