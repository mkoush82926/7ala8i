import { redirect } from "next/navigation";

// /customer/shops/[shopId] → the real public shop profile page.
export default async function CustomerShopRedirect({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}) {
  const { locale, shopId } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/shop/${encodeURIComponent(shopId)}`);
}
