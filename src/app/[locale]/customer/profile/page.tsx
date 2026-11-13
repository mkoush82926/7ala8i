import { redirect } from "next/navigation";

// /customer/profile → profile editing lives in the Edit Profile dialog on the
// customer dashboard (opened via ?edit=profile).
export default async function CustomerProfileRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/customer?edit=profile`);
}
