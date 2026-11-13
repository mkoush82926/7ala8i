import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const profileSingle = vi.fn();
const inviteSingle = vi.fn();
const insertMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingle }) }) };
      }
      return {
        insert: (row: unknown) => {
          insertMock(row);
          return { select: () => ({ single: inviteSingle }) };
        },
      };
    },
  }),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

import { POST } from "./route";

function makeRequest(body: unknown = { role: "barber" }) {
  return new Request("http://localhost/api/invite/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/invite/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    profileSingle.mockResolvedValue({ data: { shop_id: "shop-1", role: "shop_admin" }, error: null });
    rateLimitMock.mockResolvedValue({ success: true, remaining: 19, retryAfter: 3600, source: "memory" });
    inviteSingle.mockResolvedValue({
      data: { token: "tok-123", role: "barber", expires_at: "2026-12-01T00:00:00Z" },
      error: null,
    });
  });

  it("rejects barbers with 403", async () => {
    profileSingle.mockResolvedValue({ data: { shop_id: "shop-1", role: "barber" }, error: null });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers with 401", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rate limits per shop", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfter: 120, source: "memory" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(rateLimitMock).toHaveBeenCalledWith("invite-create:shop-1", 20, 3600);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown role", async () => {
    const res = await POST(makeRequest({ role: "customer" }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates an invite for the admin's own shop", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBe("tok-123");
    expect(body.data.url).toMatch(/\/join\?token=tok-123$/);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ shop_id: "shop-1", role: "barber" }));
  });

  it("maps insert failures without leaking details", async () => {
    inviteSingle.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for table invites" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("permission denied");
  });
});
