import { redirect } from "next/navigation";

// Permanently redirect /login → /auth/login
export default function LoginRedirect() {
  redirect("/auth/login");
}
