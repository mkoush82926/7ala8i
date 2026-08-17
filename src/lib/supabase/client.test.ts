import { describe, it, expect, vi } from "vitest";

const createBrowserClientMock = vi.fn(() => ({ mocked: true }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

describe("createClient", () => {
  it("initializes the browser client with the public Supabase URL and anon key", async () => {
    const { createClient } = await import("./client");
    createClient();

    expect(createBrowserClientMock).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  });
});
