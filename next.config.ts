import type { NextConfig } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// Security headers
//
// next.config is evaluated at build/start time, so the Supabase origin is read
// from NEXT_PUBLIC_SUPABASE_URL here (the same value Next inlines into the
// client bundle). We deliberately do NOT import src/lib/env.ts: its fail-fast
// validation would break CI builds that run without secrets.
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): { http: string[]; ws: string[]; secure: boolean } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const wsOrigin = url.origin.replace(/^http/, "ws");
      return { http: [url.origin], ws: [wsOrigin], secure: url.protocol === "https:" };
    } catch {
      // Fall through to the generic hosted-Supabase allowance below.
    }
  }
  // URL unset (e.g. mock preview or a CI build without secrets): allow hosted
  // Supabase projects so the page still works once the env is provided at
  // runtime by a platform that re-evaluates the config.
  return { http: ["https://*.supabase.co"], ws: ["wss://*.supabase.co"], secure: true };
}

const supa = supabaseOrigins();

// Local Supabase (`supabase start`) during development only.
const localSupabase = isDev
  ? ["http://127.0.0.1:54321", "http://localhost:54321", "ws://127.0.0.1:54321", "ws://localhost:54321"]
  : [];

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts (and the layout's no-flash theme
  // script), so 'unsafe-inline' stays until a nonce-based CSP is adopted.
  // 'unsafe-eval' is only needed by React Refresh in development.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  `connect-src ${["'self'", ...supa.http, ...supa.ws, ...localSupabase].join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  // Only upgrade when the backend itself is HTTPS — a production build run
  // against local Supabase (e2e) must keep plain-http requests working.
  ...(!isDev && supa.secure ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Browsers ignore HSTS over plain http, so this is safe for local
  // `next start`; it matters on custom domains (Vercel already sends it on
  // *.vercel.app).
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  ];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (!url.hostname.endsWith(".supabase.co")) {
        patterns.push({
          protocol: url.protocol === "http:" ? "http" : "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
          pathname: "/storage/v1/object/public/**",
        });
      }
    } catch {
      // ignore malformed URL — env validation reports it at runtime
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseImagePatterns(),
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Ambient landing videos and their posters never change in place.
        source: "/videos/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
