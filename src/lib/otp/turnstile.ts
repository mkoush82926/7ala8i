// Cloudflare Turnstile server-side verification. Server only.
import { turnstileSecret, type OtpEnv } from "./config";

export interface CaptchaResult {
  ok: boolean;
  /** True when Turnstile is not configured (the check was skipped). */
  skipped: boolean;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyCaptcha(
  token: string | null | undefined,
  ip: string | null | undefined,
  env: OtpEnv,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<CaptchaResult> {
  const secret = turnstileSecret(env);
  if (!secret) return { ok: true, skipped: true };
  const value = (token ?? "").trim();
  if (!value || value.length > 2048) return { ok: false, skipped: false };

  const form = new URLSearchParams({ secret, response: value });
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) return { ok: false, skipped: false };
    const data = (await res.json()) as { success?: unknown } | null;
    return { ok: data?.success === true, skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}
