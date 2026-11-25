import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearFilters,
  DEFAULT_SEARCH_STATE,
  isIsoDate,
  parseSearchParams,
  resolveWhen,
  sameQuery,
  searchHref,
  serializeSearchState,
  toggleFilter,
  zonedNow,
} from "./params";
import type { SearchState } from "./types";

const base = (over: Partial<SearchState> = {}): SearchState => ({ ...DEFAULT_SEARCH_STATE, filters: [], ...over });

describe("parseSearchParams", () => {
  it("returns the permissive default for an empty URL", () => {
    expect(parseSearchParams(new URLSearchParams(""))).toEqual(DEFAULT_SEARCH_STATE);
    expect(parseSearchParams(undefined)).toEqual(DEFAULT_SEARCH_STATE);
  });

  it("reads every key and drops junk", () => {
    const s = parseSearchParams(
      new URLSearchParams(
        "q=  skin   fade &city=amman&area=khalda&when=today&time=evening&sort=nearest&f=kids&f=open_now&f=bogus&min=3&max=10&tab=barbers&view=map",
      ),
    );
    expect(s).toEqual({
      q: "skin fade",
      city: "amman",
      area: "khalda",
      near: false,
      when: "today",
      time: "evening",
      sort: "nearest",
      filters: ["open_now", "kids"],
      priceMin: 3,
      priceMax: 10,
      tab: "barbers",
      view: "map",
    });
  });

  it("accepts f[] and comma lists, de-duplicates and keeps one audience", () => {
    const s = parseSearchParams({ "f[]": ["card,cliq", "card"], f: "women,men" });
    expect(s.filters).toEqual(["cliq", "card", "men"]);
  });

  it("rejects invalid slugs, dates, sorts and swaps inverted prices", () => {
    const s = parseSearchParams(new URLSearchParams("city=Am man&area=x&when=2026-02-31&sort=cheap&min=20&max=5&tab=x"));
    expect(s.city).toBe("");
    expect(s.area).toBe("");
    expect(s.when).toBe("");
    expect(s.sort).toBe("recommended");
    expect(s.priceMin).toBe(5);
    expect(s.priceMax).toBe(20);
    expect(s.tab).toBe("shops");
  });

  it("ignores an area without a city and caps the query length", () => {
    const s = parseSearchParams(new URLSearchParams(`area=khalda&q=${"a".repeat(300)}`));
    expect(s.area).toBe("");
    expect(s.q.length).toBe(120);
  });

  it("keeps Arabic queries intact", () => {
    expect(parseSearchParams(new URLSearchParams("q=%D8%AF%D9%82%D9%86")).q).toBe("دقن");
  });
});

describe("serializeSearchState", () => {
  it("omits defaults", () => {
    expect(serializeSearchState(base())).toBe("");
    expect(searchHref("ar", base())).toBe("/ar/explore");
  });

  it("round-trips through the URL", () => {
    const state = base({
      q: "دقن",
      city: "amman",
      area: "khalda",
      when: "tomorrow",
      time: "morning",
      sort: "top_rated",
      filters: ["available_today", "parking", "women"],
      priceMin: 2.5,
      priceMax: 15,
      tab: "barbers",
      view: "map",
    });
    const qs = serializeSearchState(state);
    expect(parseSearchParams(new URLSearchParams(qs))).toEqual(state);
  });

  it("writes keys in a stable order regardless of filter order", () => {
    const a = serializeSearchState(base({ filters: ["kids", "open_now"] }));
    const b = serializeSearchState(base({ filters: ["open_now", "kids"] }));
    expect(a).toBe(b);
    expect(a).toBe("f=open_now&f=kids");
  });

  it("near me replaces the city/area", () => {
    expect(serializeSearchState(base({ near: true, city: "amman", area: "khalda" }))).toBe("near=1");
  });

  it("falls back to en for unknown locales", () => {
    expect(searchHref("fr", base({ q: "fade" }))).toBe("/en/explore?q=fade");
  });
});

describe("filters", () => {
  it("toggles and keeps men/women exclusive", () => {
    let s = toggleFilter(base(), "men");
    expect(s.filters).toEqual(["men"]);
    s = toggleFilter(s, "women");
    expect(s.filters).toEqual(["women"]);
    s = toggleFilter(s, "women");
    expect(s.filters).toEqual([]);
  });

  it("counts and clears refinements but keeps the query and place", () => {
    const s = base({ q: "fade", city: "amman", filters: ["kids"], priceMax: 8, when: "today", time: "evening", sort: "nearest" });
    expect(activeFilterCount(s)).toBe(4);
    const cleared = clearFilters(s);
    expect(activeFilterCount(cleared)).toBe(0);
    expect(cleared.q).toBe("fade");
    expect(cleared.city).toBe("amman");
    expect(cleared.sort).toBe("nearest");
  });

  it("sameQuery ignores the view", () => {
    expect(sameQuery(base({ q: "x" }), base({ q: "x", view: "map" }))).toBe(true);
    expect(sameQuery(base({ q: "x" }), base({ q: "y" }))).toBe(false);
  });
});

describe("dates", () => {
  // 2026-11-13 21:30 UTC = 2026-11-14 00:30 in Amman (UTC+3).
  const lateNight = new Date("2026-11-13T21:30:00Z");
  const afternoon = new Date("2026-11-13T12:10:00Z"); // 15:10 Amman

  it("zonedNow uses the shop timezone", () => {
    expect(zonedNow(lateNight)).toEqual({ date: "2026-11-14", time: "00:30" });
    expect(zonedNow(afternoon)).toEqual({ date: "2026-11-13", time: "15:10" });
  });

  it("isIsoDate validates real dates", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
  });

  it("resolves now / today / tomorrow / date / window", () => {
    expect(resolveWhen({ when: "", time: "" }, afternoon)).toEqual({ date: null, timeFrom: null, timeTo: null });
    expect(resolveWhen({ when: "now", time: "" }, afternoon)).toEqual({ date: "2026-11-13", timeFrom: "15:10", timeTo: "17:10" });
    expect(resolveWhen({ when: "today", time: "" }, afternoon)).toEqual({ date: "2026-11-13", timeFrom: null, timeTo: null });
    expect(resolveWhen({ when: "tomorrow", time: "evening" }, lateNight)).toEqual({ date: "2026-11-15", timeFrom: "17:00", timeTo: "24:00" });
    expect(resolveWhen({ when: "2026-12-01" as SearchState["when"], time: "" }, afternoon).date).toBe("2026-12-01");
    // A window alone means today.
    expect(resolveWhen({ when: "", time: "morning" }, afternoon)).toEqual({ date: "2026-11-13", timeFrom: "06:00", timeTo: "12:00" });
  });

  it("drops past dates and caps 'now' at midnight", () => {
    expect(resolveWhen({ when: "2026-01-01" as SearchState["when"], time: "" }, afternoon).date).toBeNull();
    const late = new Date("2026-11-13T20:30:00Z"); // 23:30 Amman
    expect(resolveWhen({ when: "now", time: "" }, late)).toEqual({ date: "2026-11-13", timeFrom: "23:30", timeTo: "24:00" });
  });
});
