import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Halaqy",
  description: "Sign in to your Halaqy barbershop management dashboard.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
