import { describe, it, expect } from "vitest";
import { needsManualSend } from "./dashboard";

const NOW = Date.parse("2026-11-25T10:00:00Z");
const row = (status: string, scheduled_for: string | null = "2026-11-25T09:00:00Z", to_phone: string | null = "962791234567") =>
  ({ status, scheduled_for, to_phone }) as Parameters<typeof needsManualSend>[0];

describe("needsManualSend", () => {
  it("fallback and failed rows with a phone", () => {
    expect(needsManualSend(row("fallback"))).toBe(true);
    expect(needsManualSend(row("failed"))).toBe(true);
    expect(needsManualSend(row("fallback", null, null))).toBe(false);
  });
  it("due queued rows only when no provider is live", () => {
    expect(needsManualSend(row("queued"), { live: false, now: NOW })).toBe(true);
    expect(needsManualSend(row("queued", "2026-11-25T11:00:00Z"), { live: false, now: NOW })).toBe(false);
    expect(needsManualSend(row("queued"), { live: true, now: NOW })).toBe(false);
    expect(needsManualSend(row("queued"), { now: NOW })).toBe(false);
    expect(needsManualSend(row("sent"), { live: false, now: NOW })).toBe(false);
  });
});
