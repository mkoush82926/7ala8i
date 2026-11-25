import Link from "next/link";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatCount } from "@/lib/admin/format";
import { adminQuery } from "@/lib/admin/server";
import { num, type AdminOverview } from "@/lib/admin/types";
import { AuditList } from "../_components/audit-list";
import { ErrorPanel, PageHeader, Section, StatTile } from "../_components/ui";

export const metadata = { title: ADMIN_COPY.overview.title };

const QUEUES: Array<{ key: keyof AdminOverview; href: string }> = [
  { key: "open_reports", href: "/admin/reviews" },
  { key: "open_claims", href: "/admin/claims" },
  { key: "shops_unverified", href: "/admin/shops?status=unverified" },
  { key: "shops_suspended", href: "/admin/shops?status=suspended" },
];

const TOTALS: Array<{ key: keyof AdminOverview; href?: string }> = [
  { key: "shops_total", href: "/admin/shops" },
  { key: "shops_published", href: "/admin/shops?status=published" },
  { key: "bookings_7d" },
  { key: "banned_profiles", href: "/admin/abuse" },
  { key: "banned_phones", href: "/admin/abuse" },
];

export default async function AdminOverviewPage() {
  const c = ADMIN_COPY.overview;
  const res = await adminQuery<AdminOverview>("admin_overview");

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      {!res.ok ? (
        <ErrorPanel code={res.code} retryHref="/admin" />
      ) : (
        <div className="flex flex-col gap-6">
          <Section title={c.queueTitle} id="queues">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {QUEUES.map((q) => (
                <StatTile key={q.key} label={c.cards[q.key]} value={formatCount(num(res.data[q.key]))} href={q.href} />
              ))}
            </div>
          </Section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TOTALS.map((q) => (
              <StatTile key={q.key} label={c.cards[q.key]} value={formatCount(num(res.data[q.key]))} href={q.href} />
            ))}
          </div>
          <Section
            title={c.recentTitle}
            id="recent"
            actions={
              <Link
                href="/admin/audit"
                className="rounded text-[13px] font-medium text-[var(--accent-text)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                {c.seeAll}
              </Link>
            }
          >
            <AuditList rows={Array.isArray(res.data.recent_audit) ? res.data.recent_audit : []} empty={c.recentEmpty} compact />
          </Section>
        </div>
      )}
    </>
  );
}
