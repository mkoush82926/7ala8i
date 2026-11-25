import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { buildWaLink, maskForLog, normalizePhoneForWa } from "./phone";
import { enqueueMessage, enqueueMessages } from "./enqueue";
import { formatWhen, manageUrl, metaBody, metaTemplateDrafts, renderMessage, META_TEMPLATES, TEMPLATE_COPY } from "./templates";
import { DEFAULT_QUIET_HOURS, nextSendTime, parseQuietHours, quietHoursToJson, quietUntil } from "./quiet-hours";
import { buildIcs, directionsUrl, googleCalendarUrl, icsEscape } from "./calendar";
import { activeProviders, resolveMessagingConfig, templateApproved } from "./config";
import { whatsappTemplatePayload } from "./providers";
import { runDispatch, sendOne } from "./dispatch";
import { parseInboundSms, parseWhatsAppWebhook, safeEqual, verifyMetaSignature } from "./webhook";
import { processWhatsApp } from "./server";
import type { ClaimedMessage, RpcClient } from "./types";

const SHOP = "11111111-1111-4111-8111-111111111111";

const ctx = {
  appointment_id: "a1",
  token: "tok_abcdefghijklmnopqrstuvwxyz012345",
  shop_id: SHOP,
  shop_name: "Elegance Barbers",
  shop_name_ar: "صالون الأناقة",
  shop_slug: "elegance",
  client_name: "Ahmad",
  services: "Haircut + Beard",
  services_ar: "حلاقة + دقن",
  start_time: "2026-11-14T14:30:00Z", // 17:30 Amman (UTC+3)
  timezone: "Asia/Amman",
};

function msg(over: Partial<ClaimedMessage> = {}): ClaimedMessage {
  return {
    id: "m1",
    shop_id: SHOP,
    appointment_id: "a1",
    to: "962791234567",
    channel: "whatsapp",
    template: "reminder",
    template_version: 1,
    category: "utility",
    locale: "ar",
    payload: { ctx },
    body: null,
    offset_minutes: 120,
    attempts: 1,
    sms_fallback: false,
    session_open: false,
    ...over,
  };
}

const okFetch = (id = "wamid.X") =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ messages: [{ id }], success: true, data: { MessageID: 9 } }) }));
const failFetch = (status = 400) => vi.fn(async () => ({ ok: false, status, json: async () => ({ error: { code: 131047 } }) }));

describe("phone", () => {
  it("normalises Jordanian numbers incl. Arabic-Indic and Persian digits", () => {
    expect(normalizePhoneForWa("0791234567")).toBe("962791234567");
    expect(normalizePhoneForWa("۰۷۹۱۲۳۴۵۶۷")).toBe("962791234567");
    expect(normalizePhoneForWa("+962 79 123 4567")).toBe("962791234567");
    expect(normalizePhoneForWa("12")).toBeNull();
    expect(buildWaLink("0791234567", "hi")).toBe("https://wa.me/962791234567?text=hi");
  });
  it("masks phones for logs", () => {
    expect(maskForLog("0791234567")).toBe("962…567");
    expect(maskForLog(null)).toBe("-");
  });
});

