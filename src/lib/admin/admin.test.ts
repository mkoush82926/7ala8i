import { describe, expect, it, vi } from "vitest";
import { ADMIN_COPY, adminErrorMessage, auditActionLabel } from "./dictionary";
import { formatCount, formatJodPlain, formatRating, formatRelative, isPast, summarizeDiff } from "./format";
import {
  buildHref,
  isActivePath,
  isUuid,
  offsetFor,
  pageBounds,
  pageCount,
  parseAuditFilters,
  parseClaimStatus,
  parsePage,
  parseReportStatus,
  parseShopFilters,
} from "./params";
import { ADMIN_ERROR_CODES, adminErrorCode, adminRpc } from "./rpc";
import { asPaged, num, parseWhoAmI } from "./types";
import {
  buildPlanPayload,
  checkClaimForm,
  checkReason,
  diffShopForm,
  phoneDigits,
  phoneKey,
  type ShopFormValues,
} from "./validation";

const UUID = "1a000000-0000-4000-8000-0000000000b1";

describe("adminErrorCode", () => {
  it("reads the leading error code raised by the RPC", () => {
    expect(adminErrorCode({ message: "REASON_REQUIRED" })).toBe("REASON_REQUIRED");
    expect(adminErrorCode({ message: "NOT_AUTHORIZED: nope" })).toBe("NOT_AUTHORIZED");
  });
  it("maps privilege and missing-function errors to NOT_AUTHORIZED (so /admin 404s)", () => {
    expect(adminErrorCode({ message: "x", code: "42501" })).toBe("NOT_AUTHORIZED");
    expect(adminErrorCode({ message: "x", code: "PGRST202" })).toBe("NOT_AUTHORIZED");
    expect(adminErrorCode({ message: "permission denied for function admin_whoami" })).toBe("NOT_AUTHORIZED");
  });
  it("detects network failures and falls back to UNKNOWN", () => {
    expect(adminErrorCode(new Error("fetch failed"))).toBe("NETWORK");
    expect(adminErrorCode({ message: "SOMETHING_NEW" })).toBe("UNKNOWN");
    expect(adminErrorCode(null)).toBe("UNKNOWN");
  });
});

describe("adminRpc", () => {
  it("returns data on success and passes args through", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: 1 }, error: null });
    const res = await adminRpc({ rpc }, "admin_overview", { a: 1 });
    expect(rpc).toHaveBeenCalledWith("admin_overview", { a: 1 });
    expect(res).toEqual({ ok: true, data: { ok: 1 } });
  });
  it("returns a code and detail on error, and never throws", async () => {
    const res = await adminRpc(
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "INVALID_INPUT", details: "reason" } }) },
      "admin_set_shop_suspended",
    );
    expect(res).toEqual({ ok: false, code: "INVALID_INPUT", detail: "reason" });
    const thrown = await adminRpc({ rpc: vi.fn().mockRejectedValue(new Error("network down")) }, "x");
    expect(thrown).toEqual({ ok: false, code: "NETWORK", detail: null });
  });
});

describe("dictionary", () => {
  it("has a message for every error code", () => {
    for (const code of ADMIN_ERROR_CODES) expect(adminErrorMessage(code)).toBeTruthy();
  });
  it("labels audit actions and falls back to the raw code", () => {
    expect(auditActionLabel("shop.verify")).toBe(ADMIN_COPY.audit.actions["shop.verify"]);
    expect(auditActionLabel("x.unknown")).toBe("x.unknown");
  });
});

describe("params", () => {
  it("parses shop filters with safe defaults", () => {
    expect(parseShopFilters({ q: "  fade ", status: "bogus", city: "nope", page: "-3" })).toEqual({
      q: "fade",
      status: "all",
      city: null,
      page: 1,
    });
    expect(parseShopFilters({ status: "suspended", city: UUID, page: ["3", "9"] })).toMatchObject({
      status: "suspended",
      city: UUID,
      page: 3,
    });
  });
  it("parses queue statuses", () => {
    expect(parseReportStatus({ status: "dismissed" })).toBe("dismissed");
    expect(parseReportStatus({})).toBe("open");
    expect(parseClaimStatus({ status: "bad" })).toBe("open");
  });
  it("only accepts safe audit filters", () => {
    expect(parseAuditFilters({ action: "shop.verify", type: "shop", target: UUID })).toMatchObject({
      action: "shop.verify",
      type: "shop",
      target: UUID,
    });
    expect(parseAuditFilters({ action: "shop%' OR 1=1", type: "nope" })).toMatchObject({ action: "", type: null });
  });
  it("clamps pages and computes bounds", () => {
    expect(parsePage({ page: "999999" })).toBe(4000);
    expect(offsetFor(3, 25)).toBe(50);
    expect(pageBounds(2, 25, 30)).toEqual({ from: 26, to: 30 });
    expect(pageBounds(5, 25, 30)).toBeNull();
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(51, 25)).toBe(3);
  });
  it("builds short hrefs", () => {
    expect(buildHref("/admin/shops", { q: "", status: "all", page: 1 }, { status: "all" })).toBe("/admin/shops");
    expect(buildHref("/admin/shops", { q: "a b", status: "verified", page: 2 }, { status: "all" })).toBe(
      "/admin/shops?q=a+b&status=verified&page=2",
    );
  });
  it("highlights nav paths by segment", () => {
    expect(isActivePath("/admin", "/admin", true)).toBe(true);
    expect(isActivePath("/admin/shops", "/admin", true)).toBe(false);
    expect(isActivePath("/admin/shops/x", "/admin/shops")).toBe(true);
    expect(isActivePath("/admin/shopsx", "/admin/shops")).toBe(false);
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("x")).toBe(false);
  });
});

