import { redirect } from "next/navigation";

// /customer/bookings → the real destination: the My Appointments dashboard.
export default function CustomerBookingsRedirect() {
  redirect("/customer");
}
