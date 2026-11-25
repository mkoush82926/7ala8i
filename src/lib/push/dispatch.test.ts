import { describe, expect, it, vi } from "vitest";
import {
  MAX_ATTEMPTS,
  dispatchStaffPush,
  jobLocale,
  parseClaimedJobs,
  processJob,
  whatsappViaOutbox,
  type ClaimedJob,
  type DispatchDeps,
  type RpcClientLike,
} from "./dispatch";
import { readPushConfig } from "./config";
import type { PushSendFn } from "./send";
import { DICT } from "./fixtures.test-helpers";

const sub = (n: number, locale = "ar") => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: "p".repeat(30), auth: "a".repeat(16) }, locale });

function job(over: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: "j1",
    event: "booking_new",
    shop_id: "s1",
    profile_id: "p1",
    appointment_id: "a1",
    payload: { client_name: "Omar", start_time: "2026-11-19T14:30:00Z", timezone: "Asia/Amman", shop_name: "Fade Lab" },
    attempts: 1,
    push_enabled: true,
    whatsapp_enabled: false,
    phone: null,
    subscriptions: [sub(1)],
    ...over,
  };
}

function deps(send: PushSendFn | null, over: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    send,
    vapid: send ? { subject: "mailto:x@y.z", publicKey: "pub", privateKey: "priv" } : null,
    dict: () => DICT,
    whatsapp: vi.fn(async () => "queued" as const),
    siteOrigin: "https://halaqy.jo",
    ...over,
  };
}

const ok: PushSendFn = async () => ({ statusCode: 201 });
const gone: PushSendFn = async () => {
  throw Object.assign(new Error("gone"), { statusCode: 410 });
};
const flaky: PushSendFn = async () => {
  throw Object.assign(new Error("busy"), { statusCode: 503 });
};

describe("parseClaimedJobs", () => {
  it("drops malformed jobs and subscriptions", () => {
    const out = parseClaimedJobs([
      { id: "x", event: "nope", shop_id: "s", profile_id: "p" },
      { id: "y", event: "test", shop_id: "s", profile_id: "p", subscriptions: [{ endpoint: "e" }, sub(2)] },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].subscriptions).toHaveLength(1);
    expect(out[0].push_enabled).toBe(true);
    expect(out[0].whatsapp_enabled).toBe(false);
    expect(parseClaimedJobs("bad")).toEqual([]);
  });
});

describe("processJob", () => {
  it("sends push in each device's language and reports delivered endpoints", async () => {
    const send = vi.fn(ok);
    const r = await processJob(job({ subscriptions: [sub(1, "ar"), sub(2, "en")] }), deps(send));
    expect(r.status).toBe("sent");
    expect(r.delivered).toHaveLength(2);
    const payloads = send.mock.calls.map((c) => JSON.parse(c[1] as string));
    expect(payloads.map((p) => p.lang).sort()).toEqual(["ar", "en"]);
    expect(send.mock.calls[0][3]).toBe("halaqy-appt-a1");
  });

  it("falls back to WhatsApp when no device is reached", async () => {
    const d = deps(gone);
    const r = await processJob(job({ whatsapp_enabled: true, phone: "0791234567" }), d);
    expect(r.gone).toEqual(["https://push.example/1"]);
    expect(r.status).toBe("sent");
    expect(r.result.whatsapp).toBe("queued");
    const req = (d.whatsapp as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req).toMatchObject({ shopId: "s1", to: "0791234567", appointmentId: "a1", dedupeKey: "staff_push:j1", locale: "ar" });
    expect(req.body).toContain("Fade Lab");
    expect(req.body).toContain("https://halaqy.jo/ar/calendar");
  });

  it("does not send WhatsApp when push reached a device", async () => {
    const d = deps(ok);
    const r = await processJob(job({ whatsapp_enabled: true, phone: "0791234567" }), d);
    expect(r.status).toBe("sent");
    expect(d.whatsapp).not.toHaveBeenCalled();
  });

  it("uses WhatsApp when VAPID is not configured", async () => {
    const d = deps(null);
    const r = await processJob(job({ whatsapp_enabled: true, phone: "0791234567" }), d);
    expect(r.status).toBe("sent");
    expect(d.whatsapp).toHaveBeenCalledOnce();
  });

  it("respects a push-off preference", async () => {
    const send = vi.fn(ok);
    const r = await processJob(job({ push_enabled: false }), deps(send));
    expect(send).not.toHaveBeenCalled();
    expect(r.status).toBe("skipped");
  });

  it("retries transient push failures before falling back", async () => {
    const d = deps(flaky);
    const first = await processJob(job({ whatsapp_enabled: true, phone: "079" }), d);
    expect(first.status).toBe("retry");
    expect(d.whatsapp).not.toHaveBeenCalled();
    const last = await processJob(job({ attempts: MAX_ATTEMPTS, whatsapp_enabled: true, phone: "079" }), d);
    expect(last.status).toBe("sent");
    expect(d.whatsapp).toHaveBeenCalledOnce();
  });

  it("never sends the test alert over WhatsApp", async () => {
    const d = deps(null);
    const r = await processJob(job({ event: "test", whatsapp_enabled: true, phone: "079", subscriptions: [] }), d);
    expect(r.status).toBe("skipped");
    expect(d.whatsapp).not.toHaveBeenCalled();
  });

  it("marks failures and survives a throwing WhatsApp sender", async () => {
    const d = deps(null, {
      whatsapp: async () => {
        throw new Error("x");
      },
    });
    const r = await processJob(job({ whatsapp_enabled: true, phone: "079" }), d);
    expect(r.status).toBe("failed");
    expect(r.result.whatsapp).toBe("error");
  });

  it("picks the job locale", () => {
    expect(jobLocale(job({ payload: { locale: "en" } }))).toBe("en");
    expect(jobLocale(job({ subscriptions: [sub(1, "ar"), sub(2, "en")] }))).toBe("en");
    expect(jobLocale(job({ subscriptions: [] }))).toBe("ar");
  });
});

