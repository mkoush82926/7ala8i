import { describe, expect, it } from "vitest";
import {
  buildReceiptText,
  cartItemsFromLines,
  computeCartTotals,
  discountFils,
  getStagedCart,
  clearStagedCart,
  parseSaleReceipt,
  parseMoneyInput,
  resolvePaymentDrafts,
  stageCheckoutCart,
  toCheckoutPayload,
  validateCart,
  type Cart,
  type CartSettings,
  type ReceiptLabels,
} from "./use-pos";

const TAXED: CartSettings = { isTaxRegistered: true, taxRate: 16, cashRounding: 0.25, cashMethodCodes: ["cash"] };
const UNTAXED: CartSettings = { isTaxRegistered: false, taxRate: 16, cashRounding: 0, cashMethodCodes: ["cash"] };

function cart(partial: Partial<Cart>): Cart {
  return { saleId: "s1", items: [], tips: [], payments: [], ...partial };
}

describe("discountFils", () => {
  it("handles amount and percent, capped at the base", () => {
    expect(discountFils(10000, { type: "amount", value: 2.5 })).toBe(2500);
    expect(discountFils(10000, { type: "amount", value: 20 })).toBe(10000);
    expect(discountFils(6666, { type: "percent", value: 10 })).toBe(667);
    expect(discountFils(6666, { type: "percent", value: 150 })).toBe(6666);
    expect(discountFils(6666, null)).toBe(0);
  });
});

describe("computeCartTotals", () => {
  // Same cart the SQL validation ran through public.checkout_sale; the server
  // returned subtotal 21.166, discount 1.778, tax 2.674, tip 1, total 20.388.
  const sqlCart = cart({
    items: [
      { key: "a", kind: "service", name: "Haircut", quantity: 1, unitPrice: 12 },
      { key: "b", kind: "custom", name: "Beard oil", quantity: 2, unitPrice: 3.333, discount: { type: "percent", value: 10 } },
      { key: "c", kind: "custom", name: "Wax", quantity: 1, unitPrice: 2.5 },
    ],
    cartDiscount: { type: "amount", value: 1.111 },
    tips: [{ key: "t", barberId: "b1", amount: 1 }],
    payments: [
      { key: "p1", methodCode: "cash", amount: 10 },
      { key: "p2", methodCode: "cliq", amount: 10.388 },
    ],
  });

  it("matches the server to the fils", () => {
    const r = computeCartTotals(sqlCart, TAXED);
    expect(r.subtotal).toBe(21.166);
    expect(r.discountTotal).toBe(1.778);
    expect(r.taxTotal).toBe(2.674);
    expect(r.tipTotal).toBe(1);
    expect(r.total).toBe(20.388);
    expect(r.balance).toBe(0);
    expect(r.lines.map((l) => l.cartShare)).toEqual([0.651, 0.325, 0.135]);
    expect(r.lines.map((l) => l.taxAmount)).toEqual([1.565, 0.783, 0.326]);
  });

  it("lines reconcile with the totals", () => {
    const r = computeCartTotals(sqlCart, TAXED);
    const sumLines = r.lines.reduce((a, l) => a + Math.round(l.lineTotal * 1000), 0) / 1000;
    const sumTax = r.lines.reduce((a, l) => a + Math.round(l.taxAmount * 1000), 0) / 1000;
    expect(sumLines).toBe(+(r.total - r.tipTotal).toFixed(3));
    expect(sumTax).toBe(r.taxTotal);
    expect(+(r.subtotal - r.discountTotal).toFixed(3)).toBe(sumLines);
  });

  it("has no tax when the shop is not registered", () => {
    expect(computeCartTotals(sqlCart, UNTAXED).taxTotal).toBe(0);
  });

  it("applies cash rounding only when every tender is cash", () => {
    const base = cart({
      items: [{ key: "a", kind: "custom", name: "x", quantity: 1, unitPrice: 5.1 }],
      applyCashRounding: true,
      payments: [{ key: "p", methodCode: "cash", amount: 5 }],
    });
    const r = computeCartTotals(base, TAXED);
    expect(r.roundingAdjustment).toBe(-0.1);
    expect(r.total).toBe(5);
    const card = computeCartTotals({ ...base, payments: [{ key: "p", methodCode: "card", amount: 5.1 }] }, TAXED);
    expect(card.roundingAdjustment).toBe(0);
    expect(card.total).toBe(5.1);
  });

  it("allocates a 100% cart discount fully", () => {
    const r = computeCartTotals(
      cart({
        items: [
          { key: "a", kind: "custom", name: "x", quantity: 1, unitPrice: 3.333 },
          { key: "b", kind: "custom", name: "y", quantity: 3, unitPrice: 1.111 },
        ],
        cartDiscount: { type: "percent", value: 100 },
      }),
      TAXED,
    );
    expect(r.total).toBe(0);
    expect(r.taxTotal).toBe(0);
    expect(r.lines.every((l) => l.lineTotal === 0)).toBe(true);
  });
});