describe("types", () => {
  it("only accepts platform roles in whoami", () => {
    expect(parseWhoAmI({ user_id: "u", role: "admin", full_name: "A", impersonation: null })).toEqual({
      user_id: "u",
      role: "admin",
      full_name: "A",
      impersonation: null,
    });
    expect(parseWhoAmI({ user_id: "u", role: "shop_admin" })).toBeNull();
    expect(parseWhoAmI(null)).toBeNull();
  });
  it("coerces jsonb numerics and pages", () => {
    expect(num("4.5")).toBe(4.5);
    expect(num(null, 7)).toBe(7);
    expect(asPaged({ total: "3", rows: null })).toEqual({ total: 3, limit: 25, offset: 0, rows: [] });
  });
});

describe("validation", () => {
  it("checks reasons", () => {
    expect(checkReason("  ")).toEqual({ ok: false, error: "required" });
    expect(checkReason("", { required: false })).toEqual({ ok: true, value: "" });
    expect(checkReason("fraud report")).toEqual({ ok: true, value: "fraud report" });
    expect(checkReason("x".repeat(501)).ok).toBe(false);
  });
  it("normalises phones to the server's ban key", () => {
    expect(phoneDigits("+962 79 123 4567")).toBe("962791234567");
    expect(phoneKey("+962 79 123 4567")).toBe(phoneKey("0791234567"));
    expect(phoneDigits("123")).toBeNull();
  });
  it("builds plan payloads", () => {
    const ok = buildPlanPayload({
      plan_code: "team",
      trial_ends_at: "",
      max_barbers: "5",
      monthly_message_allowance: "1,000",
      note: " promo ",
    });
    expect(ok).toEqual({
      ok: true,
      payload: { plan_code: "team", trial_ends_at: null, max_barbers: 5, monthly_message_allowance: 1000, note: "promo" },
    });
    const bad = buildPlanPayload({
      plan_code: "trial",
      trial_ends_at: "",
      max_barbers: "0",
      monthly_message_allowance: "-1",
      note: "",
    });
    expect(bad).toEqual({ ok: false, errors: ["trial_ends_at", "max_barbers", "monthly_message_allowance"] });
  });
  it("validates the claim form", () => {
    expect(checkClaimForm({ shop_id: "x", claimant_name: "", claimant_phone: "", details: "" })).toEqual(
      expect.arrayContaining(["shop_id", "claimant_name", "details"]),
    );
    expect(checkClaimForm({ shop_id: UUID, claimant_name: "Ali", claimant_phone: "", details: "It is mine" })).toEqual(
      [],
    );
  });
  it("sends only changed shop fields in support sessions", () => {
    const base: ShopFormValues = {
      name: "Fade House",
      name_ar: "",
      description: "",
      description_ar: "",
      address: "",
      is_published: false,
      marketplace_visible: true,
      min_notice_minutes: "5",
      booking_window_days: "90",
    };
    expect(diffShopForm(base, base)).toEqual({ ok: true, patch: {} });
    expect(diffShopForm(base, { ...base, name: " Fade House 2 ", min_notice_minutes: "30" })).toEqual({
      ok: true,
      patch: { name: "Fade House 2", min_notice_minutes: 30 },
    });
    expect(diffShopForm(base, { ...base, name: " ", booking_window_days: "999" })).toEqual({
      ok: false,
      errors: ["name", "booking_window_days"],
    });
  });
});

describe("format", () => {
  it("formats numbers with dashes for empty values", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(null)).toBe(ADMIN_COPY.common.dash);
    expect(formatRating("4.56")).toBe("4.6");
    expect(formatRating(0)).toBe(ADMIN_COPY.common.dash);
    expect(formatJodPlain(2.5)).toBe("2.500");
  });
  it("formats relative times and expiry", () => {
    const now = new Date("2026-11-25T10:00:00Z");
    expect(formatRelative("2026-11-25T07:00:00Z", now)).toBe("3 hours ago");
    expect(isPast("2026-11-25T09:59:00Z", now)).toBe(true);
    expect(isPast("2026-11-25T10:30:00Z", now)).toBe(false);
    expect(isPast(null, now)).toBe(false);
  });
  it("summarises audit diffs field by field", () => {
    expect(summarizeDiff({ before: { name: "A", x: 1 }, after: { name: "B", x: 1 }, session_id: "s" })).toEqual([
      { field: "name", before: "A", after: "B" },
      { field: "session_id", before: "", after: "s" },
    ]);
    expect(summarizeDiff(null)).toEqual([]);
  });
});