describe("whatsappViaOutbox", () => {
  it("calls enqueue_message with a dedupe key", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "fallback" }, error: null }));
    const res = await whatsappViaOutbox({ rpc })({ shopId: "s", to: "079", body: "hi", locale: "en", appointmentId: "a", dedupeKey: "k" });
    expect(res).toBe("fallback");
    expect(rpc).toHaveBeenCalledWith("enqueue_message", expect.objectContaining({ p_template: "generic", p_dedupe_key: "k", p_to: "079" }));
  });

  it("falls back to the messaging stub when the RPC is missing", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "function not found" } }));
    const res = await whatsappViaOutbox({ rpc })({ shopId: "s", to: "0791234567", body: "hi", locale: "ar", appointmentId: null, dedupeKey: "k" });
    expect(res).toBe("fallback");
  });
});

describe("dispatchStaffPush", () => {
  it("is a no-op when not configured", async () => {
    const res = await dispatchStaffPush({ config: readPushConfig({}) });
    expect(res.configured).toBe(false);
    expect(res.claimed).toBe(0);
  });

  it("claims, processes and completes jobs", async () => {
    const calls: string[] = [];
    let completed: unknown = null;
    const client: RpcClientLike = {
      rpc: async (fn, args) => {
        calls.push(fn);
        if (fn === "push_claim_jobs") return { data: calls.length === 1 ? [job(), job({ id: "j2", subscriptions: [] })] : [], error: null };
        if (fn === "push_complete_jobs") {
          completed = args?.p_results;
          return { data: 2, error: null };
        }
        return { data: null, error: { message: "unexpected" } };
      },
    };
    const cfg = readPushConfig({ SUPABASE_SERVICE_ROLE_KEY: "srk", VAPID_PUBLIC_KEY: "B" + "A".repeat(86), VAPID_PRIVATE_KEY: "C".repeat(43) });
    const res = await dispatchStaffPush({ config: cfg, client, batchSize: 10, deps: { send: ok, dict: () => DICT } });
    expect(res).toMatchObject({ configured: true, push: true, claimed: 2, sent: 1, skipped: 1 });
    expect(calls).toEqual(["push_claim_jobs", "push_complete_jobs"]);
    expect(Array.isArray(completed)).toBe(true);
    expect((completed as { id: string; status: string }[]).map((r) => r.status)).toEqual(["sent", "skipped"]);
  });

  it("reports a claim failure without throwing", async () => {
    const client: RpcClientLike = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    const res = await dispatchStaffPush({ config: readPushConfig({ SUPABASE_SERVICE_ROLE_KEY: "srk" }), client });
    expect(res.error).toBe("CLAIM_FAILED");
  });
});
