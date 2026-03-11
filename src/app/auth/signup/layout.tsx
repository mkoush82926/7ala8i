import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account — Lumina",
  description: "Create your Lumina account and start managing your barbershop.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
