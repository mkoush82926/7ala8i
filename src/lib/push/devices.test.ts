import { describe, expect, it } from "vitest";
import { describeUserAgent, isDeviceUnhealthy, sortDevices } from "./devices";

describe("devices", () => {
  it("describes common user agents", () => {
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toEqual({ kind: "android", browser: "Chrome" });
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1")).toEqual({ kind: "iphone", browser: "Safari" });
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 13) SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36").browser).toBe("Samsung Internet");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36 Edg/120").toString()).toBeTruthy();
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36 Edg/120")).toEqual({ kind: "windows", browser: "Edge" });
    expect(describeUserAgent(null)).toEqual({ kind: "other", browser: null });
  });

  it("puts this device first, then by recent activity", () => {
    const rows = [
      { id: "1", endpoint: "a", user_agent: null, locale: "ar", last_success_at: "2026-11-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
      { id: "2", endpoint: "b", user_agent: null, locale: "ar", last_success_at: null, created_at: "2026-11-10T00:00:00Z" },
      { id: "3", endpoint: "c", user_agent: null, locale: "en", last_success_at: null, created_at: "2026-09-01T00:00:00Z" },
    ];
    expect(sortDevices(rows, "c").map((r) => r.id)).toEqual(["3", "2", "1"]);
    expect(sortDevices(rows, null).map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("flags failing devices", () => {
    expect(isDeviceUnhealthy({ failure_count: 3 })).toBe(true);
    expect(isDeviceUnhealthy({ failure_count: null })).toBe(false);
  });
});
