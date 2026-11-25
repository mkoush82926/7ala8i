import { redirect } from "next/navigation";

// /customer/profile → the account hub (profile, preferences, privacy).
export default async function CustomerProfileRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/customer/account`);
}
