import { describe, it, expect } from "vitest";
import { emptyVariant, firstErrorField, formFromRules, formFromService, parseRulesForm, parseServiceForm } from "./service-form";
import { toServiceItem } from "@/hooks/use-services";
import { DEFAULT_BOOKING_RULES } from "@/lib/queries/services";

const valid = () => ({ ...formFromService(null), name: "Skin fade", name_ar: "تدريج", price: "7", duration: "30" });

describe("parseServiceForm", () => {
  it("accepts a basic service with defaults", () => {
    const r = parseServiceForm(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.write).toMatchObject({
        name: "Skin fade", name_ar: "تدريج", price: 7, duration: 30, price_type: "fixed",
        location_type: "in_shop", online_bookable: true, buffer_minutes: 0, processing_minutes: 0, category_id: null,
      });
      expect(r.value.variants).toEqual([]);
    }
  });

  it("forces price 0 for free services and accepts Arabic-Indic digits", () => {
    const r = parseServiceForm({ ...valid(), price_type: "free", price: "", duration: "٤٥" });
    expect(r.ok && r.value.write.price).toBe(0);
    expect(r.ok && r.value.write.duration).toBe(45);
  });

  it("flags bad basics", () => {
    const r = parseServiceForm({ ...valid(), name: "x", duration: "3", price: "-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toMatchObject({ name: "errName", duration: "errDuration", price: "errPrice" });
      expect(firstErrorField(r.errors)).toBe("name");
    }
  });

  it("requires processing to end before the service does", () => {
    expect(parseServiceForm({ ...valid(), processing_offset_minutes: "10", processing_minutes: "20" }).ok).toBe(false);
    const ok = parseServiceForm({ ...valid(), duration: "60", processing_offset_minutes: "10", processing_minutes: "20", buffer_minutes: "10" });
    expect(ok.ok && ok.value.write).toMatchObject({ processing_offset_minutes: 10, processing_minutes: 20, buffer_minutes: 10 });
    expect(parseServiceForm({ ...valid(), buffer_minutes: "200" }).ok).toBe(false);
  });

  it("validates variants and keeps their ids", () => {
    const bad = { ...emptyVariant(), name_en: "", price: "x" };
    const r = parseServiceForm({ ...valid(), variants: [bad] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.variants?.[bad.key]).toMatchObject({ name_en: "errVariantName", price: "errVariantPrice" });
      expect(firstErrorField(r.errors)).toBe(`variant-${bad.key}`);
    }
    const good = parseServiceForm({
      ...valid(),
      variants: [
        { key: "a", id: "v1", name_en: "Short", name_ar: "قصير", price: "5", duration: "30" },
        { key: "b", id: null, name_en: "", name_ar: "طويل", price: "8", duration: "45" },
      ],
    });
    expect(good.ok && good.value.variants).toEqual([
      { id: "v1", name_en: "Short", name_ar: "قصير", price: 5, duration: 30 },
      { id: null, name_en: "طويل", name_ar: "طويل", price: 8, duration: 45 },
    ]);
  });

  it("round-trips a stored service", () => {
    const item = toServiceItem(
      { id: "s1", name: "Beard", name_ar: "دقن", duration: 20, price: 3, price_type: "from", location_type: "home", online_bookable: false, buffer_minutes: 5 },
      [{ id: "v1", service_id: "s1", name_en: "Trim", name_ar: null, price: 3, duration: 20, sort: 0, is_active: true },
       { id: "v2", service_id: "s1", name_en: "Old", name_ar: null, price: 3, duration: 20, sort: 1, is_active: false }],
    );
    expect(item.variants.map((v) => v.id)).toEqual(["v1"]);
    const form = formFromService(item);
    expect(form).toMatchObject({ price_type: "from", location_type: "home", online_bookable: false, buffer_minutes: "5" });
    const r = parseServiceForm(form);
    expect(r.ok && r.value.write.online_bookable).toBe(false);
    expect(r.ok && r.value.variants[0].id).toBe("v1");
  });

  it("normalises unknown enum values from older rows", () => {
    const item = toServiceItem({ id: "s", name: "A", duration: 30, price: 1, price_type: "weird", audience: null });
    expect(item.price_type).toBe("fixed");
    expect(item.audience).toBe("everyone");
    expect(item.online_bookable).toBe(true);
  });
});

describe("parseRulesForm", () => {
  it("accepts the defaults", () => {
    const r = parseRulesForm(formFromRules(DEFAULT_BOOKING_RULES));
    expect(r.ok && r.value).toEqual(DEFAULT_BOOKING_RULES);
  });
  it("rejects out-of-range values", () => {
    const r = parseRulesForm({ ...formFromRules(DEFAULT_BOOKING_RULES), min_notice_minutes: "-5", booking_window_days: "0", slot_interval_minutes: "500" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual({ min_notice_minutes: "errNotice", booking_window_days: "errWindow", slot_interval_minutes: "errInterval" });
  });
  it("trims info to null", () => {
    const r = parseRulesForm({ ...formFromRules(DEFAULT_BOOKING_RULES), important_info_ar: "  أحضر موعدك مبكراً ", important_info_en: "  " });
    expect(r.ok && r.value.important_info_ar).toBe("أحضر موعدك مبكراً");
    expect(r.ok && r.value.important_info_en).toBeNull();
  });
});
