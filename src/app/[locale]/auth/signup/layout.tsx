import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account — Halaqy",
  description: "Create your Halaqy account and start managing your barbershop.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
