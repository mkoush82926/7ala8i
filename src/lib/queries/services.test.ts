import { describe, it, expect } from "vitest";
import { legacyServiceWrite, planVariantChanges, type VariantRow } from "./services";

const row = (id: string, sort: number, patch: Partial<VariantRow> = {}): VariantRow => ({
  id, service_id: "s1", name_en: `V${id}`, name_ar: null, price: 5, duration: 30, sort, is_active: true, ...patch,
});

describe("planVariantChanges", () => {
  it("inserts new, updates changed, deactivates removed", () => {
    const existing = [row("a", 0), row("b", 1), row("c", 2)];
    const plan = planVariantChanges(existing, [
      { id: "b", name_en: "Vb", name_ar: null, price: 5, duration: 30 }, // moved to 0
      { id: "a", name_en: "Va", name_ar: null, price: 6, duration: 30 }, // price change
      { id: null, name_en: " New ", name_ar: " ", price: 9, duration: 45 },
    ]);
    expect(plan.update.map((u) => [u.id, u.sort])).toEqual([["b", 0], ["a", 1]]);
    expect(plan.insert).toEqual([{ name_en: "New", name_ar: null, price: 9, duration: 45, sort: 2 }]);
    expect(plan.remove).toEqual(["c"]);
  });

  it("is a no-op when nothing changed, and re-activates an inactive row", () => {
    const existing = [row("a", 0), row("b", 1, { is_active: false })];
    const plan = planVariantChanges(existing, [
      { id: "a", name_en: "Va", name_ar: null, price: 5, duration: 30 },
      { id: "b", name_en: "Vb", name_ar: null, price: 5, duration: 30 },
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.update.map((u) => u.id)).toEqual(["b"]);
  });

  it("treats unknown ids as new rows", () => {
    const plan = planVariantChanges([], [{ id: "ghost", name_en: "X", name_ar: null, price: 1, duration: 10 }]);
    expect(plan.insert).toHaveLength(1);
  });
});

describe("legacyServiceWrite", () => {
  it("keeps only the pre-v2 columns", () => {
    expect(
      legacyServiceWrite({ name: "A", price: 1, duration: 30, price_type: "from", online_bookable: false, is_active: true }),
    ).toEqual({ name: "A", price: 1, duration: 30, is_active: true });
  });
});
