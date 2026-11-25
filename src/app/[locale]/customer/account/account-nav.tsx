"use client";

// Mobile bottom tab bar shared by the customer portal pages (v2 §5.10 grammar).
import Link from "next/link";
import { CalendarCheck, Compass, UserRound } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-bar backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
    >
      <ul className="m-0 grid h-16 list-none grid-cols-3 p-0">
        {items.map(({ key, href: to, label, icon: Icon }) => {
          const current = key === active;
          return (
            <li key={key} className="flex">
              <Link
                href={to}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-muted no-underline transition-colors duration-150",
                  "hover:text-ink aria-[current=page]:text-brand-text",
                  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-150",
                    current && "bg-brand-soft",
                  )}
                >
                  <Icon size={20} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
