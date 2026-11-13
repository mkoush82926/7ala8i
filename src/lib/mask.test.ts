import { describe, it, expect } from "vitest";
import { maskPhone } from "./mask";

// Same cases as the SQL twin public.mask_phone() (checked in e2e/db/marketplace-spine.rls.sql).
describe("maskPhone", () => {
  it("masks Jordanian international numbers", () => {
    expect(maskPhone("+962791112222")).toBe("+962 7•••••222");
    expect(maskPhone("+962 79 111 2222")).toBe("+962 7•••••222");
    expect(maskPhone("00962791112222")).toBe("+962 7•••••222");
  });

  it("masks local numbers", () => {
    expect(maskPhone("0791112222")).toBe("0••••••222");
  });

  it("accepts Arabic-Indic digits", () => {
    expect(maskPhone("٠٧٩١١١٢٢٢٢")).toBe("0••••••222");
  });

  it("never leaks short inputs", () => {
    expect(maskPhone("123")).toBe("•••");
    expect(maskPhone("12345")).toBe("•••");
  });

  it("returns null for empty input", () => {
    expect(maskPhone("")).toBeNull();
    expect(maskPhone("  ")).toBeNull();
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });

  it("never exposes more than the last three digits", () => {
    const masked = maskPhone("+962781234567") ?? "";
    expect(masked.replace(/\D/g, "")).toBe("9627567");
  });
});
