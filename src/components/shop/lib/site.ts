/** Absolute site origin for canonical URLs and JSON-LD (server side). */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
    env.VERCEL_URL && `https://${env.VERCEL_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // try the next candidate
    }
  }
  return `http://localhost:${env.PORT ?? 3000}`;
}
