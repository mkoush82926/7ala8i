import { redirect } from "next/navigation";

// Permanently redirect /signup → /auth/signup
export default function SignupRedirect() {
  redirect("/auth/signup");
}
