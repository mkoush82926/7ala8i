import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Lumina",
  description: "Sign in to your Lumina barbershop management dashboard.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
