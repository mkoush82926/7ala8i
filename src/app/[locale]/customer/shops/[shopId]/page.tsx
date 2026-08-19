import { redirect } from "next/navigation";

// /customer/shops/[shopId] → the real public shop profile page.
export default async function CustomerShopRedirect({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  redirect(`/shop/${shopId}`);
}