describe("validateCart", () => {
  const items = [{ key: "a", kind: "custom" as const, name: "x", quantity: 1, unitPrice: 5 }];
  it("requires payments to sum exactly to the total", () => {
    const c = cart({ items, payments: [{ key: "p", methodCode: "cash", amount: 4 }] });
    expect(validateCart(c, computeCartTotals(c, UNTAXED))).toBe("PAYMENT_MISMATCH");
    const over = cart({ items, payments: [{ key: "p", methodCode: "cash", amount: 6 }] });
    expect(validateCart(over, computeCartTotals(over, UNTAXED))).toBe("PAYMENT_EXCEEDS_TOTAL");
    const ok = cart({ items, payments: [{ key: "p", methodCode: "cash", amount: 2 }, { key: "q", methodCode: "card", amount: 3 }] });
    expect(validateCart(ok, computeCartTotals(ok, UNTAXED))).toBeNull();
    const partial = cart({ items, allowPartial: true, payments: [{ key: "p", methodCode: "cash", amount: 2 }] });
    expect(validateCart(partial, computeCartTotals(partial, UNTAXED))).toBeNull();
    expect(validateCart(cart({}), computeCartTotals(cart({}), UNTAXED))).toBe("EMPTY");
  });
});

describe("payload and lines", () => {
  it("builds the checkout_sale payload", () => {
    const p = toCheckoutPayload(
      cart({
        appointmentId: "ap1",
        items: [{ key: "a", kind: "service", serviceId: "sv", name: " Fade ", quantity: 1, unitPrice: 7.1234 }],
        tips: [{ key: "t", barberId: "b", amount: 0 }],
        payments: [{ key: "p", methodCode: "cash", amount: 7.123 }],
      }),
    );
    expect(p).toMatchObject({
      sale_id: "s1",
      appointment_id: "ap1",
      items: [{ kind: "service", service_id: "sv", name: "Fade", quantity: 1, unit_price: 7.123, discount: null }],
      tips: [],
      payments: [{ method_code: "cash", amount: 7.123 }],
      cart_discount: null,
    });
  });

  it("maps appointment_cart_lines rows", () => {
    const items = cartItemsFromLines([{ kind: "service", service_id: "s", barber_id: "b", name: "Cut", unit_price: "12.000", quantity: 1 }]);
    expect(items[0]).toMatchObject({ kind: "service", serviceId: "s", barberId: "b", name: "Cut", unitPrice: 12, quantity: 1 });
    expect(cartItemsFromLines(null)).toEqual([]);
  });

  it("stages carts per appointment", () => {
    stageCheckoutCart("ap1", cart({}));
    expect(getStagedCart("ap1")?.saleId).toBe("s1");
    clearStagedCart("ap1");
    expect(getStagedCart("ap1")).toBeUndefined();
  });
});

