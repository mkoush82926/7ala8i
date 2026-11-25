import { describe, it, expect, vi, afterEach } from "vitest";
import { __setPrayerAdminClient, bearerToken, handlePrayerGenerate, prayerCronSecret } from "./cron";

const req = (auth?: string) => new Request("http://localhost/api/prayer/generate", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  __setPrayerAdminClient(undefined);
  vi.unstubAllEnvs();
});

describe("prayer cron", () => {
  it("reads the secret and the bearer token", () => {
    expect(prayerCronSecret({ PRAYER_CRON_SECRET: " a ", CRON_SECRET: "b" })).toBe("a");
    expect(prayerCronSecret({ CRON_SECRET: "b" })).toBe("b");
    expect(prayerCronSecret({})).toBeNull();
    expect(bearerToken("Bearer xyz")).toBe("xyz");
    expect(bearerToken("Basic xyz")).toBe("");
  });

  it("is a 503 no-op when unconfigured", async () => {
    vi.stubEnv("PRAYER_CRON_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    const res = await handlePrayerGenerate(req("Bearer x"));
    expect(res.status).toBe(503);
  });

  it("rejects a wrong token and runs generate_prayer_blocks(NULL, 14) for the right one", async () => {
    vi.stubEnv("PRAYER_CRON_SECRET", "s3cret");
    const rpc = vi.fn().mockResolvedValue({ data: 42, error: null });
    __setPrayerAdminClient({ rpc });
    expect((await handlePrayerGenerate(req("Bearer nope"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    const res = await handlePrayerGenerate(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, blocks: 42 });
    expect(rpc).toHaveBeenCalledWith("generate_prayer_blocks", { p_shop_id: null, p_days: 14 });
  });

  it("reports a database error as 500", async () => {
    vi.stubEnv("PRAYER_CRON_SECRET", "s3cret");
    __setPrayerAdminClient({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await handlePrayerGenerate(req("Bearer s3cret"))).status).toBe(500);
  });
});
