import { redirect } from "next/navigation";

// /customer/explore → the public explore directory (one implementation, one URL).
export default async function CustomerExploreRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/explore`);
}
