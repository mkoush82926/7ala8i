import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import { MAPLIBRE_VERSION, MAPLIBRE_WORKER_URL, mapStyle } from "./results-map";

describe("results map", () => {
  it("vendors the worker for the installed maplibre-gl version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("node_modules/maplibre-gl/package.json"), "utf8"));
    expect(pkg.version).toBe(MAPLIBRE_VERSION);
    expect(fs.existsSync(path.resolve("public", MAPLIBRE_WORKER_URL.slice(1)))).toBe(true);
  });

  it("uses MapTiler only with a well-formed key", () => {
    expect(mapStyle("abcdEFGH1234")).toMatch(/^https:\/\/api\.maptiler\.com\/maps\/streets-v2\/style\.json\?key=abcdEFGH1234$/);
    expect(typeof mapStyle(undefined)).toBe("object");
    expect(typeof mapStyle("bad key!")).toBe("object");
  });
});
