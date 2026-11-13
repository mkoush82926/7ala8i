import { describe, it, expect, vi } from "vitest";
import {
  buildIlikeOrFilter,
  containsPattern,
  escapeLikePattern,
  normalizeSearchTerm,
  quotePostgrestValue,
  searchWorkspace,
} from "./search";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

describe("search helpers", () => {
  it("normalizes whitespace, drops * and control chars, caps length", () => {
    expect(normalizeSearchTerm("  a\t*b \n c ")).toBe("a b c");
    expect(normalizeSearchTerm("x".repeat(500))).toHaveLength(100);
    expect(normalizeSearchTerm(undefined)).toBe("");
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("50%_\\")).toBe("50\\%\\_\\\\");
    expect(containsPattern("a_b")).toBe("%a\\_b%");
  });

  it("leaves plain values unquoted and quotes anything with syntax characters", () => {
    expect(quotePostgrestValue("%sara%")).toBe("%sara%");
    expect(quotePostgrestValue("%سارة%")).toBe("%سارة%");
    expect(quotePostgrestValue("%a,b%")).toBe('"%a,b%"');
    expect(quotePostgrestValue('%a"b%')).toBe('"%a\\"b%"');
    expect(quotePostgrestValue("%a.b@c.com%")).toBe('"%a.b@c.com%"');
  });

  it("builds an OR filter that cannot inject extra clauses", () => {
    expect(buildIlikeOrFilter(["name", "phone"], "x),id.eq.(1")).toBe(
      'name.ilike."%x),id.eq.(1%",phone.ilike."%x),id.eq.(1%"',
    );
    expect(buildIlikeOrFilter(["name"], "  ")).toBe("");
  });
});

describe("searchWorkspace", () => {
  it("returns empty results without querying for blank input", async () => {
    const from = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchWorkspace({ from } as any, "shop-1", "  ");
    expect(from).not.toHaveBeenCalled();
    expect(res).toEqual({ clients: [], leads: [], appointments: [] });
  });

  it("filters out soft-deleted clients and escapes the appointment pattern", async () => {
    const builders = [0, 1, 2].map(() => {
      const b = createQueryBuilder({ data: [], error: null }) as Record<string, ReturnType<typeof vi.fn>>;
      b.is = vi.fn(() => b);
      b.ilike = vi.fn(() => b);
      return b;
    });
    const from = vi.fn()
      .mockReturnValueOnce(builders[0])
      .mockReturnValueOnce(builders[1])
      .mockReturnValueOnce(builders[2]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await searchWorkspace({ from } as any, "shop-1", "50%");
    expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    expect(builders[2].ilike).toHaveBeenCalledWith("client_name", "%50\\%%");
  });
  it("skips the leads query when includeLeads is false (barbers)", async () => {
    const builders = [0, 1].map(() => {
      const b = createQueryBuilder({ data: [], error: null }) as Record<string, ReturnType<typeof vi.fn>>;
      b.is = vi.fn(() => b);
      b.ilike = vi.fn(() => b);
      return b;
    });
    const from = vi.fn().mockReturnValueOnce(builders[0]).mockReturnValueOnce(builders[1]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchWorkspace({ from } as any, "shop-1", "sam", { includeLeads: false });
    expect(from.mock.calls.map((c) => c[0])).toEqual(["clients", "appointments"]);
    expect(res.leads).toEqual([]);
  });
});
