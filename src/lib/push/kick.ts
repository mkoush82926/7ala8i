// Server-only helper for API routes that just changed an appointment
// (booking, cancel, reschedule, walk-in, waitlist): drain the staff outbox
// after the response is sent, so the barber's phone buzzes within seconds
// even where the pg_net kick is not configured.
//
//   import { schedulePushDispatch } from "@/lib/push/kick";
//   schedulePushDispatch();   // fire-and-forget, never throws
import { after } from "next/server";
import { readPushConfig } from "./config";
import { dispatchStaffPush } from "./dispatch";

export function schedulePushDispatch(): void {
  const cfg = readPushConfig();
  if (!cfg.dispatchConfigured) return;
  const run = () => dispatchStaffPush({ config: cfg, maxBatches: 2 }).then(() => undefined);
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts/tests): run detached.
    void run().catch(() => undefined);
  }
}
