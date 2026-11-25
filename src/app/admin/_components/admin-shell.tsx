"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  Flag,
  Gavel,
  LayoutDashboard,
  LifeBuoy,
  Moon,
  ScrollText,
  Store,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import type { AdminWhoAmI } from "@/lib/admin/types";
import { useThemeStore } from "@/store/theme-store";
import { cn } from "@/lib/utils";
import { isActivePath } from "@/lib/admin/params";
import { ImpersonationBanner } from "./impersonation-banner";

const NAV: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { href: "/admin", label: ADMIN_COPY.nav.overview, icon: LayoutDashboard, exact: true },
  { href: "/admin/shops", label: ADMIN_COPY.nav.shops, icon: Store },
  { href: "/admin/reviews", label: ADMIN_COPY.nav.reviews, icon: Flag },
  { href: "/admin/claims", label: ADMIN_COPY.nav.claims, icon: Gavel },
  { href: "/admin/abuse", label: ADMIN_COPY.nav.abuse, icon: Ban },
  { href: "/admin/support", label: ADMIN_COPY.nav.support, icon: LifeBuoy },
  { href: "/admin/audit", label: ADMIN_COPY.nav.audit, icon: ScrollText },
];

export function AdminShell({ session, children }: { session: AdminWhoAmI; children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const c = ADMIN_COPY.shell;

  return (
    <div className="min-h-[100dvh] bg-page">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-float focus:outline-2 focus:outline-focus"
      >
        {c.skipToContent}
      </a>

      <div className="sticky top-0 z-40 bg-card">
      {session.impersonation && <ImpersonationBanner session={session.impersonation} />}

      <header className="border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 lg:px-6">
          {/* Ink console badge: staff always know they're in the back office. */}
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="text-xl font-extrabold tracking-tight text-ink">{c.brand}</span>
            <span className="inline-flex h-6 items-center rounded-full bg-inverse px-2.5 text-xs font-semibold text-on-inverse">
              {c.product}
            </span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-[13px] text-ink-soft sm:inline">
              {c.signedInAs}{" "}
              <span className="font-medium text-ink">{session.full_name ?? ADMIN_COPY.common.dash}</span>
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-pressed">
              {c.roles[session.role] ?? session.role}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? c.themeLight : c.themeDark}
              title={theme === "dark" ? c.themeLight : c.themeDark}
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <Link
              href="/"
              className="hidden h-10 items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:inline-flex"
            >
              {c.exit}
            </Link>
          </div>
        </div>
        {/* Mobile / tablet: horizontally scrolling section tabs. */}
        <nav aria-label={c.navLabel} className="lg:hidden">
          <ul className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      active
                        ? "border-inverse bg-inverse text-on-inverse"
                        : "border-line bg-card text-ink-soft hover:border-ink-soft hover:text-ink",
                    )}
                  >
                    <item.icon size={15} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      </div>

      <div className="mx-auto flex max-w-[1280px] gap-8 px-4 lg:px-6">
        <nav aria-label={c.navLabel} className="hidden w-56 shrink-0 py-6 lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      active
                        ? "bg-brand-soft font-semibold text-brand-pressed"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <item.icon size={18} aria-hidden className={active ? "text-brand-text" : "text-ink-muted"} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-6 pb-24 focus:outline-none lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
