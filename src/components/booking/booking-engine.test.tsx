import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import en from "@/i18n/en";
import { BOOKING_FLOW_EN, ERROR_CODES_EN } from "./__fixtures__/i18n";

// ─── Mocks ───
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/book/shop",
}));

vi.mock("@/hooks/use-translation", async (orig) => {
  const actual = await orig<typeof import("@/hooks/use-translation")>();
  const t = {
    ...en,
    bookingFlow: BOOKING_FLOW_EN,
    error: { ...en.error, codes: { ...en.error.codes, ...ERROR_CODES_EN } },
  };
  return { ...actual, useTranslation: () => ({ ...actual.useTranslation(), t }) };
});

const SHOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const B1 = "44444444-4444-4444-8444-444444444444";
const B2 = "55555555-5555-4555-8555-555555555555";

const tables: Record<string, unknown> = {
  shops: { id: SHOP, name: "Fade Lab", name_ar: null, address: "Khalda", phone: "0790000000", whatsapp: null, currency: "JOD", timezone: "Asia/Amman", cancellation_policy_hours: 2, important_info_en: "Park behind the shop", important_info_ar: null },
  services: [
    { id: S1, name: "Haircut", name_ar: "حلاقة", duration: 30, price: 5, price_type: "fixed", is_active: true, online_bookable: true, sort_order: 0 },
    { id: S2, name: "Beard", name_ar: "دقن", duration: 15, price: 3, price_type: "from", is_active: true, online_bookable: true, sort_order: 1 },
  ],
  service_variants: [],
  service_categories: [],
  profiles: [
    { id: B1, full_name: "Ahmad", avatar_url: null, role: "barber", online_bookable: true, barber_services: [] },
    { id: B2, full_name: "Sami", avatar_url: null, role: "barber", online_bookable: true, barber_services: [{ service_id: S1, is_active: true, price_override: 7, duration_override: null }] },
  ],
  reviews: [{ rating: 5 }],
};

const slotRow = (h: number) => {
  const d = new Date(Date.now() + 2 * 86400000);
  const date = d.toISOString().slice(0, 10);
  return { start_time: `${date}T${String(h - 3).padStart(2, "0")}:00:00Z`, end_time: `${date}T${String(h - 3).padStart(2, "0")}:30:00Z`, local_date: date, local_time: `${String(h).padStart(2, "0")}:00`, barber_ids: [B1] };
};

function builder(table: string) {
  const data = tables[table];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error: null });
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null }).then(res, rej);
  return b;
}

const rpc = vi.fn(async (fn: string) => {
  if (fn === "next_available_slot") return { data: [slotRow(10)], error: null };
  if (fn === "get_available_slots") return { data: [slotRow(10), slotRow(14)], error: null };
  if (fn === "is_slot_bookable") return { data: true, error: null };
  return { data: [], error: null };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (t: string) => builder(t),
    rpc,
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

import { BookingEngine } from "./booking-engine";

beforeEach(() => {
  searchParams = new URLSearchParams();
  window.sessionStorage.clear();
  rpc.mockClear();
});

describe("BookingEngine (v2)", () => {
  it("walks services → barber → time → review with attribution in the payload", async () => {
    searchParams = new URLSearchParams(`service=${S1}&src=ig_story&entry=service_row`);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      booking: { appointment_id: "99999999-9999-4999-8999-999999999999", start_time: slotRow(10).start_time, end_time: slotRow(10).end_time, price: 5, currency: "JOD", barber_id: B1 },
    }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingEngine shopId={SHOP} />);

    // Preselected service skips straight to the barber step.
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.chooseBarber })).toBeInTheDocument();
    expect(screen.getByText("+2 JD")).toBeInTheDocument(); // Sami's price override

    fireEvent.click(screen.getByRole("button", { name: /Ahmad/ }));
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.pickDateTime })).toBeInTheDocument();

    const slotBtn = await screen.findAllByRole("button", { pressed: false, name: /10:00|10:00\s?AM/i });
    fireEvent.click(slotBtn[0]);
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.confirmBooking })).toBeInTheDocument();
    expect(screen.getByText("Park behind the shop")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(en.booking.yourName), { target: { value: "Omar Ali" } });
    fireEvent.change(screen.getByLabelText(en.booking.phoneNumber), { target: { value: "0791234567" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.booking.confirmBtn) }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/booking");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ shopId: SHOP, barberId: B1, src: "ig_story", entry: "service_row", items: [{ serviceId: S1 }] });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.allSet })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(`halaqy:booking:${SHOP}`)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("restores selections from the session after a refresh", async () => {
    window.sessionStorage.setItem(`halaqy:booking:${SHOP}`, JSON.stringify({
      v: 2, shopId: SHOP, savedAt: Date.now(), step: "time", lines: [{ serviceId: S2, variantId: null, note: "" }],
      barber: "any", date: null, slot: null, name: "Omar", phone: "0791234567", notes: "", otp: null,
    }));
    render(<BookingEngine shopId={SHOP} />);
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.pickDateTime })).toBeInTheDocument();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_available_slots", expect.objectContaining({ p_items: [S2], p_barber_id: null })));
  });

  it("sends a time conflict back to the time step with a notice", async () => {
    searchParams = new URLSearchParams(`service=${S1}&staff=${B1}`);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, code: "SLOT_TAKEN" }), { status: 409 })));
    render(<BookingEngine shopId={SHOP} />);
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.pickDateTime })).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { pressed: false, name: /10:00/ }))[0]);
    fireEvent.change(await screen.findByLabelText(en.booking.yourName), { target: { value: "Omar Ali" } });
    fireEvent.change(screen.getByLabelText(en.booking.phoneNumber), { target: { value: "0791234567" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.booking.confirmBtn) }));
    expect(await screen.findByRole("heading", { level: 1, name: en.booking.pickDateTime })).toBeInTheDocument();
    expect(screen.getAllByText(en.error.codes.SLOT_TAKEN).length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
