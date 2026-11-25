import { describe, expect, it, vi } from "vitest";
import { loadBrandedShop, shopDisplayName, shopLandmark, toBrandedShop, type ShopQueryClient } from "./branded-shop";
import { DEFAULT_LINK_THEME } from "./link-utils";

type Call = { columns: string; column: string; value: string };

function fakeClient(responses: { data: Record<string, unknown> | null; error: unknown }[]) {
  const calls: Call[] = [];
  let i = 0;
  const client: ShopQueryClient = {
    from: () => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          limit: () => ({
            maybeSingle: vi.fn(async () => {
              calls.push({ columns, column, value });
              return responses[Math.min(i++, responses.length - 1)];
            }),
          }),
        }),
      }),
    }),
  };
  return { client, calls };
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("loadBrandedShop", () => {
  it("resolves a Latin slug with the theme", async () => {
    const { client, calls } = fakeClient([
      { data: { id: ID, name: "Fade", slug: "fade", booking_link_theme: { accent: "brass" } }, error: null },
    ]);
    const res = await loadBrandedShop(client, "Fade");
    expect(calls[0]).toMatchObject({ column: "slug", value: "fade" });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.shop.theme.accent).toBe("brass");
  });

  it("resolves an Arabic slug and a uuid", async () => {
    const a = fakeClient([{ data: { id: ID, name: "x" }, error: null }]);
    await loadBrandedShop(a.client, encodeURIComponent("صالون-النخبة"));
    expect(a.calls[0].column).toBe("slug_ar");
    const b = fakeClient([{ data: { id: ID, name: "x" }, error: null }]);
    await loadBrandedShop(b.client, ID.toUpperCase());
    expect(b.calls[0]).toMatchObject({ column: "id", value: ID });
  });

  it("falls back when the theme column does not exist yet", async () => {
    const { client, calls } = fakeClient([
      { data: null, error: { message: "column shops.booking_link_theme does not exist" } },
      { data: { id: ID, name: "Fade" }, error: null },
    ]);
    const res = await loadBrandedShop(client, "fade");
    expect(calls).toHaveLength(2);
    expect(calls[1].columns).not.toContain("booking_link_theme");
    expect(res).toMatchObject({ status: "ok", shop: { theme: DEFAULT_LINK_THEME } });
  });

  it("is not_found for bad keys and missing rows; error when every query fails", async () => {
    const none = fakeClient([{ data: null, error: null }]);
    expect(await loadBrandedShop(none.client, "fade")).toEqual({ status: "not_found" });
    expect(await loadBrandedShop(none.client, "bad key!")).toEqual({ status: "not_found" });
    const broken = fakeClient([{ data: null, error: { message: "x" } }]);
    expect(await loadBrandedShop(broken.client, ID)).toEqual({ status: "error" });
    const brokenSlug = fakeClient([{ data: null, error: { message: "x" } }]);
    expect(await loadBrandedShop(brokenSlug.client, "fade")).toEqual({ status: "not_found" });
  });
});

describe("toBrandedShop", () => {
  it("drops non-http images and blank strings", () => {
    const s = toBrandedShop({ id: ID, name: "A", logo_url: "javascript:alert(1)", cover_url: "https://x/c.jpg", name_ar: " " });
    expect(s.logo_url).toBeNull();
    expect(s.cover_url).toBe("https://x/c.jpg");
    expect(s.name_ar).toBeNull();
  });
  it("picks names and landmarks per locale", () => {
    expect(shopDisplayName({ name: "Fade", name_ar: "فيد" }, "ar")).toBe("فيد");
    expect(shopDisplayName({ name: "Fade", name_ar: null }, "ar")).toBe("Fade");
    expect(shopLandmark({ landmark_en: null, landmark_ar: "قرب الدوار", address: "x" }, "en")).toBe("قرب الدوار");
    expect(shopLandmark({ landmark_en: null, landmark_ar: null, address: "Khalda" }, "en")).toBe("Khalda");
  });
});

describe("loadBrandedShop · unpublished shops", () => {
  it("is not found publicly, but staff of the shop may preview it", async () => {
    const draft = { id: ID, name: "Draft", is_published: false };
    const anon = fakeClient([{ data: draft, error: null }]);
    expect(await loadBrandedShop(anon.client, ID)).toEqual({ status: "not_found" });
    expect(anon.calls[0].columns).toContain("is_published");

    const staff = fakeClient([{ data: draft, error: null }]);
    const isStaff = vi.fn(async () => true);
    const res = await loadBrandedShop(staff.client, ID, { isStaff });
    expect(res.status).toBe("ok");
    expect(isStaff).toHaveBeenCalledWith(ID);

    const other = fakeClient([{ data: draft, error: null }]);
    expect(await loadBrandedShop(other.client, ID, { isStaff: async () => false })).toEqual({ status: "not_found" });
  });

  it("treats legacy rows without the column as published", () => {
    expect(toBrandedShop({ id: ID, name: "Old" }).is_published).toBe(true);
  });
});
