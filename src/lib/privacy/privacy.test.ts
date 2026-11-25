import { describe, expect, it, vi } from "vitest";
import {
  csvCell,
  diffAccount,
  exportFileName,
  exportSections,
  exportToCsv,
  isMissingRpc,
  isSyntheticEmail,
  latestConsents,
  normalizeFullName,
  normalizeOtpCode,
  parseAccount,
  phoneLoginEnabled,
  privacyErrorCode,
  safeCustomerNext,
  summarizeExport,
  syntheticEmailFor,
  toPhoneLoginError,
  totalExportRows,
  type ConsentRecord,
} from "./index";
import { completePhoneLogin, type PhoneLoginAdmin } from "./phone-login";

const RAW_ACCOUNT = {
  id: "u1",
  role: "customer",
  full_name: "Omar",
  phone: "+962791234567",
  email: "p962791234567@phone.halaqy.invalid",
  preferred_language: "ar",
  digit_preference: "arab",
  notify_reminders: false,
  notify_channel: "sms",
  marketing_opt_in: true,
  verified_phones: [{ phone: "962791234567", method: "hook_otp", verified_at: "2026-11-01T10:00:00Z" }],
  linked_shops: [{ shop_id: "s1", shop_name: "Chair", shop_name_ar: "الكرسي", slug: "chair", visits: 3 }],
  consents: [
    { purpose: "marketing", channel: "sms", granted: true, source: "account", created_at: "2026-11-02T00:00:00Z" },
    { purpose: "bogus", granted: true },
  ],
};

describe("parseAccount", () => {
  it("parses the RPC payload and hides placeholder emails", () => {
    const a = parseAccount(RAW_ACCOUNT)!;
    expect(a.email).toBeNull();
    expect(a.preferredLanguage).toBe("ar");
    expect(a.digitPreference).toBe("arab");
    expect(a.notifyChannel).toBe("sms");
    expect(a.notifyReminders).toBe(false);
    expect(a.linkedShops[0]).toMatchObject({ shopId: "s1", visits: 3, shopNameAr: "الكرسي" });
    expect(a.consents).toHaveLength(1);
  });

  it("falls back to safe defaults", () => {
    const a = parseAccount({ id: "u2", notify_channel: "pigeon", digit_preference: "x" })!;
    expect(a).toMatchObject({ notifyChannel: "whatsapp", digitPreference: "auto", notifyReminders: true, marketingOptIn: false });
    expect(parseAccount(null)).toBeNull();
    expect(parseAccount({})).toBeNull();
    expect(parseAccount([])).toBeNull();
  });
});

describe("diffAccount", () => {
  const base = parseAccount(RAW_ACCOUNT)!;
  it("returns only changed fields", () => {
    expect(diffAccount(base, { fullName: "  Omar  ", digitPreference: "arab" })).toEqual({});
    expect(diffAccount(base, { fullName: "Omar  Ali", notifyChannel: "whatsapp", phone: "" })).toEqual({
      full_name: "Omar Ali",
      notify_channel: "whatsapp",
      phone: null,
    });
    expect(diffAccount(base, { preferredLanguage: null, marketingOptIn: false })).toEqual({
      preferred_language: null,
      marketing_opt_in: false,
    });
  });
});

describe("latestConsents", () => {
  it("keeps the newest record per purpose and channel", () => {
    const rows: ConsentRecord[] = [
      { purpose: "marketing", channel: "sms", granted: true, source: "account", policyVersion: null, createdAt: "2026-01-01" },
      { purpose: "marketing", channel: "sms", granted: false, source: "account", policyVersion: null, createdAt: "2026-02-01" },
      { purpose: "marketing", channel: "whatsapp", granted: true, source: "account", policyVersion: null, createdAt: "2026-01-15" },
      { purpose: "terms", channel: null, granted: true, source: "signup", policyVersion: "v1", createdAt: "2026-01-01" },
    ];
    const latest = latestConsents(rows);
    expect(latest).toHaveLength(3);
    expect(latest.find((r) => r.channel === "sms")?.granted).toBe(false);
  });
});

