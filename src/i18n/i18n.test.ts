import { describe, it, expect } from "vitest";
import en from "./en";
import ar from "./ar";

type Tree = { [key: string]: string | Tree };

function flatten(obj: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const flatEn = flatten(en as unknown as Tree);
const flatAr = flatten(ar as unknown as Tree);
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("i18n dictionaries", () => {
  it("have identical key sets", () => {
    const enKeys = Object.keys(flatEn).sort();
    const arKeys = Object.keys(flatAr).sort();
    expect(arKeys.filter((k) => !(k in flatEn))).toEqual([]);
    expect(enKeys.filter((k) => !(k in flatAr))).toEqual([]);
  });

  it("have no empty strings", () => {
    const empty = [
      ...Object.entries(flatEn).filter(([, v]) => !v.trim()).map(([k]) => `en.${k}`),
      ...Object.entries(flatAr).filter(([, v]) => !v.trim()).map(([k]) => `ar.${k}`),
    ];
    expect(empty).toEqual([]);
  });

  it("use the same {placeholders} in both languages", () => {
    const mismatched = Object.keys(flatEn).filter(
      (k) => k in flatAr && placeholders(flatEn[k]).join() !== placeholders(flatAr[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it("never leak the old brand name", () => {
    const leaks = Object.entries({ ...flatEn, ...flatAr }).filter(([, v]) => /lumina|لومينا/i.test(v));
    expect(leaks).toEqual([]);
  });
});
