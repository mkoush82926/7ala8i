import { describe, expect, it } from "vitest";
import { getServiceCategory, getServiceIcon, normalizeServiceName } from "./service-icon";

describe("service-icon", () => {
  it("categorises English names", () => {
    expect(getServiceCategory("Beard Trim")).toBe("beard");
    expect(getServiceCategory("Hair Color")).toBe("color");
    expect(getServiceCategory("Kids Cut")).toBe("kids");
    expect(getServiceCategory("VIP Package")).toBe("packages");
    expect(getServiceCategory("Classic Haircut")).toBe("hair");
  });

  it("categorises Arabic names, ignoring letter variants", () => {
    expect(getServiceCategory("حلاقة لحية")).toBe("beard");
    expect(getServiceCategory("صبغه")).toBe("color");
    expect(getServiceCategory("قص شعر أطفال")).toBe("kids");
    expect(getServiceCategory("تنظيف بشرة")).toBe("spa");
    expect(getServiceCategory("باقة العريس")).toBe("packages");
    expect(getServiceCategory("قص شعر")).toBe("hair");
  });

  it("does not match short stems inside unrelated words", () => {
    expect(getServiceCategory("قصة صالون")).toBe("hair");
  });

  it("uses every name passed (name and name_ar)", () => {
    expect(getServiceCategory("Special", "حلاقة ذقن")).toBe("beard");
    expect(getServiceCategory("Special", null)).toBe("hair");
  });

  it("maps icons for Arabic names too", () => {
    expect(getServiceIcon("لحية")).toBe("face");
    expect(getServiceIcon("كيراتين")).toBe("auto_awesome");
    expect(normalizeServiceName("إأآ")).toBe("ااا");
  });
});
