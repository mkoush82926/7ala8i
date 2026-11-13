import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  apiResponse,
  apiError,
  apiErrorCode,
  apiValidationError,
  mapDbError,
  dbErrorResponse,
  serverError,
  logServerError,
  withAuth,
} from "./api-helpers";
import { z } from "zod";

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

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

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
  it("wraps a message in an error envelope with a 400 default and a code", async () => {
    const res = apiError("bad request");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: "bad request", code: "VALIDATION_FAILED" });
  });

  it("derives the code from the status", async () => {
    expect((await apiError("x", 404).json()).code).toBe("NOT_FOUND");
    expect((await apiError("x", 429).json()).code).toBe("RATE_LIMITED");
    expect((await apiError("x", 500).json()).code).toBe("INTERNAL");
  });

  it("keeps only field error messages from a legacy zod flatten() argument", async () => {
    const res = apiError("bad request", 422, { formErrors: [], fieldErrors: { name: ["Too short"] } });
    expect(await res.json()).toEqual({
      success: false,
      error: "bad request",
      code: "VALIDATION_FAILED",
      fieldErrors: { name: ["Too short"] },
    });
  });

  it("never serializes arbitrary detail objects (e.g. raw Postgres errors)", async () => {
    const res = apiError("failed", 500, { code: "42P01", message: 'relation "x" does not exist', details: "secret" });
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("relation");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body.code).toBe("INTERNAL");
  });

  it("sets Retry-After when retryAfter is given", async () => {
    const res = apiError("slow down", 429, { code: "RATE_LIMITED", retryAfter: 12.2 });
    expect(res.headers.get("Retry-After")).toBe("13");
    expect((await res.json()).retryAfter).toBe(13);
  });
});

describe("apiErrorCode / apiValidationError", () => {
  it("uses the standard status for a code", async () => {
    const res = apiErrorCode("SLOT_TAKEN");
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SLOT_TAKEN");
  });

  it("builds field errors from a zod error", async () => {
    const parsed = z.object({ name: z.string().min(2, "Too short") }).safeParse({ name: "a" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const res = apiValidationError(parsed.error);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Too short", code: "VALIDATION_FAILED", fieldErrors: { name: ["Too short"] } });
  });
});

describe("mapDbError", () => {
  it("maps RPC exception codes", () => {
    expect(mapDbError({ code: "P0001", message: "SLOT_TAKEN" })).toMatchObject({ status: 409, code: "SLOT_TAKEN", internal: false });
    expect(mapDbError({ code: "P0001", message: "INSIDE_CANCELLATION_WINDOW" })).toMatchObject({ status: 409 });
    expect(mapDbError({ code: "P0001", message: "INVITE_EXPIRED" })).toMatchObject({ status: 410 });
    expect(mapDbError({ code: "P0001", message: "RATE_LIMITED" })).toMatchObject({ status: 429 });
  });

  it("maps Postgres error codes", () => {
    expect(mapDbError({ code: "23P01", message: "conflicting key value violates exclusion constraint" }).code).toBe("SLOT_TAKEN");
    expect(mapDbError({ code: "42501", message: "permission denied" }).code).toBe("FORBIDDEN");
    expect(mapDbError({ code: "PGRST116", message: "0 rows" }).code).toBe("NOT_FOUND");
  });

  it("maps legacy free-text RPC messages", () => {
    expect(mapDbError({ message: "Appointment not found" }).code).toBe("APPT_NOT_FOUND");
    expect(mapDbError({ message: "This invite has already been used" }).code).toBe("INVITE_USED");
  });

  it("treats anything else as internal", () => {
    expect(mapDbError({ code: "42P01", message: "relation does not exist" })).toMatchObject({ status: 500, code: "INTERNAL", internal: true });
    expect(mapDbError(null)).toMatchObject({ internal: true });
  });
});

describe("dbErrorResponse / serverError / logServerError", () => {
  it("returns a client-safe body for known codes without logging", async () => {
    const res = dbErrorResponse("booking", { code: "P0001", message: "SLOT_TAKEN" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ success: false, code: "SLOT_TAKEN" });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs unknown errors and returns a generic 500 with a requestId", async () => {
    const res = dbErrorResponse("booking", { code: "XX000", message: "internal detail" });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).not.toContain("internal detail");
    expect(typeof body.requestId).toBe("string");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain(body.requestId);
  });

  it("serverError hides the thrown message", async () => {
    const res = serverError("x", new Error("db password is hunter2"));
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });

  it("logServerError reuses a provided requestId", () => {
    expect(logServerError("ctx", new Error("e"), { requestId: "abc" })).toBe("abc");
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
    expect((await res.json()).code).toBe("UNAUTHORIZED");
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

  it("returns 403 for customers on staff-only routes (default)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    singleMock.mockResolvedValue({ data: { shop_id: null, role: "customer" }, error: null });
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request("http://localhost/api/x"));

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 NO_SHOP when a staff member has no shop", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    singleMock.mockResolvedValue({ data: { shop_id: null, role: "barber" }, error: null });
    const res = await withAuth(vi.fn())(new Request("http://localhost/api/x"));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_SHOP");
  });

  it("allows other roles / no shop when configured", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    singleMock.mockResolvedValue({ data: { shop_id: null, role: "customer" }, error: null });
    const handler = vi.fn().mockResolvedValue(apiResponse({ ok: true }));
    await withAuth(handler, { roles: ["customer"], requireShop: false })(new Request("http://localhost/api/x"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toMatchObject({ role: "customer", shopId: "" });
  });

  it("invokes the handler with user, shopId, role and requestId when authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    singleMock.mockResolvedValue({ data: { shop_id: "shop-1", role: "shop_admin" }, error: null });
    const handler = vi.fn().mockResolvedValue(apiResponse({ ok: true }));

    await withAuth(handler)(new Request("http://localhost/api/x"));

    expect(handler).toHaveBeenCalledTimes(1);
    const [, context] = handler.mock.calls[0];
    expect(context.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(context.shopId).toBe("shop-1");
    expect(context.role).toBe("shop_admin");
    expect(typeof context.requestId).toBe("string");
  });

  it("returns a generic 500 when something throws unexpectedly", async () => {
    getUserMock.mockRejectedValue(new Error("boom"));
    const res = await withAuth(vi.fn())(new Request("http://localhost/api/x"));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