describe("receipt", () => {
  const json = {
    sale_id: "s1",
    status: "paid",
    currency: "JOD",
    receipt_no: 2,
    receipt_number: "GC-000002",
    client_name: "Yousef",
    subtotal: 21.166,
    discount_total: 1.778,
    tax_total: 2.674,
    tip_total: 1,
    rounding_adjustment: 0,
    total: 20.388,
    paid_total: 20.388,
    balance: 0,
    tax_registered: true,
    tax_number: "123",
    completed_at: "2026-11-13T10:00:00Z",
    shop: { name: "Chair", name_ar: "الكرسي", footer_en: null, footer_ar: null, timezone: "Asia/Amman" },
    items: [{ kind: "service", name: "Haircut", name_ar: "حلاقة", quantity: 1, unit_price: 12, line_total: 11.349, tax_rate: 16, tax_amount: 1.565 }],
    payments: [{ method_code: "cash", name_en: "Cash", name_ar: "نقدًا", amount: 20.388 }],
    tips: [],
  };
  const labels: ReceiptLabels = {
    receipt: "R", date: "D", client: "C", subtotal: "S", discount: "Dc", tax: "T", taxNumber: "TN", tip: "Tp",
    rounding: "Rd", total: "Tot", paid: "P", balance: "B", pricesIncludeTax: "incl", thanks: "Thx",
  };

  it("parses the RPC payload", () => {
    const r = parseSaleReceipt(json)!;
    expect(r.receiptNumber).toBe("GC-000002");
    expect(r.items[0].taxAmount).toBe(1.565);
    expect(parseSaleReceipt(null)).toBeNull();
  });

  it("renders a WhatsApp text in the recipient's language", () => {
    const r = parseSaleReceipt(json)!;
    const money = (n: number) => n.toFixed(3);
    const ar = buildReceiptText(r, { locale: "ar", labels, money, date: () => "d" });
    expect(ar).toContain("*الكرسي*");
    expect(ar).toContain("حلاقة — 11.349");
    expect(ar).toContain("T (16%): 2.674 · incl");
    expect(ar).toContain("P (نقدًا): 20.388");
    expect(ar).toContain("TN: 123");
    const en = buildReceiptText({ ...r, taxRegistered: false }, { locale: "en", labels, money, date: () => "d" });
    expect(en).toContain("Haircut — 11.349");
    expect(en).not.toContain("TN:");
    expect(en).not.toContain("incl");
    expect(en.endsWith("Thx")).toBe(true);
  });
});

describe("parseMoneyInput", () => {
  it("accepts Latin and Arabic-Indic digits and a decimal comma", () => {
    expect(parseMoneyInput("12.5")).toBe(12.5);
    expect(parseMoneyInput("١٢٫٥")).toBe(12.5);
    expect(parseMoneyInput("3,333")).toBe(3.333);
    expect(parseMoneyInput("")).toBe(0);
  });
  it("rejects garbage and more than 3 decimals", () => {
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("1.2345")).toBeNull();
    expect(parseMoneyInput("-2")).toBeNull();
  });
});

describe("resolvePaymentDrafts", () => {
  const base = cart({
    items: [{ key: "a", kind: "service", name: "Cut", quantity: 1, unitPrice: 10.1 }],
  });
  it("auto row takes the full total, then the remainder of a split", () => {
    const one = resolvePaymentDrafts(base, [{ key: "p1", methodCode: "card", amount: "", auto: true }], UNTAXED);
    expect(one.payments[0].amount).toBe(10.1);
    expect(one.totals.balance).toBe(0);

    const split = resolvePaymentDrafts(
      base,
      [
        { key: "p1", methodCode: "card", amount: "", auto: true },
        { key: "p2", methodCode: "cash", amount: "4", auto: false },
      ],
      UNTAXED,
    );
    expect(split.payments.map((p) => p.amount)).toEqual([6.1, 4]);
    expect(split.totals.balance).toBe(0);
  });
  it("applies cash rounding before filling the auto row", () => {
    const r = resolvePaymentDrafts(
      { ...base, applyCashRounding: true },
      [{ key: "p1", methodCode: "cash", amount: "", auto: true }],
      TAXED,
    );
    expect(r.totals.total).toBe(10);
    expect(r.payments[0].amount).toBe(10);
    expect(r.totals.balance).toBe(0);
  });
  it("never goes negative and reports invalid inputs", () => {
    const r = resolvePaymentDrafts(
      base,
      [
        { key: "p1", methodCode: "cash", amount: "", auto: true },
        { key: "p2", methodCode: "card", amount: "20", auto: false },
        { key: "p3", methodCode: "card", amount: "x", auto: false },
      ],
      UNTAXED,
    );
    expect(r.payments[0].amount).toBe(0);
    expect(r.totals.balance).toBe(-9.9);
    expect(r.invalidKeys).toEqual(["p3"]);
  });
});
