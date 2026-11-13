import { redirect } from "next/navigation";

// /customer/shops/[shopId]/book → /book/[shopId] (server redirect, no spinner flash).
export default async function CustomerBookRedirect({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}) {
  const { locale, shopId } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/book/${encodeURIComponent(shopId)}`);
}
