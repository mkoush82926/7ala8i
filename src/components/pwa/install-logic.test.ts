import { describe, expect, it } from "vitest";
import { INSTALL_DISMISS_KEY, INSTALL_SNOOZE_MS, installMode, iosCanInstall, readDismissedUntil, snoozeInstall } from "./install-logic";

const base = { standalone: false, platform: "android" as const, hasDeferredPrompt: true, dismissedUntil: null, now: 1_000 };

describe("installMode", () => {
  it("offers the native prompt when the browser captured one", () => {
    expect(installMode(base)).toBe("native");
  });
  it("hides once installed or snoozed", () => {
    expect(installMode({ ...base, standalone: true })).toBeNull();
    expect(installMode({ ...base, dismissedUntil: 2_000 })).toBeNull();
    expect(installMode({ ...base, dismissedUntil: 500 })).toBe("native");
  });
  it("shows iOS steps on iPhone without a native prompt", () => {
    expect(installMode({ ...base, platform: "ios", hasDeferredPrompt: false })).toBe("ios");
    expect(installMode({ ...base, platform: "ios", hasDeferredPrompt: false, userAgent: "Instagram 300" })).toBeNull();
    expect(installMode({ ...base, platform: "desktop", hasDeferredPrompt: false })).toBeNull();
    expect(iosCanInstall("Mozilla/5.0 (iPhone) Safari")).toBe(true);
  });
});

describe("snooze storage", () => {
  it("round-trips and tolerates broken storage", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    const until = snoozeInstall(storage, 10);
    expect(until).toBe(10 + INSTALL_SNOOZE_MS);
    expect(map.get(INSTALL_DISMISS_KEY)).toBe(String(until));
    expect(readDismissedUntil(storage)).toBe(until);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readDismissedUntil(broken)).toBeNull();
    expect(snoozeInstall(broken, 0)).toBe(INSTALL_SNOOZE_MS);
    expect(readDismissedUntil(null)).toBeNull();
  });
});
