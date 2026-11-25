"use server";

/**
 * Server actions behind every back-office mutation. Each one validates its
 * input, calls one audited admin_* RPC as the signed-in user (the RPC checks
 * platform_role and writes admin_audit_log), then revalidates /admin.
 */
import { revalidatePath } from "next/cache";
import { adminErrorMessage } from "./dictionary";
import { isUuid } from "./params";
import { adminRpc, type AdminErrorCode } from "./rpc";
import { adminClient } from "./server";
import { CLAIM_DECISIONS, type ClaimDecision, type ShopPatch } from "./types";
import {
  WRITE_REASON_MIN,
  buildPlanPayload,
  checkClaimForm,
  checkReason,
  phoneDigits,
  type ClaimFormValues,
  type PlanFormValues,
} from "./validation";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: AdminErrorCode; message: string; detail?: string | null };

function fail(code: AdminErrorCode, detail: string | null = null): ActionResult<never> {
  return { ok: false, code, message: adminErrorMessage(code), detail };
}

async function run<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const client = await adminClient();
  const res = await adminRpc<T>(client, fn, args);
  if (!res.ok) return fail(res.code, res.detail);
  revalidatePath("/admin", "layout");
  return { ok: true, data: res.data };
}

function reasonOrFail(raw: unknown, required: boolean, min?: number) {
  const check = checkReason(typeof raw === "string" ? raw : "", { required, min });
  if (!check.ok) return { error: fail(check.error === "required" ? "REASON_REQUIRED" : "INVALID_INPUT", "reason") };
  return { value: check.value || null };
}

export async function setShopVerified(shopId: string, verified: boolean, reason?: string) {
  if (!isUuid(shopId) || typeof verified !== "boolean") return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, false);
  if (r.error) return r.error;
  return run("admin_set_shop_verified", { p_shop_id: shopId, p_verified: verified, p_reason: r.value });
}

export async function setShopSuspended(shopId: string, suspended: boolean, reason: string) {
  if (!isUuid(shopId) || typeof suspended !== "boolean") return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, true);
  if (r.error) return r.error;
  return run("admin_set_shop_suspended", { p_shop_id: shopId, p_suspended: suspended, p_reason: r.value });
}

export async function setProfileBanned(profileId: string, banned: boolean, reason: string) {
  if (!isUuid(profileId) || typeof banned !== "boolean") return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, true);
  if (r.error) return r.error;
  return run("admin_set_profile_banned", { p_profile_id: profileId, p_banned: banned, p_reason: r.value });
}

export async function setPhoneBanned(phone: string, banned: boolean, reason: string) {
  if (typeof phone !== "string" || !phoneDigits(phone) || typeof banned !== "boolean") {
    return fail("INVALID_INPUT", "phone");
  }
  const r = reasonOrFail(reason, true);
  if (r.error) return r.error;
  return run("admin_set_phone_banned", { p_phone: phone, p_banned: banned, p_reason: r.value });
}

export async function setReviewHidden(reviewId: string, hidden: boolean, reason?: string) {
  if (!isUuid(reviewId) || typeof hidden !== "boolean") return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, hidden);
  if (r.error) return r.error;
  return run("admin_set_review_hidden", { p_review_id: reviewId, p_hidden: hidden, p_reason: r.value });
}

export async function resolveReviewReport(reportId: string, decision: "hide" | "dismiss", note?: string) {
  if (!isUuid(reportId) || (decision !== "hide" && decision !== "dismiss")) return fail("INVALID_INPUT");
  const r = reasonOrFail(note, decision === "hide");
  if (r.error) return r.error;
  return run("admin_resolve_review_report", { p_report_id: reportId, p_decision: decision, p_note: r.value });
}

export async function createClaimDispute(values: ClaimFormValues) {
  if (!values || checkClaimForm(values).length) return fail("INVALID_INPUT");
  return run<{ id: string }>("admin_create_claim_dispute", {
    p_shop_id: values.shop_id.trim(),
    p_claimant_name: values.claimant_name.trim(),
    p_claimant_phone: values.claimant_phone.trim() || null,
    p_details: values.details.trim(),
  });
}

export async function resolveClaimDispute(id: string, decision: ClaimDecision, note: string) {
  if (!isUuid(id) || !(CLAIM_DECISIONS as readonly string[]).includes(decision)) return fail("INVALID_INPUT");
  const r = reasonOrFail(note, true);
  if (r.error) return r.error;
  return run("admin_resolve_claim_dispute", { p_id: id, p_decision: decision, p_note: r.value });
}

export async function setPlanOverride(shopId: string, values: PlanFormValues | null, reason: string) {
  if (!isUuid(shopId)) return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, true);
  if (r.error) return r.error;
  if (values === null) {
    return run("admin_set_plan_override", { p_shop_id: shopId, p_plan: null, p_reason: r.value });
  }
  const built = buildPlanPayload(values);
  if (!built.ok) return fail("INVALID_INPUT", built.errors.join(","));
  return run("admin_set_plan_override", { p_shop_id: shopId, p_plan: built.payload, p_reason: r.value });
}

export async function startImpersonation(shopId: string, mode: "read" | "write", reason?: string) {
  if (!isUuid(shopId) || (mode !== "read" && mode !== "write")) return fail("INVALID_INPUT");
  const r = reasonOrFail(reason, mode === "write", WRITE_REASON_MIN);
  if (r.error) return r.error;
  return run<{ id: string; expires_at: string }>("admin_start_impersonation", {
    p_shop_id: shopId,
    p_mode: mode,
    p_reason: r.value,
  });
}

export async function stopImpersonation(sessionId: string) {
  if (!isUuid(sessionId)) return fail("INVALID_INPUT");
  return run("admin_stop_impersonation", { p_session_id: sessionId });
}

export async function impersonationUpdateShop(sessionId: string, patch: ShopPatch) {
  if (!isUuid(sessionId) || !patch || typeof patch !== "object" || Object.keys(patch).length === 0) {
    return fail("INVALID_INPUT");
  }
  return run("admin_impersonation_update_shop", { p_session_id: sessionId, p_patch: patch });
}

export async function impersonationSetServiceActive(sessionId: string, serviceId: string, active: boolean) {
  if (!isUuid(sessionId) || !isUuid(serviceId) || typeof active !== "boolean") return fail("INVALID_INPUT");
  return run("admin_impersonation_set_service_active", {
    p_session_id: sessionId,
    p_service_id: serviceId,
    p_active: active,
  });
}

export async function searchProfiles(q: string) {
  const query = typeof q === "string" ? q.trim() : "";
  if (query.length < 2 || query.length > 100) return fail("INVALID_INPUT", "q");
  const client = await adminClient();
  const res = await adminRpc<unknown[]>(client, "admin_search_profiles", { p_q: query, p_limit: 20 });
  if (!res.ok) return fail(res.code, res.detail);
  return { ok: true as const, data: Array.isArray(res.data) ? res.data : [] };
}
