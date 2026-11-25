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
    <div className="min-h-[100dvh] bg-[var(--bg-primary)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-[var(--radius)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:shadow-[var(--shadow-focus)]"
      >
        {c.skipToContent}
      </a>

      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]">
      {session.impersonation && <ImpersonationBanner session={session.impersonation} />}

      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 lg:px-6">
          <Link
            href="/admin"
            className="flex items-baseline gap-2 rounded-[var(--radius)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <span className="text-[17px] font-bold tracking-tight text-[var(--text-primary)]">{c.brand}</span>
            <span className="text-[13px] font-medium text-[var(--accent-text)]">{c.product}</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-[13px] text-[var(--text-secondary)] sm:inline">
              {c.signedInAs}{" "}
              <span className="font-medium text-[var(--text-primary)]">{session.full_name ?? ADMIN_COPY.common.dash}</span>
            </span>
            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              {c.roles[session.role] ?? session.role}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? c.themeLight : c.themeDark}
              title={theme === "dark" ? c.themeLight : c.themeDark}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <Link
              href="/"
              className="hidden h-10 items-center rounded-[var(--radius)] px-3 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] md:inline-flex"
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
                      "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      active
                        ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]",
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
        <nav aria-label={c.navLabel} className="hidden w-52 shrink-0 py-6 lg:block">
          <ul className="sticky top-20 flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-[var(--radius)] px-3 text-[14px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      active
                        ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    <item.icon size={17} aria-hidden className={active ? "text-[var(--accent-text)]" : undefined} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-6 pb-24 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