describe("enqueueMessage", () => {
  it("queues through the RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { id: "o1", status: "queued" }, error: null }));
    const r = await enqueueMessage({ shopId: SHOP, to: "0791234567", template: "generic", body: "x" }, { client: { rpc } });
    expect(r).toEqual({ status: "queued", id: "o1" });
    expect(rpc).toHaveBeenCalledWith("enqueue_message", expect.objectContaining({ p_shop_id: SHOP, p_to: "962791234567", p_template: "generic" }));
  });
  it("falls back to wa.me when there is no live provider or the RPC fails", async () => {
    const fb = await enqueueMessage(
      { shopId: SHOP, to: "0791234567", template: "receipt", body: "x" },
      { client: { rpc: async () => ({ data: { id: "o2", status: "fallback" }, error: null }) } },
    );
    expect(fb).toEqual({ status: "fallback", waLink: "https://wa.me/962791234567?text=x", id: "o2" });
    const err = await enqueueMessage(
      { shopId: SHOP, to: "0791234567", template: "receipt", body: "x" },
      { client: { rpc: async () => ({ data: null, error: { message: "boom" } }) } },
    );
    expect(err.status).toBe("fallback");
    const thrown = await enqueueMessage(
      { shopId: SHOP, to: "0791234567", template: "receipt", body: "x" },
      { client: { rpc: () => Promise.reject(new Error("net")) } },
    );
    expect(thrown.status).toBe("fallback");
  });
  it("reports opt-outs and skips unusable input without calling the RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { id: null, status: "skipped", reason: "OPTED_OUT" }, error: null }));
    expect(await enqueueMessage({ shopId: SHOP, to: "0791234567", template: "generic", body: "x" }, { client: { rpc } })).toEqual({
      status: "skipped",
      reason: "OPTED_OUT",
    });
    rpc.mockClear();
    expect((await enqueueMessage({ shopId: SHOP, to: "", template: "generic", body: "x" }, { client: { rpc } })).status).toBe("skipped");
    expect(rpc).not.toHaveBeenCalled();
    const many = await enqueueMessages(
      [
        { shopId: SHOP, to: "0791234567", template: "generic", body: "a" },
        { shopId: SHOP, to: "0791234567", template: "generic", body: " " },
      ],
      { client: null },
    );
    expect(many.map((r) => r.status)).toEqual(["fallback", "skipped"]);
  });
});

describe("templates", () => {
  it("renders Arabic and English lifecycle messages in the shop's zone with a manage link", () => {
    const ar = renderMessage({ template: "confirmation", locale: "ar", payload: { ctx } }, "https://halaqy.com/");
    expect(ar).toContain("صالون الأناقة");
    expect(ar).toContain("حلاقة + دقن");
    expect(ar).toContain("5:30");
    expect(ar).toContain("https://halaqy.com/ar/m/tok_abcdefghijklmnopqrstuvwxyz012345");
    const en = renderMessage({ template: "reminder", locale: "en", payload: { ctx } }, "https://halaqy.com");
    expect(en).toContain("Elegance Barbers");
    expect(en).toContain("5:30 pm");
    expect(en).toContain("Saturday 14 November");
  });
  it("uses the stored body for free-form templates and links cancelled messages to the shop", () => {
    expect(renderMessage({ template: "receipt", locale: "en", body: " Receipt #1 " })).toBe("Receipt #1");
    expect(renderMessage({ template: "cancelled", locale: "en", payload: { ctx } }, "https://h.co")).toContain("https://h.co/en/shop/elegance");
    expect(renderMessage({ template: "generic", locale: "en" })).toBe("");
  });
  it("tidies empty names", () => {
    const en = renderMessage({ template: "confirmation", locale: "en", payload: { ctx: { ...ctx, client_name: "" } } }, "https://h.co");
    expect(en.startsWith("Hi, your booking")).toBe(true);
  });
  it("formats dates defensively", () => {
    expect(formatWhen(null, "en")).toEqual({ date: "", time: "" });
    expect(formatWhen("2026-11-14T14:30:00Z", "en", "Not/AZone").time).toBe("5:30 pm");
    expect(manageUrl("https://h.co", "ar", null)).toBe("");
  });
  it("produces Meta drafts for every lifecycle template in both languages", () => {
    const drafts = metaTemplateDrafts("https://halaqy.com");
    expect(drafts).toHaveLength(Object.keys(META_TEMPLATES).length * 2);
    const conf = drafts.find((d) => d.name === "halaqy_booking_confirmation" && d.language === "ar")!;
    expect(conf.body).toContain("{{1}}");
    expect(conf.body).not.toContain("{link}");
    expect(conf.example).toHaveLength(5);
    expect(conf.buttons.map((b) => b.type)).toEqual(["URL", "QUICK_REPLY"]);
    for (const id of Object.keys(TEMPLATE_COPY)) expect(metaBody(id as never, "en")).toBeTruthy();
  });
});

