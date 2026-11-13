import { describe, it, expect, vi } from "vitest";
import {
  effectiveOtpMode,
  parseOtpChannel,
  parseOtpMode,
  publicBookingSecurity,
  resolveOtpProvider,
  turnstileSiteKey,
} from "./config";
import { maskForDisplay, nationalKey, samePhone, toE164Digits } from "./phone";
import { otpText, sendOtpMessage } from "./providers";
import { verifyCaptcha } from "./turnstile";
import { signWebhook, verifyWebhook, webhookKey } from "./webhook";

describe("otp config", () => {
  it("is off by default and with junk values", () => {
    expect(parseOtpMode(undefined)).toBe("off");
    expect(parseOtpMode("yes")).toBe("off");
    expect(parseOtpMode(" Supabase ")).toBe("supabase");
    expect(parseOtpChannel("WhatsApp")).toBe("whatsapp");
    expect(parseOtpChannel("")).toBe("sms");
    expect(publicBookingSecurity({})).toEqual({
      otpMode: "off",
      otpChannel: "sms",
      otpRequired: false,
      turnstileSiteKey: null,
    });
  });

  it("degrades hook mode to off without a provider or service key", () => {
    expect(effectiveOtpMode({ NEXT_PUBLIC_OTP_MODE: "hook" })).toBe("off");
    expect(effectiveOtpMode({ NEXT_PUBLIC_OTP_MODE: "hook", OTP_PROVIDER: "log", SUPABASE_SERVICE_ROLE_KEY: "k" })).toBe("hook");
    expect(
      effectiveOtpMode({ NEXT_PUBLIC_OTP_MODE: "hook", OTP_PROVIDER: "log", SUPABASE_SERVICE_ROLE_KEY: "k", NODE_ENV: "production" }),
    ).toBe("off");
  });

  it("needs complete provider credentials", () => {
    expect(resolveOtpProvider({ OTP_PROVIDER: "unifonic" })).toBeNull();
    expect(resolveOtpProvider({ OTP_PROVIDER: "unifonic", UNIFONIC_APP_SID: "sid" })).toBe("unifonic");
    expect(resolveOtpProvider({ OTP_PROVIDER: "whatsapp", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })).toBeNull();
    expect(
      resolveOtpProvider({ OTP_PROVIDER: "whatsapp", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_OTP_TEMPLATE: "code" }),
    ).toBe("whatsapp");
  });

  it("only exposes the Turnstile site key when the server can verify", () => {
    expect(turnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site" })).toBeNull();
    expect(turnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "s" })).toBe("site");
  });
});

describe("phone helpers", () => {
  it("normalises Jordanian numbers to E.164 digits", () => {
    expect(toE164Digits("0791234567")).toBe("962791234567");
    expect(toE164Digits("791234567")).toBe("962791234567");
    expect(toE164Digits("+962 79 123 4567")).toBe("962791234567");
    expect(toE164Digits("00962791234567")).toBe("962791234567");
    expect(toE164Digits("123")).toBeNull();
  });

  it("compares by the national part", () => {
    expect(nationalKey("0791234567")).toBe("791234567");
    expect(samePhone("0791234567", "+962791234567")).toBe(true);
    expect(samePhone("0791234567", "0781234567")).toBe(false);
    expect(samePhone("", "")).toBe(false);
  });

  it("masks for display", () => {
    expect(maskForDisplay("0791234567")).toBe("+962 7•• ••• 567");
  });
});

describe("sendOtpMessage", () => {
  it("is a no-op when not configured", async () => {
    const fetchMock = vi.fn();
    const r = await sendOtpMessage({ phone: "0791234567", code: "123456", locale: "en" }, {}, fetchMock);
    expect(r).toEqual({ ok: false, provider: null, reason: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through Unifonic in E.164", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    const r = await sendOtpMessage(
      { phone: "0791234567", code: "123456", locale: "ar" },
      { OTP_PROVIDER: "unifonic", UNIFONIC_APP_SID: "sid" },
      fetchMock,
    );
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("unifonic");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("Recipient")).toBe("962791234567");
    expect(body.get("Body")).toContain("123456");
  });

  it("uses the WhatsApp authentication template", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    const env = { OTP_PROVIDER: "whatsapp", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "42", WHATSAPP_OTP_TEMPLATE: "halaqy_code" };
    await sendOtpMessage({ phone: "0791234567", code: "654321", locale: "en" }, env, fetchMock);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/42/messages");
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("962791234567");
    expect(body.template.name).toBe("halaqy_code");
    expect(JSON.stringify(body)).toContain("654321");
  });

  it("reports provider failures without throwing", async () => {
    const r = await sendOtpMessage(
      { phone: "0791234567", code: "123456", locale: "en" },
      { OTP_PROVIDER: "unifonic", UNIFONIC_APP_SID: "sid" },
      async () => {
        throw new Error("down");
      },
    );
    expect(r).toEqual({ ok: false, provider: "unifonic", reason: "PROVIDER_ERROR" });
  });

  it("writes Arabic and English texts", () => {
    expect(otpText("111111", "ar")).toContain("111111");
    expect(otpText("111111", "en")).toContain("Halaqy");
  });
});

describe("verifyCaptcha", () => {
  it("skips when Turnstile is not configured", async () => {
    expect(await verifyCaptcha(null, "1.1.1.1", {})).toEqual({ ok: true, skipped: true });
  });

  it("fails closed when configured and the token is missing or rejected", async () => {
    const env = { TURNSTILE_SECRET_KEY: "s" };
    expect((await verifyCaptcha("", "1.1.1.1", env)).ok).toBe(false);
    const rejected = await verifyCaptcha("tok", "1.1.1.1", env, async () => ({ ok: true, json: async () => ({ success: false }) }));
    expect(rejected.ok).toBe(false);
    const passed = await verifyCaptcha("tok", "1.1.1.1", env, async () => ({ ok: true, json: async () => ({ success: true }) }));
    expect(passed).toEqual({ ok: true, skipped: false });
  });
});

describe("verifyWebhook", () => {
  const secret = `v1,whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
  const key = webhookKey(secret)!;
  const now = 1_800_000_000;

  it("accepts a valid signature and rejects tampering or stale timestamps", () => {
    const body = JSON.stringify({ user: { phone: "962791234567" }, sms: { otp: "123456" } });
    const sig = signWebhook(key, "msg_1", String(now), body);
    const headers = { id: "msg_1", timestamp: String(now), signature: `v1,${sig}` };
    expect(verifyWebhook(body, headers, secret, now)).toBe(true);
    expect(verifyWebhook(body + " ", headers, secret, now)).toBe(false);
    expect(verifyWebhook(body, headers, secret, now + 3600)).toBe(false);
    expect(verifyWebhook(body, { ...headers, signature: "v1,AAAA" }, secret, now)).toBe(false);
    expect(verifyWebhook(body, headers, "", now)).toBe(false);
  });
});
