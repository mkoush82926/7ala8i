import {
  LayoutDashboard,
  Calendar,
  Users,
  Kanban,
  Settings,
  BarChart3,
  Scissors,
  IdCard,
  Sun,
  Footprints,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKeys } from "@/i18n/en";

/**
 * Single source of truth for the dashboard navigation: the desktop sidebar,
 * the mobile tab bar and "More" sheet, the topbar page title and the (dashboard) layout role guard
 * all read from here, so a page can never be visible in one place and
 * forbidden in another.
 *
 * NOTE: this is UX only. Real enforcement is RLS (see the production
 * hardening migration); a barber who types /analytics gets redirected here,
 * and the data reads behind it are still checked by the database.
 */

export type NavId =
  | "dashboard"
  | "my-day"
  | "calendar"
  | "queue"
  | "leads"
  | "clients"
  | "services"
  | "team"
  | "analytics"
  | "settings";

/** Workspace roles that may use the dashboard shell. */
export type ShellRole = "shop_admin" | "barber";

export interface NavItem {
  id: NavId;
  icon: LucideIcon;
  /** Path without the locale prefix. */
  href: string;
  roles: readonly ShellRole[];
}

const ADMIN: readonly ShellRole[] = ["shop_admin"];
const STAFF: readonly ShellRole[] = ["shop_admin", "barber"];

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", icon: LayoutDashboard, href: "/", roles: ADMIN },
  { id: "my-day", icon: Sun, href: "/my-day", roles: STAFF },
  { id: "calendar", icon: Calendar, href: "/calendar", roles: STAFF },
  { id: "queue", icon: Footprints, href: "/queue", roles: STAFF },
  // Leads RLS is shop_admin-only (SELECT included), so barbers never see the board.
  { id: "leads", icon: Kanban, href: "/leads", roles: ADMIN },
  { id: "clients", icon: Users, href: "/clients", roles: STAFF },
  { id: "services", icon: Scissors, href: "/services", roles: ADMIN },
  { id: "team", icon: IdCard, href: "/team", roles: ADMIN },
  { id: "analytics", icon: BarChart3, href: "/analytics", roles: ADMIN },
  { id: "settings", icon: Settings, href: "/settings", roles: ADMIN },
];

/** Sub-pages of an admin-only item that every staff role may open. */
export const STAFF_PATHS: readonly string[] = ["/settings/profile", "/settings/notifications"];

/**
 * Labelled desktop sidebar sections (v2 §5.10). `label: null` renders the
 * items without a group heading. Order and membership only — routes and
 * role rules stay on NAV_ITEMS.
 */
export type NavSectionLabel = "schedule" | "business";
export interface NavSection {
  id: string;
  label: NavSectionLabel | null;
  items: readonly NavId[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: "home", label: null, items: ["dashboard"] },
  { id: "schedule", label: "schedule", items: ["my-day", "calendar", "queue"] },
  { id: "business", label: "business", items: ["clients", "leads", "services", "team", "analytics", "settings"] },
];

/**
 * Mobile bottom tab bar (< lg): the role's home ("Today"), then these, then
 * "More" (a sheet with every visible item).
 */
export const MOBILE_TAB_IDS: readonly NavId[] = ["calendar", "queue", "clients"];

export function navLabel(t: TranslationKeys, id: NavId): string {
  if (id === "my-day") return t.sidebar.myDay;
  return t.sidebar[id];
}

/** Normalises any store role ("super_admin", "client", …) to a shell role, or null. */
export function toShellRole(role: string | null | undefined): ShellRole | null {
  if (role === "shop_admin" || role === "super_admin") return "shop_admin";
  if (role === "barber") return "barber";
  return null;
}

/** "/ar/clients/x" → "/clients/x"; "/ar" → "/". */
export function stripLocale(pathname: string | null | undefined): string {
  const p = (pathname || "/").replace(/^\/(en|ar)(?=\/|$)/, "");
  return p === "" ? "/" : p;
}

export function isNavActive(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

/** The nav item that owns a (locale-less) path, if any. */
export function findNavItem(path: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavActive(item.href, path));
}

export function visibleNavItems(role: ShellRole | null): NavItem[] {
  if (!role) return NAV_ITEMS.filter((i) => i.roles.length === STAFF.length);
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/**
 * Whether `role` may open `path`. Paths outside the nav config (e.g. a
 * nested detail route of an allowed page) inherit their parent's rule; paths
 * the config does not know at all are allowed (the page/RLS decides).
 */
export function canAccessPath(role: ShellRole | null, path: string): boolean {
  // Barbers edit their own public card and portfolio here (WS-1A); keep in
  // sync with STAFF_ALLOWED_ROUTES in src/middleware.ts.
  if (role && STAFF_PATHS.some((p) => isNavActive(p, path))) return true;
  const item = findNavItem(path);
  if (!item) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

/** Where a role lands when it opens a page it may not see. */
export function homePathFor(role: ShellRole | null): string {
  return role === "shop_admin" ? "/" : "/my-day";
}