describe("synthetic emails", () => {
  it("builds and recognises placeholder addresses", () => {
    expect(syntheticEmailFor("962791234567")).toBe("p962791234567@phone.halaqy.invalid");
    expect(isSyntheticEmail("P962@PHONE.HALAQY.INVALID")).toBe(true);
    expect(isSyntheticEmail("me@example.com")).toBe(false);
    expect(() => syntheticEmailFor("123")).toThrow();
  });
});

describe("errors", () => {
  it("extracts codes and detects a missing RPC", () => {
    expect(privacyErrorCode({ message: "RATE_LIMITED" })).toBe("RATE_LIMITED");
    expect(privacyErrorCode({ message: "something broke" })).toBeNull();
    expect(isMissingRpc({ code: "PGRST202", message: "" })).toBe(true);
    expect(isMissingRpc({ message: "Could not find the function public.get_my_account" })).toBe(true);
    expect(isMissingRpc({ code: "P0001", message: "NOT_FOUND" })).toBe(false);
    expect(toPhoneLoginError("OTP_EXPIRED")).toBe("OTP_EXPIRED");
    expect(toPhoneLoginError("weird")).toBe("LOGIN_FAILED");
  });
});

describe("login helpers", () => {
  it("normalises names and Arabic-Indic codes", () => {
    expect(normalizeFullName("  a ")).toBeNull();
    expect(normalizeFullName(" Omar   Ali ")).toBe("Omar Ali");
    expect(normalizeOtpCode("١٢٣ ٤٥٦٧")).toBe("123456");
    expect(normalizeOtpCode("۱۲۳456")).toBe("123456");
  });

  it("only enables phone login when an OTP mode is set", () => {
    expect(phoneLoginEnabled("off")).toBe(false);
    expect(phoneLoginEnabled("supabase")).toBe(true);
    expect(phoneLoginEnabled("hook")).toBe(true);
  });

  it("accepts only safe customer destinations", () => {
    expect(safeCustomerNext("/ar/customer/abc", "ar")).toBe("/ar/customer/abc");
    expect(safeCustomerNext("/book/shop-1?service=x", "en")).toBe("/en/book/shop-1?service=x");
    expect(safeCustomerNext("https://evil.test", "en")).toBe("/en/customer");
    expect(safeCustomerNext("//evil.test", "en")).toBe("/en/customer");
    expect(safeCustomerNext("/en/settings", "en")).toBe("/en/customer");
    expect(safeCustomerNext("/en/bookmarks", "en")).toBe("/en/customer");
    expect(safeCustomerNext(null, "ar")).toBe("/ar/customer");
  });
});

describe("export", () => {
  const data = {
    format: "halaqy.export.v1",
    generated_at: "2026-11-13T00:00:00Z",
    zeta: [],
    appointments: [{ id: "a1", client_name: "عمر, \"Al\"", notes: null }],
    profile: { id: "u1", full_name: "=cmd()" },
  };

  it("orders sections and counts rows", () => {
    expect(exportSections(data)).toEqual(["profile", "appointments", "zeta"]);
    expect(summarizeExport(data)).toEqual([
      { section: "profile", rows: 1 },
      { section: "appointments", rows: 1 },
      { section: "zeta", rows: 0 },
    ]);
    expect(totalExportRows(data)).toBe(2);
  });

  it("writes a long-format CSV with BOM, quoting and formula guard", () => {
    const csv = exportToCsv(data);
    expect(csv.startsWith("﻿section,row,field,value\r\n")).toBe(true);
    expect(csv).toContain('appointments,1,client_name,"عمر, ""Al"""');
    expect(csv).toContain("profile,1,full_name,'=cmd()");
    expect(csv).toContain("appointments,1,notes,\r\n");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("names files by date", () => {
    expect(exportFileName("csv", new Date("2026-11-13T12:00:00Z"))).toBe("halaqy-my-data-2026-11-13.csv");
  });
});

function fakeAdmin(overrides: Partial<Record<string, { data: unknown; error: { message?: string } | null }>> = {}) {
  const calls: { fn: string; args: unknown }[] = [];
  const admin: PhoneLoginAdmin & { calls: typeof calls } = {
    calls,
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return overrides[fn] ?? { data: fn === "customer_attach_verified_phone" ? { linked: 2 } : {}, error: null };
    }),
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ data: { user: { id: "new-user" } }, error: null })),
        updateUserById: vi.fn(async () => ({ error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: "hash" } }, error: null })),
      },
    },
  };
  return admin;
}

