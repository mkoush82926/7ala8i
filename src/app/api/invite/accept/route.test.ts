import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/invite/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/invite/accept", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("rejects an empty token", async () => {
    const res = await POST(makeRequest({ token: "" }));
    expect(res.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an invite that doesn't exist or isn't pending", async () => {
    fromMock.mockReturnValue(createQueryBuilder({ data: null, error: { message: "no rows" } }));
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(404);
  });

  it("accepts a valid pending invite and marks it accepted", async () => {
    const invite = { id: "invite-1", shop_id: "shop-1", role: "barber", status: "pending" };
    const selectBuilder = createQueryBuilder({ data: invite, error: null });
    const updateBuilder = createQueryBuilder({ data: null, error: null });
    fromMock
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(updateBuilder);

    const res = await POST(makeRequest({ token: "abc123" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      shopId: "shop-1",
      role: "barber",
      message: "Invite accepted successfully",
    });
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted" }),
    );
  });

  it("returns 500 when the request body isn't valid JSON", async () => {
    const badRequest = new NextRequest("http://localhost/api/invite/accept", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(badRequest);
    expect(res.status).toBe(500);
  });
});
