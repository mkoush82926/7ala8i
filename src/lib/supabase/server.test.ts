import { describe, it, expect, vi } from "vitest";

type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void;
};

const createServerClientMock = vi.fn(
  (_url: string, _key: string, _options: { cookies: CookieMethods }) => ({ mocked: true }),
);
const cookieStore = {
  getAll: vi.fn(() => [{ name: "a", value: "b" }]),
  set: vi.fn(),
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

describe("createClient", () => {
  it("wires cookie getAll/setAll through to the underlying cookie store", async () => {
    const { createClient } = await import("./server");
    await createClient();

    const [, , options] = createServerClientMock.mock.calls[0];
    expect(options.cookies.getAll()).toEqual([{ name: "a", value: "b" }]);

    options.cookies.setAll([{ name: "x", value: "y", options: {} }]);
    expect(cookieStore.set).toHaveBeenCalledWith("x", "y", {});
  });

  it("swallows errors from setAll (expected when called from a Server Component)", async () => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("cannot set cookies here");
    });
    const { createClient } = await import("./server");
    await createClient();

    const [, , options] = createServerClientMock.mock.calls.at(-1)!;
    expect(() => options.cookies.setAll([{ name: "x", value: "y", options: {} }])).not.toThrow();
  });
});
