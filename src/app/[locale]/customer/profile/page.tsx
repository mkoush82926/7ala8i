import { redirect } from "next/navigation";

// /customer/profile → profile editing lives in the Edit Profile modal on the
// main customer dashboard, not a separate page.
export default function CustomerProfileRedirect() {
  redirect("/customer");
}
