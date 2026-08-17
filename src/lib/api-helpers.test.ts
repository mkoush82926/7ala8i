import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiResponse, apiError, withAuth } from "./api-helpers";

const getUserMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}));

describe("apiResponse", () => {
  it("wraps data in a success envelope with a 200 default", async () => {
    const res = apiResponse({ id: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 1 } });
  });

  it("honors a custom status code", async () => {
    const res = apiResponse({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });
});

describe("apiError", () => {
  it("wraps a message in an error envelope with a 400 default", async () => {
    const res = apiError("bad request");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: "bad request" });
  });

  it("includes details when provided", async () => {
    const res = apiError("bad request", 422, { field: "name" });
    expect(await res.json()).toEqual({
      success: false,
      error: "bad request",
      details: { field: "name" },
    });
  });
});

describe("withAuth", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    singleMock.mockReset();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request("http://localhost/api/x"));

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when the user has no profile", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    singleMock.mockResolvedValue({ data: null, error: { message: "not found" } });
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request("http://localhost/api/x"));

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler with user and shopId when authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    singleMock.mockResolvedValue({ data: { shop_id: "shop-1" }, error: null });
    const handler = vi.fn().mockResolvedValue(apiResponse({ ok: true }));

    await withAuth(handler)(new Request("http://localhost/api/x"));

    expect(handler).toHaveBeenCalledTimes(1);
    const [, context] = handler.mock.calls[0];
    expect(context.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(context.shopId).toBe("shop-1");
  });

  it("returns 500 when the handler throws unexpectedly", async () => {
    getUserMock.mockRejectedValue(new Error("boom"));
    const res = await withAuth(vi.fn())(new Request("http://localhost/api/x"));

    expect(res.status).toBe(500);
  });
});
