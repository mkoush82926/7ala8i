// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { buildEnvelope, envelopeUrl, isErrorReportingEnabled, parseDsn, reportError, scrubUrl } from "./error-reporting";

const DSN = "https://abc123@o1.ingest.sentry.io/4507";

describe("error reporting", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses DSNs and builds the envelope URL", () => {
    const dsn = parseDsn(DSN)!;
    expect(dsn).toMatchObject({ publicKey: "abc123", host: "o1.ingest.sentry.io", projectId: "4507" });
    expect(envelopeUrl(dsn)).toBe("https://o1.ingest.sentry.io/api/4507/envelope/?sentry_version=7&sentry_key=abc123");
    expect(parseDsn("https://self.host/sentry/12")).toBeNull(); // no key
    expect(parseDsn("not a url")).toBeNull();
    expect(envelopeUrl(parseDsn("https://k@self.host/sentry/12")!)).toBe(
      "https://self.host/sentry/api/12/envelope/?sentry_version=7&sentry_key=k",
    );
  });

  it("is a no-op without a DSN", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(isErrorReportingEnabled(undefined)).toBe(false);
    expect(await reportError(new Error("x"), {}, undefined)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a scrubbed envelope when configured and never throws", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await reportError(new Error("boom at /en/manage?token=secret"), { tags: { route: "/x?t=1" } }, DSN)).toBe(true);
    const body = fetchSpy.mock.calls[0][1].body as string;
    expect(body).not.toContain("secret");
    expect(body).toContain('"route":"/x?…"');

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await reportError(new Error("y"), {}, DSN)).toBe(false);
  });

  it("builds a three-line envelope", () => {
    const lines = buildEnvelope("plain string", { level: "warning" }, new Date(0)).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2])).toMatchObject({ level: "warning", exception: { values: [{ value: "plain string" }] } });
    expect(scrubUrl("https://x.test/a?b=c#d")).toBe("https://x.test/a?…");
  });
});
