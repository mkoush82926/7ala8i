import { redirect } from "next/navigation";

/**
 * /[locale]/book without a shop used to book into whichever shop the
 * database returned first. A booking always needs a shop, so send people to
 * Explore to pick one.
 */
export default async function BookingIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/explore`);
}
