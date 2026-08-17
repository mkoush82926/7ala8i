import { describe, it, expect, vi, afterEach } from "vitest";
import { cn, formatCurrency, formatNumber, getInitials, getGreeting } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formats with two decimal places and a JOD suffix", () => {
    expect(formatCurrency(25)).toBe("25.00 JOD");
  });

  it("formats fractional amounts", () => {
    expect(formatCurrency(1234.5)).toBe("1,234.50 JOD");
  });
});

describe("formatNumber", () => {
  it("returns plain numbers under 1000 unchanged", () => {
    expect(formatNumber(999)).toBe("999");
  });

  it("abbreviates numbers 1000 and above with a 'k' suffix", () => {
    expect(formatNumber(1500)).toBe("1.5k");
  });

  it("handles exactly 1000", () => {
    expect(formatNumber(1000)).toBe("1.0k");
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Ahmad Hassan")).toBe("AH");
  });

  it("uppercases the result", () => {
    expect(getInitials("ahmad hassan")).toBe("AH");
  });

  it("handles a single-word name", () => {
    expect(getInitials("Ahmad")).toBe("A");
  });
});

describe("getGreeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a morning greeting before noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9));
    expect(getGreeting()).toBe("Good morning");
  });

  it("returns an afternoon greeting between 12 and 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 14));
    expect(getGreeting()).toBe("Good afternoon");
  });

  it("returns an evening greeting after 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 20));
    expect(getGreeting()).toBe("Good evening");
  });
});