describe("quiet hours", () => {
  const q = DEFAULT_QUIET_HOURS;
  it("defers a 23:30 reminder to 08:00 Amman", () => {
    const at = new Date("2026-11-16T20:30:00Z"); // Mon 23:30 +03
    expect(quietUntil(at, q, "Asia/Amman")?.toISOString()).toBe("2026-11-17T05:00:00.000Z");
    expect(quietUntil(new Date("2026-11-17T00:00:00Z"), q, "Asia/Amman")?.toISOString()).toBe("2026-11-17T05:00:00.000Z");
  });
  it("allows daytime and holds the Friday Jumu'ah window", () => {
    expect(quietUntil(new Date("2026-11-16T09:00:00Z"), q, "Asia/Amman")).toBeNull();
    expect(quietUntil(new Date("2026-11-20T09:00:00Z"), q, "Asia/Amman")?.toISOString()).toBe("2026-11-20T10:30:00.000Z");
    expect(nextSendTime(new Date("2026-11-16T09:00:00Z"), q).toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });
  it("respects switches and same-day windows", () => {
    const off = { ...q, enabled: false, jumuah: false };
    expect(quietUntil(new Date("2026-11-16T22:00:00Z"), off, "Asia/Amman")).toBeNull();
    const day = { ...q, start: "13:00", end: "15:00", jumuah: false };
    expect(quietUntil(new Date("2026-11-16T11:00:00Z"), day, "Asia/Amman")?.toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });
  it("parses and serialises the DB shape", () => {
    const p = parseQuietHours({ enabled: false, start: "22:00", end: "bad", jumuah_start: "12:00" });
    expect(p).toMatchObject({ enabled: false, start: "22:00", end: "08:00", jumuahStart: "12:00" });
    expect(quietHoursToJson(p)).toMatchObject({ jumuah_start: "12:00", end: "08:00" });
    expect(parseQuietHours(null)).toEqual(DEFAULT_QUIET_HOURS);
  });
});

describe("calendar", () => {
  const ev = { uid: "a1@halaqy", start: "2026-11-14T14:30:00Z", end: "2026-11-14T15:15:00Z", title: "Haircut, Beard; at Elegance", location: "Khalda" };
  it("builds a valid ics", () => {
    const ics = buildIcs(ev, new Date("2026-11-13T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261114T143000Z");
    expect(ics).toContain("SUMMARY:Haircut\\, Beard\\; at Elegance");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(icsEscape("a\nb")).toBe("a\\nb");
  });
  it("folds long Arabic lines and builds Google / directions links", () => {
    const ics = buildIcs({ ...ev, description: "حلاقة ".repeat(40) });
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(googleCalendarUrl(ev)).toContain("dates=20261114T143000Z%2F20261114T151500Z");
    expect(directionsUrl({ lat: 31.9, lng: 35.8 })).toBe("https://www.google.com/maps/dir/?api=1&destination=31.9,35.8");
    expect(directionsUrl({ google_maps_url: "javascript:alert(1)" })).toBeNull();
    expect(directionsUrl({ name: "A", address: "B" })).toContain("query=A%2C%20B");
  });
});

describe("config", () => {
  it("is fully optional", () => {
    const c = resolveMessagingConfig({});
    expect(c.whatsapp).toBeNull();
    expect(c.sms).toBeNull();
    expect(c.cronSecret).toBeNull();
    expect(activeProviders(c)).toEqual([]);
    expect(templateApproved(c, "reminder")).toBe(false);
  });
  it("reads providers, approvals and costs", () => {
    const c = resolveMessagingConfig({
      WHATSAPP_TOKEN: "t",
      WHATSAPP_PHONE_NUMBER_ID: "p",
      WHATSAPP_TEMPLATES_APPROVED: "reminder, confirmation",
      UNIFONIC_APP_SID: "u",
      CRON_SECRET: "c",
      MESSAGING_COST_FILS_SMS: "30",
    });
    expect(activeProviders(c)).toEqual(["whatsapp-cloud", "sms-unifonic"]);
    expect(templateApproved(c, "reminder")).toBe(true);
    expect(templateApproved(c, "thank_you")).toBe(false);
    expect(c.cronSecret).toBe("c");
    expect(c.cost.sms).toBe(30);
  });
});

describe("dispatcher", () => {
  const wa = resolveMessagingConfig({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "p", WHATSAPP_TEMPLATES_APPROVED: "all", UNIFONIC_APP_SID: "u" });
  const waOnly = resolveMessagingConfig({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "p" });

  it("builds a template payload with manage + confirm buttons", () => {
    const p = whatsappTemplatePayload(msg(), "halaqy_", "https://h.co") as { template: { name: string; components: unknown[] } };
    expect(p.template.name).toBe("halaqy_booking_reminder");
    expect(JSON.stringify(p.template.components)).toContain("CONFIRM:tok_");
    expect(whatsappTemplatePayload(msg({ template: "generic" }), "x", "y")).toBeNull();
  });
  it("sends free-form text inside the 24h session and an approved template outside it", async () => {
    const f = okFetch();
    const inSession = await sendOne(msg({ session_open: true }), wa, f);
    expect(inSession).toMatchObject({ p_result: "sent", p_channel: "whatsapp", p_cost_fils: 0, p_provider_msg_id: "wamid.X" });
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).type).toBe("text");
    const f2 = okFetch();
    const outside = await sendOne(msg(), wa, f2);
    expect(outside).toMatchObject({ p_result: "sent", p_cost_fils: 12 });
    expect(JSON.parse(String((f2.mock.calls[0] as unknown as [string, RequestInit])[1].body)).type).toBe("template");
  });
  it("never sends free-form outside the session; falls back to wa.me", async () => {
    const f = okFetch();
    const r = await sendOne(msg({ template: "generic", body: "hello" }), waOnly, f);
    expect(r).toMatchObject({ p_result: "fallback", p_channel: "wa_link", p_error: "OUTSIDE_SESSION" });
    expect(f).not.toHaveBeenCalled();
  });
  it("falls back to SMS on WhatsApp failure when enabled", async () => {
    const f = vi.fn(async (url: string) =>
      url.includes("graph.facebook.com")
        ? { ok: false, status: 400, json: async () => ({ error: { code: 132001 } }) }
        : { ok: true, status: 200, json: async () => ({ success: true, data: { MessageID: 7 } }) },
    );
    const r = await sendOne(msg({ sms_fallback: true }), wa, f);
    expect(r).toMatchObject({ p_result: "sent", p_channel: "sms", p_provider: "sms-unifonic", p_provider_msg_id: "unifonic:7", p_cost_fils: 25 });
  });
  it("retries transient errors, then gives up", async () => {
    const approved = resolveMessagingConfig({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "p", WHATSAPP_TEMPLATES_APPROVED: "all" });
    const r = await sendOne(msg({ attempts: 1 }), approved, failFetch(503), new Date("2026-01-01T00:00:00Z"));
    expect(r).toMatchObject({ p_result: "retry", p_retry_at: "2026-01-01T00:01:00.000Z" });
    const last = await sendOne(msg({ attempts: 5, template: "reminder" }), resolveMessagingConfig({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "p", WHATSAPP_TEMPLATES_APPROVED: "all" }), failFetch(503));
    expect(last.p_result).toBe("fallback");
  });
  it("runs a pass: claims, completes, heartbeats; without keys claims in fallback mode", async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const client: RpcClient = {
      rpc: async (fn, args) => {
        calls.push([fn, args]);
        if (fn === "messaging_claim") return { data: { claimed: [msg()], fallback: 2, deferred: 1, skipped: 0, cancelled: 0, recovered: 0 }, error: null };
        return { data: "sent", error: null };
      },
    };
    const s = await runDispatch({ client, config: wa, fetch: okFetch() });
    expect(s).toMatchObject({ live: true, claimed: 1, sent: 1, fallback: 2, deferred: 1 });
    expect(calls.map((c) => c[0])).toEqual(["messaging_claim", "messaging_complete", "messaging_heartbeat"]);

    calls.length = 0;
    const none = await runDispatch({ client: { rpc: async (fn, args) => (calls.push([fn, args]), { data: { claimed: [], fallback: 3 }, error: null }) }, config: resolveMessagingConfig({}) });
    expect(none).toMatchObject({ live: false, fallback: 3, providers: [] });
    expect(calls[0][1]).toEqual({ p_limit: 50, p_live: false });
  });
  it("throws when the claim fails", async () => {
    await expect(runDispatch({ client: { rpc: async () => ({ data: null, error: { message: "x" } }) }, config: wa })).rejects.toThrow();
  });
});

