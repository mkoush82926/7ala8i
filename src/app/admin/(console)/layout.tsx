import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/server";
import { AdminShell } from "../_components/admin-shell";

// Every request re-checks the caller: no caching of the back office.
export const dynamic = "force-dynamic";

/**
 * Server-side gate for the whole back office. Signed-out visitors, ordinary
 * users, banned staff, or a database without the admin migration all get the
 * same plain 404 as any unknown URL.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) notFound();

  return <AdminShell session={session}>{children}</AdminShell>;
}
