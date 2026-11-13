import type { MetadataRoute } from "next";

function siteOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // try the next candidate
    }
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Signed-in areas (route groups don't appear in URLs, so list each path). */
const PRIVATE_PATHS = [
  "analytics",
  "calendar",
  "clients",
  "leads",
  "my-day",
  "services",
  "settings",
  "team",
  "customer",
  "join",
  "auth/callback",
  "auth/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  // Only the canonical production deployment should be indexed; previews and
  // local builds are excluded entirely.
  const indexable =
    process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";

  if (!indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/en/", "/ar/"],
        disallow: [
          "/api/",
          ...["en", "ar"].flatMap((locale) => PRIVATE_PATHS.map((p) => `/${locale}/${p}`)),
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
