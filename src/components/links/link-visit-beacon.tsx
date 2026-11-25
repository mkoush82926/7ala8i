"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { visitKey } from "./link-utils";

/**
 * Records one branded-link visit per tab session and channel
 * (record_link_visit RPC: anon, rate limited, fire-and-forget). Renders
 * nothing; any failure is silent so the booking flow is never affected.
 */
export function LinkVisitBeacon({ shopId, src, entry }: { shopId: string; src: string | null; entry: string | null }) {
  useEffect(() => {
    if (MOCK_DATA_ENABLED || !shopId) return;
    // Link-preview crawlers (WhatsApp, Instagram, Facebook) are not visitors.
    if (typeof navigator !== "undefined" && /bot|crawl|spider|preview/i.test(navigator.userAgent)) return;
    const key = visitKey(shopId, src);
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode): still count this view once per mount.
    }
    void (async () => {
      try {
        await createClient().rpc("record_link_visit" as never, { p_shop_id: shopId, p_src: src, p_entry: entry } as never);
      } catch {
        // Beacon only.
      }
    })();
  }, [shopId, src, entry]);
  return null;
}
