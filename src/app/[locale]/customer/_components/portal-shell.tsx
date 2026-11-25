"use client";

// Customer portal chrome (Design System v2 §6.9): marketplace-style top nav,
// a sticky profile mini-card + vertical nav on desktop, and a bottom tab bar
// on phones. Shared by /customer (bookings) and /customer/account.

import React from "react";
import Link from "next/link";
import { CalendarDays, Compass, LogOut, UserRound } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { Wordmark } from "@/components/search/site-footer";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { shopInitials } from "../../shop/shop-utils";
import { CustomerBottomNav, type CustomerNavKey } from "../account/account-nav";

export interface PortalProfile {
  name?: string | null;
  /** Second line under the name (email or masked phone). */
  detail?: string | null;
  loading?: boolean;
}

export interface PortalSectionLink {
  href: string;
  label: string;
}

const NAV_ITEM = cn(
  "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-soft no-underline",
  "transition-colors duration-150 ease-standard hover:bg-sunken hover:text-ink [&_svg]:size-5 [&_svg]:shrink-0",
  "aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-pressed dark:aria-[current=page]:text-brand-text [&[aria-current=page]_svg]:text-brand-text",
  focusRing,
);

export function PortalShell({
  active,
  profile,
  onSignOut,
  sectionLinks,
  children,
}: {
  active: Exclude<CustomerNavKey, "explore">;
  profile: PortalProfile;
  /** Shows "Sign out" in the sidebar (and as an icon in the mobile top bar). */
  onSignOut?: () => void;
  /** In-page anchors listed under the active item (account sections). */
  sectionLinks?: PortalSectionLink[];
  children: React.ReactNode;
}) {
  const { t, dir, FF, href } = useTranslation();
  const displayName = profile.name?.trim() || profile.detail || "";
  const initials = shopInitials(displayName || "U");

  const items: { key: CustomerNavKey; href: string; label: string; icon: typeof Compass }[] = [
    { key: "bookings", href: href("/customer"), label: t.customer.myAppointments, icon: CalendarDays },
    { key: "account", href: href("/customer/account"), label: t.customerAccount.navLabel, icon: UserRound },
    { key: "explore", href: href("/explore"), label: t.customer.discoverShops, icon: Compass },
  ];

  return (
    <div dir={dir} className="min-h-dvh bg-page text-ink" style={{ fontFamily: FF }}>
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>

      <header className="sticky top-0 z-40 h-16 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href={href("/landing")} className={cn("rounded-md no-underline", focusRing)}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Link href={href("/explore")} className={buttonClasses({ variant: "primary", size: "sm" })}>
              <Compass aria-hidden="true" className="hidden sm:block" />
              {t.customer.bookNow}
            </Link>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label={t.customer.signOut}
                className={buttonClasses({ variant: "ghost", size: "icon", className: "lg:hidden" })}
              >
                <LogOut aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-16 lg:pt-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 shadow-card">
              {profile.loading && !displayName ? (
                <SkeletonGroup className="flex w-full items-center gap-3">
                  <Skeleton variant="avatar" className="size-14" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </SkeletonGroup>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="bg-hatch-ink grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand-pressed dark:text-brand-text"
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[15px] font-semibold text-ink">{displayName}</p>
                    {profile.detail && profile.detail !== displayName && (
                      <p dir="auto" className="m-0 mt-0.5 truncate text-[13px] text-ink-muted">
                        {profile.detail}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <nav aria-label={t.customer.accountNav} className="space-y-0.5">
              {items.map(({ key, href: to, label, icon: Icon }) => (
                <React.Fragment key={key}>
                  <Link href={to} aria-current={key === active ? "page" : undefined} className={NAV_ITEM}>
                    <Icon aria-hidden="true" />
                    <span className="min-w-0 truncate">{label}</span>
                  </Link>
                  {key === active && sectionLinks && sectionLinks.length > 0 && (
                    <ul className="my-1 ms-[22px] space-y-0.5 border-s border-line ps-3">
                      {sectionLinks.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            className={cn(
                              "block rounded-md px-2 py-1.5 text-[13px] text-ink-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-ink",
                              focusRing,
                            )}
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </React.Fragment>
              ))}
              {onSignOut && (
                <div className="mt-3 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className={cn(NAV_ITEM, "w-full cursor-pointer border-0 bg-transparent text-start text-danger-text hover:bg-danger-soft hover:text-danger-text")}
                  >
                    <LogOut aria-hidden="true" />
                    {t.customer.signOut}
                  </button>
                </div>
              )}
            </nav>
          </div>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </div>

      <CustomerBottomNav active={active} />
    </div>
  );
}
