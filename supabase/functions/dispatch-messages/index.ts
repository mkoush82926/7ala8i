// ═══════════════════════════════════════════════════════════════════════════
// Supabase Edge Function: dispatch-messages (WS-1C).
//
// Runs every minute and triggers one dispatcher pass in the app
// (POST /api/messaging/dispatch), where the provider adapters, templates and
// rules live next to their tests. Keeping the sending logic in one place
// means the Edge Function and any other cron (Vercel) behave identically.
//
// Secrets (supabase secrets set …):
//   MESSAGING_DISPATCH_URL   https://<site>/api/messaging/dispatch
//   MESSAGING_CRON_SECRET    same value as the app's MESSAGING_CRON_SECRET
//
// Schedule (SQL editor, once; needs pg_cron + pg_net):
//   select cron.schedule('dispatch-messages', '* * * * *', $$
//     select net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/dispatch-messages',
//       headers := jsonb_build_object('Authorization', 'Bearer <anon or service key>')
//     );
//   $$);
//
// Without the secrets the function answers 200 {skipped:true}: nothing is
// sent, the outbox keeps filling and the dashboard shows wa.me links.
// ═══════════════════════════════════════════════════════════════════════════

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handler(_req: Request, env: (name: string) => string | undefined = (n) => Deno.env.get(n)): Promise<Response> {
  const url = (env("MESSAGING_DISPATCH_URL") ?? "").trim();
  const secret = (env("MESSAGING_CRON_SECRET") ?? "").trim();
  if (!url || !secret) return json({ ok: true, skipped: true, reason: "NOT_CONFIGURED" });
  if (!/^https?:\/\//.test(url)) return json({ ok: false, reason: "BAD_URL" }, 500);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: "{}",
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    return json({ ok: res.ok, status: res.status, result: body }, res.ok ? 200 : 502);
  } catch {
    return json({ ok: false, reason: "UNREACHABLE" }, 502);
  } finally {
    clearTimeout(timer);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((req) => handler(req));
}