describe("webhooks", () => {
  it("verifies Meta signatures", () => {
    const raw = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(verifyMetaSignature(raw, sig, "s3cret")).toBe(true);
    expect(verifyMetaSignature(raw + " ", sig, "s3cret")).toBe(false);
    expect(verifyMetaSignature(raw, null, "s3cret")).toBe(false);
    expect(verifyMetaSignature(raw, "sha256=zz", "s3cret")).toBe(false);
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "ab")).toBe(false);
    expect(safeEqual(null, "a")).toBe(false);
  });
  it("parses statuses, texts and button replies", () => {
    const parsed = parseWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.1", status: "delivered", timestamp: "1763000000" },
                  { id: "wamid.2", status: "failed", errors: [{ code: 131047 }] },
                  { id: "wamid.3", status: "weird" },
                ],
                messages: [
                  { from: "962791234567", id: "in.1", type: "text", text: { body: "إلغاء" } },
                  { from: "962791234567", id: "in.2", type: "button", button: { text: "Confirm", payload: "CONFIRM:tok" }, context: { id: "wamid.1" } },
                  { from: "962791234567", id: "in.3", type: "interactive", interactive: { button_reply: { id: "OPT_OUT", title: "Stop" } } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(parsed.statuses).toHaveLength(2);
    expect(parsed.statuses[1]).toMatchObject({ status: "failed", error: "WA_131047" });
    expect(parsed.messages[0]).toMatchObject({ body: "إلغاء", buttonPayload: null });
    expect(parsed.messages[1]).toMatchObject({ buttonPayload: "CONFIRM:tok", contextMsgId: "wamid.1" });
    expect(parsed.messages[2].buttonPayload).toBe("OPT_OUT");
    expect(parseWhatsAppWebhook(null)).toEqual({ statuses: [], messages: [] });
  });
  it("processes events through the service RPCs", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "messaging_handle_inbound" ? { action: "opted_out" } : true, error: null }));
    const s = await processWhatsApp({ rpc }, {
      statuses: [{ providerMsgId: "w", status: "read", at: null, error: null }],
      messages: [{ from: "962791234567", providerMsgId: "i", body: "STOP", buttonPayload: null, contextMsgId: null }],
    });
    expect(s).toEqual({ statuses: 1, messages: 1, actions: { opted_out: 1 }, errors: 0 });
  });
  it("parses inbound SMS fields", () => {
    expect(parseInboundSms({ From: "0791234567", Body: "STOP" })).toMatchObject({ from: "0791234567", body: "STOP" });
    expect(parseInboundSms({ body: "x" })).toBeNull();
  });
});
