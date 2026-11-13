"use client";

// Cloudflare Turnstile (explicit render). Only mounted when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are both set.
// Remount with a new `key` to get a fresh token after a failed attempt.

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  scriptPromise ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(w.turnstile ?? null);
    s.onerror = () => {
      scriptPromise = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey, locale, onToken, label,
}: { siteKey: string; locale: string; onToken: (token: string | null) => void; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);

  useEffect(() => {
    let id: string | null = null;
    let api: TurnstileApi | null = null;
    let cancelled = false;
    loadTurnstile().then((t) => {
      if (cancelled || !t || !ref.current) return;
      api = t;
      id = t.render(ref.current, {
        sitekey: siteKey,
        language: locale === "ar" ? "ar" : "en",
        theme: "auto",
        size: "flexible",
        callback: (token: string) => cb.current(token),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    });
    return () => {
      cancelled = true;
      if (api && id) api.remove(id);
    };
  }, [siteKey, locale]);

  return <div ref={ref} aria-label={label} style={{ minHeight: 65 }} />;
}
