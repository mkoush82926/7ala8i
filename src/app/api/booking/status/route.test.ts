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

const ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/booking/status", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const profileBuilder = (role = "shop_admin") =>
  createQueryBuilder({ data: { shop_id: "shop-1", role }, error: null });
const apptBuilder = (status: string | null, barber_id: string | null = "b1") =>
  createQueryBuilder({ data: { id: "a1", status, shop_id: "shop-1", barber_id }, error: null });

describe("POST /api/booking/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
  });

  it("rejects an invalid status value before touching appointments", async () => {
    fromMock.mockReturnValueOnce(profileBuilder());
    const res = await POST(makeRequest({ appointment_id: ID, status: "archived" }));
    expect(res.status).toBe(400);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("rejects the legacy 'no-show' spelling", async () => {
    fromMock.mockReturnValueOnce(profileBuilder());
    const res = await POST(makeRequest({ appointment_id: ID, status: "no-show" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for customers", async () => {
    fromMock.mockReturnValueOnce(profileBuilder("customer"));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the appointment isn't found for this shop", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(404);
  });

  it("forbids a barber from changing another barber's appointment", async () => {
    fromMock.mockReturnValueOnce(profileBuilder("barber")).mockReturnValueOnce(apptBuilder("pending", "someone-else"));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(403);
  });

  it("lets a barber change their own appointment", async () => {
    const update = createQueryBuilder({ data: null, error: null });
    fromMock
      .mockReturnValueOnce(profileBuilder("barber"))
      .mockReturnValueOnce(apptBuilder("pending", "u1"))
      .mockReturnValueOnce(update);
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(200);
  });

  it("rejects a disallowed status transition with 409", async () => {
    fromMock.mockReturnValueOnce(profileBuilder()).mockReturnValueOnce(apptBuilder("completed"));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INVALID_TRANSITION");
  });

  it("allows a valid transition, scopes the update to the shop and sends no updated_at", async () => {
    const update = createQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(profileBuilder()).mockReturnValueOnce(apptBuilder("pending")).mockReturnValueOnce(update);

    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));

    expect(res.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(update.eq).toHaveBeenCalledWith("shop_id", "shop-1");
  });

  it("accepts 'no_show' and treats legacy 'no-show' rows as terminal", async () => {
    const update = createQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(profileBuilder()).mockReturnValueOnce(apptBuilder("confirmed")).mockReturnValueOnce(update);
    const ok = await POST(makeRequest({ appointment_id: ID, status: "no_show" }));
    expect(ok.status).toBe(200);

    fromMock.mockReturnValueOnce(profileBuilder()).mockReturnValueOnce(apptBuilder("no-show"));
    const blocked = await POST(makeRequest({ appointment_id: ID, status: "completed" }));
    expect(blocked.status).toBe(409);
  });

  it("stores the reason when cancelling", async () => {
    const update = createQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(profileBuilder()).mockReturnValueOnce(apptBuilder("pending")).mockReturnValueOnce(update);
    await POST(makeRequest({ appointment_id: ID, status: "cancelled", reason: "Client called" }));
    expect(update.update).toHaveBeenCalledWith({ status: "cancelled", cancellation_reason: "Client called" });
  });

  it("treats a null status as 'pending' for transition checks", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(apptBuilder(null))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(200);
  });

  it("returns a generic 500 when the update fails unexpectedly", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(apptBuilder("pending"))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { message: "db error" } }));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(500);
  });

  it("maps an overlap (23P01) on update to SLOT_TAKEN", async () => {
    fromMock
      .mockReturnValueOnce(profileBuilder())
      .mockReturnValueOnce(apptBuilder("pending"))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { code: "23P01", message: "conflict" } }));
    const res = await POST(makeRequest({ appointment_id: ID, status: "confirmed" }));
    expect(res.status).toBe(409);
  });
});
