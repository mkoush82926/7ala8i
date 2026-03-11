import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book an Appointment — Lumina",
  description: "Book your next barbershop appointment online. Choose your services, barber, and preferred time.",
  openGraph: {
    title: "Book an Appointment — Lumina",
    description: "Book your next barbershop appointment online.",
    type: "website",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
