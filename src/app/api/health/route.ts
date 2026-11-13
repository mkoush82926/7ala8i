import { NextResponse, type NextRequest } from "next/server";
import { MOCK_MODE, publicEnv } from "@/lib/env";

// Liveness/readiness probe for uptime monitors and load balancers.
//   GET /api/health          → 200 {status:"ok"}           (process is up)
//   GET /api/health?deep=1   → also checks Supabase; 503 {status:"degraded"} when unreachable
// Responses never include secrets, hostnames or error details.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 3000;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

type DbStatus = "up" | "down" | "skipped";

async function checkDatabase(): Promise<{ db: DbStatus; latencyMs?: number }> {
  if (MOCK_MODE) return { db: "skipped" };
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return { db: "down" };

  const started = Date.now();
  try {
    // Cheapest anon-readable query (shops is publicly listable via RLS).
    const url = new URL("/rest/v1/shops", publicEnv.supabaseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: {
        apikey: publicEnv.supabaseAnonKey,
        Authorization: `Bearer ${publicEnv.supabaseAnonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(DB_TIMEOUT_MS),
    });
    return { db: res.ok ? "up" : "down", latencyMs: Date.now() - started };
  } catch {
    return { db: "down", latencyMs: Date.now() - started };
  }
}

function version(): string {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 12);
}

export async function GET(request: NextRequest) {
  const deepParam = request.nextUrl.searchParams.get("deep");
  const deep = deepParam === "1" || deepParam === "true";
  const base = { version: version(), time: new Date().toISOString() };

  if (!deep) {
    return NextResponse.json({ status: "ok", ...base }, { status: 200, headers: NO_STORE });
  }

  const { db, latencyMs } = await checkDatabase();
  const healthy = db !== "down";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", db, ...(latencyMs !== undefined ? { latencyMs } : {}), ...base },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
