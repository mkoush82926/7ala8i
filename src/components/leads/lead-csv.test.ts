import { describe, expect, it } from "vitest";
import { parseCsvLine, parseLeadsCsv } from "./lead-csv";

describe("parseCsvLine", () => {
  it("handles quoted cells and escaped quotes", () => {
    expect(parseCsvLine('a,"b, c","say ""hi"""')).toEqual(["a", "b, c", 'say "hi"']);
  });
});

describe("parseLeadsCsv", () => {
  it("maps columns by header name", () => {
    const csv = "Notes,Name,Phone,Value,Email\nVIP,Omar,0791234567,25,o@x.io\n";
    expect(parseLeadsCsv(csv)).toEqual([
      { name: "Omar", phone: "0791234567", email: "o@x.io", value: 25, notes: "VIP", stage: "new" },
    ]);
  });

  it("falls back to name,phone without a header", () => {
    expect(parseLeadsCsv("Sami,0790000000\r\nNabil,")).toEqual([
      { name: "Sami", phone: "0790000000", email: null, value: null, notes: null, stage: "new" },
      { name: "Nabil", phone: null, email: null, value: null, notes: null, stage: "new" },
    ]);
  });

  it("skips rows without a name, strips BOM and formula prefixes but keeps +phone", () => {
    const out = parseLeadsCsv("\uFEFFname,phone\n,079\n=HYPERLINK(1),+962\n");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("HYPERLINK(1)");
    expect(out[0].phone).toBe("+962");
  });

  it("accepts Arabic headers and ignores invalid values", () => {
    const out = parseLeadsCsv("الاسم,الهاتف,القيمة\nأحمد,0791,abc");
    expect(out[0]).toMatchObject({ name: "أحمد", phone: "0791", value: null });
  });

  it("returns [] for empty input", () => {
    expect(parseLeadsCsv("  \n")).toEqual([]);
  });
});
