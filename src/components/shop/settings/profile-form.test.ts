import { describe, expect, it } from "vitest";
import {
  barberFormFromRow,
  barberPatch,
  coverFromPhotos,
  detailsFromRow,
  detailsPatch,
  locationFromRow,
  locationPatch,
  normalizeLanguages,
  parseYears,
  saveErrorKey,
  toggleLanguage,
  validateBarber,
  validateDetails,
  validateLocation,
  type BarberProfileRow,
} from "./profile-form";

const member: BarberProfileRow = {
  id: "p1",
  full_name: "Sami Haddad",
  role: "barber",
  avatar_url: null,
  handle: "sami-haddad",
  title_en: "Senior barber",
  title_ar: null,
  bio_en: null,
  bio_ar: null,
  languages: ["ar"],
  years_experience: 4,
  is_public: true,
};

describe("details", () => {
  it("sends only changed, trimmed fields", () => {
    const before = detailsFromRow({ name_ar: null, description: "Hi", description_ar: null });
    expect(detailsPatch(before, { ...before })).toEqual({});
    expect(detailsPatch(before, { ...before, name_ar: "  صالون  ", description: "" })).toEqual({ name_ar: "صالون", description: null });
  });

  it("flags over-long text", () => {
    expect(validateDetails({ name_ar: "", description: "x".repeat(2001), description_ar: "" })).toEqual({ description: "tooLong" });
  });
});

describe("location", () => {
  const row = { city_id: "c1", area_id: "a1", lat: 31.9, lng: 35.9, landmark_en: null, landmark_ar: null };

  it("validates pairs of coordinates and area without city", () => {
    const f = locationFromRow(row);
    expect(validateLocation(f)).toEqual({});
    expect(validateLocation({ ...f, lng: null })).toEqual({ lat: "invalid" });
    expect(validateLocation({ ...f, lat: 99 })).toEqual({ lat: "invalid" });
    expect(validateLocation({ ...f, city_id: "" })).toEqual({ area_id: "required" });
  });

  it("rounds coordinates and clears the area on city change", () => {
    const f = locationFromRow(row);
    expect(locationPatch(f, { ...f, lat: 31.12345678 })).toEqual({ lat: 31.123457 });
    expect(locationPatch(f, { ...f, city_id: "c2", area_id: "" })).toEqual({ city_id: "c2", area_id: null });
    expect(locationPatch(f, { ...f, lat: null, lng: null })).toEqual({ lat: null, lng: null });
    expect(locationPatch(f, { ...f, landmark_ar: " قرب الدوار السابع " })).toEqual({ landmark_ar: "قرب الدوار السابع" });
  });
});

describe("barber card", () => {
  it("parses years including Arabic-Indic digits", () => {
    expect(parseYears("")).toBeNull();
    expect(parseYears("12")).toBe(12);
    expect(parseYears("١٢")).toBe(12);
    expect(parseYears("71")).toBeUndefined();
    expect(parseYears("-1")).toBeUndefined();
    expect(parseYears("abc")).toBeUndefined();
  });

  it("normalises and toggles languages", () => {
    expect(normalizeLanguages(["AR", " en ", "ar", "english", "x"])).toEqual(["ar", "en"]);
    expect(toggleLanguage(["ar"], "en")).toEqual(["ar", "en"]);
    expect(toggleLanguage(["ar", "en"], "ar")).toEqual(["en"]);
  });

  it("validates handle and lengths", () => {
    const f = barberFormFromRow(member);
    expect(validateBarber(f)).toEqual({});
    expect(validateBarber({ ...f, handle: "" }).handle).toBe("required");
    expect(validateBarber({ ...f, handle: "Bad Handle" }).handle).toBe("invalid");
    expect(validateBarber({ ...f, handle: "a" }).handle).toBe("invalid");
    expect(validateBarber({ ...f, bio_ar: "x".repeat(1201) }).bio_ar).toBe("tooLong");
    expect(validateBarber({ ...f, years_experience: "100" }).years_experience).toBe("range");
  });

  it("builds a minimal patch", () => {
    const f = barberFormFromRow(member);
    expect(barberPatch(f, f)).toEqual({});
    expect(
      barberPatch(f, { ...f, handle: "Sami-H", title_ar: " حلاق أول ", languages: ["ar", "en"], years_experience: "", is_public: false }),
    ).toEqual({ handle: "sami-h", title_ar: "حلاق أول", languages: ["ar", "en"], years_experience: null, is_public: false });
  });

  it("maps save errors", () => {
    expect(saveErrorKey({ message: "HANDLE_TAKEN" })).toBe("handleTaken");
    expect(saveErrorKey({ code: "23505", message: "duplicate key value violates unique constraint profiles_handle_key" })).toBe("handleTaken");
    expect(saveErrorKey({ message: "INVALID_HANDLE" })).toBe("handleInvalid");
    expect(saveErrorKey({ code: "42501", message: "x" })).toBe("forbidden");
    expect(saveErrorKey(null)).toBe("generic");
  });
});

describe("cover", () => {
  it("is the lowest sort_order photo", () => {
    expect(coverFromPhotos([])).toBeNull();
    expect(
      coverFromPhotos([
        { url: "b", sort_order: 1 },
        { url: "a", sort_order: 0 },
      ]),
    ).toBe("a");
  });
});
