import { describe, expect, it } from "vitest";
import {
  bookingLink,
  bookingLinkPath,
  buildPayload,
  createDraft,
  firstInvalidStep,
  isJordanMobile,
  nextStep,
  normalizePhone,
  prevStep,
  qrFileName,
  restoreDraft,
  stepForErrorDetail,
  resumeStep,
  validateStep,
  whatsappShareUrl,
  wizardErrorCode,
  type WizardDraft,
} from "./wizard";

function validDraft(): WizardDraft {
  const d = createDraft(null);
  d.shop = { nameAr: "صالون أبو أحمد", nameEn: "Abu Ahmad Barbers", phone: "0791234567" };
  d.location = { cityId: "city-1", areaId: "area-1", lat: 31.95, lng: 35.91, landmark: "بجانب مسجد الهدى" };
  return d;
}

describe("normalizePhone", () => {
  it.each([
    ["0791234567", "+962791234567"],
    ["791234567", "+962791234567"],
    ["+962 79 123 4567", "+962791234567"],
    ["00962781234567", "+962781234567"],
    ["٠٧٩١٢٣٤٥٦٧", "+962791234567"],
    ["962771234567", "+962771234567"],
    ["+971501234567", "+971501234567"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(["", "abc", "0612345", "07912", "+1"])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());

  it("detects Jordan mobiles", () => {
    expect(isJordanMobile("+962791234567")).toBe(true);
    expect(isJordanMobile("+971501234567")).toBe(false);
    expect(isJordanMobile(null)).toBe(false);
  });
});

describe("createDraft", () => {
  it("starts from the template with the Jumu'ah week", () => {
    const d = createDraft(null);
    expect(d.services.length).toBeGreaterThan(5);
    expect(d.services.some((s) => s.selected)).toBe(true);
    expect(d.hours[0].day).toBe(6);
    expect(d.team.ownerIsBarber).toBe(true);
    expect(d.publish.marketplaceVisible).toBe(true);
  });

  it("ignores the signup placeholder name and default services", () => {
    const d = createDraft({
      shop: { name: "My Barbershop" } as never,
      services: [{ name: "Premium Haircut", name_ar: "قص شعر فاخر", duration: 45, price: 12 }],
    });
    expect(d.shop.nameEn).toBe("");
    expect(d.services[0].key).toBe("haircut");
  });

  it("keeps a real shop name and custom services", () => {
    const d = createDraft({
      shop: { name: "صالون النخبة", phone: "0790000000" } as never,
      services: [{ name: "VIP Cut", name_ar: null, duration: 40, price: 9.5 }],
    });
    expect(d.shop.nameAr).toBe("صالون النخبة");
    expect(d.shop.nameEn).toBe("");
    expect(d.shop.phone).toBe("0790000000");
    expect(d.services).toHaveLength(1);
    expect(d.services[0]).toMatchObject({ nameEn: "VIP Cut", price: 9.5, selected: true });
  });
});

describe("restoreDraft", () => {
  it("round-trips a draft through JSON", () => {
    const d = validDraft();
    d.team.barbers = [{ id: "b1", fullName: "Sami", avatarUrl: null }];
    const restored = restoreDraft(JSON.parse(JSON.stringify(d)), createDraft(null));
    expect(restored).toEqual(d);
  });

  it("survives garbage", () => {
    const base = createDraft(null);
    expect(restoreDraft(null, base)).toBe(base);
    const r = restoreDraft({ shop: 5, services: "x", hours: [{ day: 5, open: "yes", start: "bad" }], team: { barbers: [null, { fullName: 3 }] } }, base);
    expect(r.shop).toEqual(base.shop);
    expect(r.services).toEqual(base.services);
    expect(r.hours.find((h) => h.day === 5)!.start).toBe(base.hours.find((h) => h.day === 5)!.start);
    expect(r.team.barbers).toHaveLength(1);
    expect(r.team.barbers[0].fullName).toBe("");
  });

  it("drops oversized avatars", () => {
    const r = restoreDraft({ team: { barbers: [{ id: "b", fullName: "A", avatarUrl: "x".repeat(200_000) }] } }, createDraft(null));
    expect(r.team.barbers[0].avatarUrl).toBeNull();
  });
});

describe("validation and navigation", () => {
  it("passes a complete draft", () => {
    expect(firstInvalidStep(validDraft())).toBeNull();
  });

  it("requires a name, phone and city", () => {
    const d = createDraft(null);
    expect(validateStep("shop", d)).toMatchObject({ name: "nameRequired", phone: "phoneRequired" });
    expect(validateStep("location", d)).toMatchObject({ cityId: "cityRequired" });
    d.shop.phone = "12";
    expect(validateStep("shop", d).phone).toBe("phoneInvalid");
  });

  it("rejects pins outside Jordan", () => {
    const d = validDraft();
    d.location.lat = 48.8;
    d.location.lng = 2.3;
    expect(validateStep("location", d).pin).toBe("pinOutside");
  });

  it("needs at least one service and one bookable barber", () => {
    const d = validDraft();
    d.services.forEach((s) => (s.selected = false));
    expect(validateStep("services", d).services).toBe("servicesRequired");
    d.team.ownerIsBarber = false;
    expect(validateStep("team", d).team).toBe("teamRequired");
    d.team.barbers = [{ id: "x", fullName: " ", avatarUrl: null }];
    expect(validateStep("team", d)["barber.x"]).toBe("barberNameRequired");
  });

  it("validates hours", () => {
    const d = validDraft();
    d.hours.forEach((h) => (h.open = false));
    expect(validateStep("hours", d).hours).toBe("hoursNoneOpen");
    d.hours[0] = { ...d.hours[0], open: true, start: "20:00", end: "10:00" };
    expect(validateStep("hours", d)[`day.${d.hours[0].day}`]).toBe("endBeforeStart");
  });

  it("walks the steps in order", () => {
    expect(nextStep("shop")).toBe("location");
    expect(nextStep("publish")).toBeNull();
    expect(prevStep("shop")).toBeNull();
    expect(prevStep("hours")).toBe("team");
  });

  it("resumes at the saved step but never past an invalid one", () => {
    expect(resumeStep("hours", validDraft())).toBe("hours");
    expect(resumeStep("nonsense", validDraft())).toBe("shop");
    const d = validDraft();
    d.location.cityId = null;
    expect(resumeStep("publish", d)).toBe("location");
  });
});

describe("buildPayload", () => {
  it("maps the draft to the RPC shape", () => {
    const d = validDraft();
    d.team.barbers = [
      { id: "1", fullName: "  Sami ", avatarUrl: "data:image/jpeg;base64,AA" },
      { id: "2", fullName: "", avatarUrl: null },
    ];
    d.services = d.services.map((s, i) => ({ ...s, selected: i < 2 }));
    d.services[1] = { ...d.services[1], nameEn: "", price: 2.333 };
    const p = buildPayload(d, { address: "خلدا،  عمّان" });
    expect(p.shop).toMatchObject({
      name_en: "Abu Ahmad Barbers",
      name_ar: "صالون أبو أحمد",
      phone: "+962791234567",
      whatsapp: "+962791234567",
      landmark_ar: "بجانب مسجد الهدى",
      landmark_en: null,
      address: "خلدا، عمّان",
    });
    expect(p.services).toHaveLength(2);
    expect(p.services[1].name).toBe(d.services[1].nameAr);
    expect(p.services[1].price).toBe(2.35);
    expect(p.barbers).toEqual([{ full_name: "Sami", avatar_url: "data:image/jpeg;base64,AA" }]);
    expect(p.hours).toHaveLength(7);
    const fri = p.hours.find((h) => h.day_of_week === 5)!;
    expect(fri.break_start).toBe("12:00");
    expect(p.publish).toBe(true);
  });

  it("puts a Latin landmark in landmark_en and drops breaks on closed days", () => {
    const d = validDraft();
    d.location.landmark = "Next to Cozmo";
    d.hours = d.hours.map((h) => (h.day === 5 ? { ...h, open: false } : h));
    const p = buildPayload(d);
    expect(p.shop.landmark_en).toBe("Next to Cozmo");
    expect(p.shop.address).toBeNull();
    expect(p.hours.find((h) => h.day_of_week === 5)!.break_start).toBeNull();
  });
});

describe("errors and share helpers", () => {
  it("maps RPC errors", () => {
    expect(wizardErrorCode({ message: "ONBOARDING_DONE" })).toBe("ONBOARDING_DONE");
    expect(wizardErrorCode({ message: "INVALID_INPUT" })).toBe("INVALID_INPUT");
    expect(wizardErrorCode({ message: "TypeError: Failed to fetch" })).toBe("NETWORK");
    expect(wizardErrorCode({ message: "boom" })).toBe("UNKNOWN");
    expect(wizardErrorCode(null)).toBe("UNKNOWN");
  });

  it("builds booking links", () => {
    expect(bookingLinkPath("ar", "abu-ahmad")).toBe("/ar/b/abu-ahmad");
    expect(bookingLinkPath("xx", "a b")).toBe("/en/b/a%20b");
    expect(bookingLink("https://halaqy.jo/", "en", "abu")).toBe("https://halaqy.jo/en/b/abu");
    expect(whatsappShareUrl("Book: https://x/y")).toBe("https://wa.me/?text=Book%3A%20https%3A%2F%2Fx%2Fy");
    expect(qrFileName("abu-ahmad")).toBe("halaqy-abu-ahmad-qr.png");
    expect(qrFileName("صالون")).toBe("halaqy-shop-qr.png");
  });
});

describe("stepForErrorDetail", () => {
  it.each([
    ["shop.name", "shop"],
    ["shop.lat_lng", "location"],
    ["shop.area_id", "location"],
    ["services.3.price", "services"],
    ["barbers", "team"],
    ["hours.5.break", "hours"],
    ["payload", null],
    [undefined, null],
  ])("%s → %s", (detail, step) => expect(stepForErrorDetail(detail)).toBe(step));
});
