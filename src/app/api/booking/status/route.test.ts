import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/booking/status", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const profileBuilder = () => createQueryBuilder({ data: { shop_id: "shop-1" }, error: null });

describe("POST /api/booking/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
  });

  it("rejects an invalid status value before touching the DB", async () => {
    fromMock.mockReturnValueOnce(profileBuilder());
    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "archived" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when the appointment isn't found for this shop", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { message: "no rows" } }));

    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "confirmed" }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects a disallowed status transition", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(
        createQueryBuilder({ data: { id: "a1", status: "completed", shop_id: "shop-1" }, error: null }),
      );

    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "confirmed" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Cannot change status/);
  });

  it("allows a valid transition and persists it", async () => {
    const updateBuilder = createQueryBuilder({ data: null, error: null });
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(
        createQueryBuilder({ data: { id: "a1", status: "pending", shop_id: "shop-1" }, error: null }),
      )
      .mockReturnValueOnce(updateBuilder);

    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "confirmed" }),
    );

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" }),
    );
  });

  it("treats a null status as 'pending' for transition checks", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(
        createQueryBuilder({ data: { id: "a1", status: null, shop_id: "shop-1" }, error: null }),
      )
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));

    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "confirmed" }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 when the update fails", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(
        createQueryBuilder({ data: { id: "a1", status: "pending", shop_id: "shop-1" }, error: null }),
      )
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { message: "db error" } }));

    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111", status: "confirmed" }),
    );
    expect(res.status).toBe(500);
  });
});
