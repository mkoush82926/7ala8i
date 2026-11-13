import { permanentRedirect } from "next/navigation";

/**
 * Short booking link shared on WhatsApp and printed on the QR poster
 * (/{locale}/b/{slug}). It always lands on the shop page, which resolves the
 * slug (or UUID), redirects to the canonical URL and 404s unknown shops.
 */
export default async function ShortShopLink({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const loc = locale === "ar" ? "ar" : "en";
  permanentRedirect(`/${loc}/shop/${encodeURIComponent(decodeSafe(slug))}`);
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
