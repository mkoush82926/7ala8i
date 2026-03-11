import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Appointments — Lumina",
  description: "View and manage your barbershop appointments.",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      {children}
    </div>
  );
}
