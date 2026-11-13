import { redirect } from "next/navigation";

// /customer/bookings → the real destination: the My Appointments dashboard.
export default async function CustomerBookingsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale === "ar" ? "ar" : "en"}/customer`);
}
