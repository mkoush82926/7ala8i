// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({
  MOCK_MODE: false,
  publicEnv: { supabaseUrl: "https://project.supabase.co", supabaseAnonKey: "anon-key", siteUrl: null },
}));

import { GET, HEAD } from "./route";

function req(query = "") {
  return new NextRequest(`http://localhost/api/health${query}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("returns ok without touching the database by default", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.time).toBe("string");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports db up on a deep check", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await GET(req("?deep=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", db: "up" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://project.supabase.co/rest/v1/shops?select=id&limit=1");
    expect(init.headers.apikey).toBe("anon-key");
  });

  it("returns 503 degraded when the database is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1")));
    const res = await GET(req("?deep=1"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "degraded", db: "down" });
    // never leak internal error text
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("returns 503 when the database answers with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const res = await GET(req("?deep=true"));
    expect(res.status).toBe(503);
  });
});

describe("HEAD /api/health", () => {
  it("responds 200 with no body", async () => {
    const res = HEAD();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
