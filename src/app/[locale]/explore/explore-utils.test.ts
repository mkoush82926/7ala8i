import { describe, expect, it } from "vitest";
import { exploreRobots } from "./explore-utils";

describe("exploreRobots", () => {
  it("indexes the bare listing and place pages", () => {
    expect(exploreRobots({})).toEqual({ index: true, follow: true });
    expect(exploreRobots({ city: "amman" })).toEqual({ index: true, follow: true });
    expect(exploreRobots({ city: "amman", area: "abdoun" })).toEqual({ index: true, follow: true });
    expect(exploreRobots({ q: "fade" })).toEqual({ index: true, follow: true });
  });

  it("keeps refinements out of the index", () => {
    expect(exploreRobots({ when: "today" })).toEqual({ index: false, follow: true });
    expect(exploreRobots({ city: "amman", f: "kids" })).toEqual({ index: false, follow: true });
    expect(exploreRobots({ q: "fade", city: "amman" })).toEqual({ index: false, follow: true });
    expect(exploreRobots({ view: "map" })).toEqual({ index: false, follow: true });
  });

  it("ignores empty values", () => {
    expect(exploreRobots({ q: "", sort: undefined })).toEqual({ index: true, follow: true });
    expect(exploreRobots(null)).toEqual({ index: true, follow: true });
  });
});
