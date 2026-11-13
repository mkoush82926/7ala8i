// Next.js instrumentation hook — server-side error observability.
//
// `onRequestError` runs for every uncaught error thrown while rendering a
// Server Component, a Route Handler, a Server Action or middleware, in both
// the Node.js and Edge runtimes. We emit ONE structured JSON line per error so
// log drains (Vercel, Datadog, Logtail…) can index it, and so the `digest`
// shown to users on the error pages can be matched to the full stack trace.
//
// Keep this file dependency-free: it is bundled for the Edge runtime too.

type RequestErrorContext = {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware" | "proxy";
  renderSource?: string;
  revalidateReason?: "on-demand" | "stale" | undefined;
  renderType?: "dynamic" | "dynamic-resume";
};

type RequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

/** Strip query strings (they may carry tokens, e.g. invite links) from logged paths. */
function safePath(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : `${path.slice(0, q)}?…`;
}

function headerValue(headers: RequestInfo["headers"], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function register() {
  // No SDK to initialise yet. Plug Sentry/OpenTelemetry in here when added.
}

export async function onRequestError(error: unknown, request: RequestInfo, context: RequestErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (err as Error & { digest?: string }).digest;

  // Next's own control-flow signals (notFound/redirect/dynamic bailout) are
  // not real failures.
  if (typeof digest === "string" && /^(NEXT_NOT_FOUND|NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) {
    return;
  }

  const entry = {
    level: "error",
    msg: "request_error",
    time: new Date().toISOString(),
    digest,
    requestId: headerValue(request.headers, "x-request-id") ?? headerValue(request.headers, "x-vercel-id"),
    method: request.method,
    path: safePath(request.path),
    route: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 15).join("\n"),
    },
  };

  try {
    console.error(JSON.stringify(entry));
  } catch {
    console.error("[request_error]", entry.route, entry.digest, err.message);
  }
}
