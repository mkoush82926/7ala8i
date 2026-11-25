"use client";

// Mobile bottom navigation shared by the customer portal pages.
import Link from "next/link";
import { CalendarCheck, Compass, UserRound } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export type CustomerNavKey = "explore" | "bookings" | "account";

export function CustomerBottomNav({ active }: { active: CustomerNavKey }) {
  const { t, href } = useTranslation();
  const items: { key: CustomerNavKey; href: string; label: string; icon: typeof Compass }[] = [
    { key: "explore", href: href("/explore"), label: t.customer.explore, icon: Compass },
    { key: "bookings", href: href("/customer"), label: t.explore.navBookings, icon: CalendarCheck },
    { key: "account", href: href("/customer/account"), label: t.explore.navAccount, icon: UserRound },
  ];
  return (
    <nav
      aria-label={t.customer.accountNav}
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around items-center px-4 pt-2.5 bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {items.map(({ key, href: to, label, icon: Icon }) => {
        const current = key === active;
        return (
          <Link
            key={key}
            href={to}
            aria-current={current ? "page" : undefined}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-1 text-[11px] font-bold rounded-[8px] ${
              current ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {current ? (
              <span aria-hidden="true" className="w-10 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                <Icon size={19} />
              </span>
            ) : (
              <Icon size={21} aria-hidden="true" />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
