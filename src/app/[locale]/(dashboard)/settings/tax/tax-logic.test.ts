import { describe, expect, it } from "vitest";
import { inclusiveTax, normalizePrefix, normalizeTaxNumber, parseRate, receiptNumberPreview, validateTax, type TaxDraft } from "./tax-logic";

const base: TaxDraft = {
  isTaxRegistered: false,
  taxNumber: "",
  taxRate: "16",
  cashRounding: 0,
  receiptPrefix: "",
  footerEn: "",
  footerAr: "",
};

describe("validateTax", () => {
  it("allows an unregistered shop with no number", () => {
    expect(validateTax(base)).toBeNull();
  });
  it("requires a number and a positive rate when registered", () => {
    expect(validateTax({ ...base, isTaxRegistered: true })).toBe("TAX_NUMBER");
    expect(validateTax({ ...base, isTaxRegistered: true, taxNumber: "١٢٣٤٥٦٧٨" })).toBeNull();
    expect(validateTax({ ...base, isTaxRegistered: true, taxNumber: "12345678", taxRate: "0" })).toBe("TAX_RATE");
  });
  it("checks rounding steps and prefix", () => {
    expect(validateTax({ ...base, cashRounding: 0.3 })).toBe("ROUNDING");
    expect(validateTax({ ...base, cashRounding: 0.25 })).toBeNull();
    expect(validateTax({ ...base, receiptPrefix: "gc" })).toBe("PREFIX");
    expect(validateTax({ ...base, receiptPrefix: "GC1" })).toBeNull();
  });
});

describe("helpers", () => {
  it("normalises inputs", () => {
    expect(normalizeTaxNumber("123 456-78")).toBe("12345678");
    expect(normalizePrefix("gc-1!")).toBe("GC1");
    expect(parseRate("١٦")).toBe(16);
    expect(parseRate("101")).toBeNull();
  });
  it("computes inclusive tax to the fils like the server", () => {
    expect(inclusiveTax(10, 16)).toBe(1.379);
    expect(inclusiveTax(12, 16)).toBe(1.655);
    expect(inclusiveTax(5, 0)).toBe(0);
  });
  it("previews receipt numbers", () => {
    expect(receiptNumberPreview("")).toBe("000001");
    expect(receiptNumberPreview("GC", 42)).toBe("GC-000042");
  });
});