describe("completePhoneLogin", () => {
  it("creates a customer for a new phone and links guest bookings", async () => {
    const admin = fakeAdmin();
    const res = await completePhoneLogin(admin, { phone: "0791234567", token: "tok", fullName: "Omar" });
    expect(res).toEqual({ ok: true, tokenHash: "hash", userId: "new-user", isNew: true, linked: 2 });
    expect(admin.calls[0]).toEqual({ fn: "customer_phone_login_resolve", args: { p_token: "tok", p_phone: "962791234567" } });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "p962791234567@phone.halaqy.invalid", phone: "+962791234567" }),
    );
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "p962791234567@phone.halaqy.invalid" });
  });

  it("uses a masked phone as the name until the customer sets one", async () => {
    const admin = fakeAdmin();
    const res = await completePhoneLogin(admin, { phone: "0791234567", token: "tok", fullName: " " });
    expect(res.ok).toBe(true);
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ user_metadata: { full_name: "+962 7•• ••• 567", role: "customer" } }),
    );
  });

  it("signs an existing customer in with their real email", async () => {
    const admin = fakeAdmin({
      customer_phone_login_resolve: { data: { user_id: "u1", email: "me@example.com", role: "customer" }, error: null },
    });
    const res = await completePhoneLogin(admin, { phone: "+962 79 123 4567", token: "tok" });
    expect(res).toMatchObject({ ok: true, userId: "u1", isNew: false });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "me@example.com" });
  });

  it("gives a phone-only account a placeholder email", async () => {
    const admin = fakeAdmin({
      customer_phone_login_resolve: { data: { user_id: "u1", email: null, role: "customer" }, error: null },
    });
    await completePhoneLogin(admin, { phone: "0791234567", token: "tok" });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith("u1", {
      email: "p962791234567@phone.halaqy.invalid",
      email_confirm: true,
    });
  });

  it("refuses staff and bad tokens", async () => {
    const staff = fakeAdmin({
      customer_phone_login_resolve: { data: { user_id: "s1", email: "boss@shop.jo", role: "shop_admin" }, error: null },
    });
    expect(await completePhoneLogin(staff, { phone: "0791234567", token: "tok" })).toEqual({ ok: false, code: "NOT_CUSTOMER" });
    expect(staff.auth.admin.generateLink).not.toHaveBeenCalled();

    const bad = fakeAdmin({ customer_phone_login_resolve: { data: null, error: { message: "OTP_INVALID" } } });
    expect(await completePhoneLogin(bad, { phone: "0791234567", token: "tok" })).toEqual({ ok: false, code: "OTP_INVALID" });
    expect(await completePhoneLogin(bad, { phone: "12", token: "tok" })).toEqual({ ok: false, code: "INVALID_PHONE" });
    expect(await completePhoneLogin(bad, { phone: "0791234567", token: "" })).toEqual({ ok: false, code: "OTP_INVALID" });
  });

  it("retries account creation without the phone when it is taken", async () => {
    const admin = fakeAdmin();
    (admin.auth.admin.createUser as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: null }, error: { message: "phone exists" } });
    const res = await completePhoneLogin(admin, { phone: "0791234567", token: "tok", fullName: "Omar" });
    expect(res.ok).toBe(true);
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(2);
  });
});
