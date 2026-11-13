import { describe, expect, it } from "vitest";
import { METHOD_CODE_RE, methodCodeFor, swapSort, validateMethod, validateProduct } from "./payments-logic";
import { parseMoneyInput } from "@/hooks/use-pos";

describe("methodCodeFor", () => {
  it("derives a valid unique code", () => {
    expect(methodCodeFor("Bank transfer", [])).toBe("bank_transfer");
    expect(methodCodeFor("Bank transfer", ["bank_transfer"])).toBe("bank_transfer_2");
    expect(methodCodeFor("كاش", [])).toBe("custom");
    expect(methodCodeFor("Mixed", [])).toBe("custom");
    for (const c of [methodCodeFor("A very long payment method name indeed", []), methodCodeFor("x", ["custom"])]) {
      expect(METHOD_CODE_RE.test(c)).toBe(true);
    }
  });
});

describe("validateMethod", () => {
  const ok = { nameEn: "Zain Cash", nameAr: "زين كاش", kind: "wallet" as const, cliqAlias: "", qrUrl: "" };
  it("requires both names and an https QR url", () => {
    expect(validateMethod(ok)).toBeNull();
    expect(validateMethod({ ...ok, nameAr: " " })).toBe("NAME_AR");
    expect(validateMethod({ ...ok, nameEn: "" })).toBe("NAME_EN");
    expect(validateMethod({ ...ok, qrUrl: "http://x.y/q.png" })).toBe("QR_URL");
    expect(validateMethod({ ...ok, qrUrl: "https://x.y/q.png" })).toBeNull();
  });
});

describe("validateProduct", () => {
  it("validates price with Arabic digits", () => {
    expect(validateProduct({ nameEn: "Beard oil", nameAr: "زيت لحية", price: "٣٫٥", sku: "" }, parseMoneyInput)).toBeNull();
    expect(validateProduct({ nameEn: "Wax", nameAr: "", price: "", sku: "" }, parseMoneyInput)).toBe("PRICE");
    expect(validateProduct({ nameEn: "", nameAr: "", price: "1", sku: "" }, parseMoneyInput)).toBe("NAME_EN");
  });
});

describe("swapSort", () => {
  it("swaps neighbours and handles equal sorts", () => {
    expect(swapSort([{ id: "a", sort: 10 }, { id: "b", sort: 20 }], 0, 1)).toEqual([
      { id: "a", sort: 20 },
      { id: "b", sort: 10 },
    ]);
    expect(swapSort([{ id: "a", sort: 5 }, { id: "b", sort: 5 }], 1, -1)).toEqual([
      { id: "b", sort: 4 },
      { id: "a", sort: 5 },
    ]);
    expect(swapSort([{ id: "a", sort: 5 }], 0, 1)).toEqual([]);
  });
});
