import Link from "next/link";
import { ADMIN_COPY, auditActionLabel } from "@/lib/admin/dictionary";
import { formatDateTime, formatRelative, summarizeDiff } from "@/lib/admin/format";
import type { AuditRow } from "@/lib/admin/types";

/** Link to the record an audit row is about, when the back office has a page for it. */
export function auditTargetHref(row: Pick<AuditRow, "target_type" | "target_id" | "diff">): string | null {
  const shopFromDiff = row.diff && typeof row.diff.shop_id === "string" ? row.diff.shop_id : null;
  switch (row.target_type) {
    case "shop":
    case "plan":
    case "impersonation":
      return row.target_id ? `/admin/shops/${row.target_id}` : null;
    case "review":
    case "review_report":
    case "service":
    case "claim":
      return shopFromDiff ? `/admin/shops/${shopFromDiff}` : null;
    default:
      return null;
  }
}

/**
 * Audit rows as a list (works at 375px, unlike a wide table). Each row shows
 * who, what, when and why; details expand to the field-level diff.
 */
export function AuditList({ rows, empty, compact = false }: { rows: AuditRow[]; empty: string; compact?: boolean }) {
  const c = ADMIN_COPY.audit;
  if (!rows.length) {
    return <p className="py-6 text-center text-[14px] text-[var(--text-secondary)]">{empty}</p>;
  }
  return (
    <ol className="divide-y divide-[var(--border-subtle)]">
      {rows.map((row) => {
        const href = auditTargetHref(row);
        const changes = compact ? [] : summarizeDiff(row.diff ?? null);
        const who = row.actor_name ?? ADMIN_COPY.common.system;
        return (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                {href ? (
                  <Link
                    href={href}
                    className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  >
                    {auditActionLabel(row.action)}
                  </Link>
                ) : (
                  auditActionLabel(row.action)
                )}
              </p>
              <time
                dateTime={row.created_at}
                title={formatDateTime(row.created_at)}
                className="text-[12px] tabular-nums text-[var(--text-muted)]"
              >
                {compact ? formatRelative(row.created_at) : formatDateTime(row.created_at)}
              </time>
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              {ADMIN_COPY.common.by} {who}
              {row.actor_role ? ` · ${ADMIN_COPY.shell.roles[row.actor_role] ?? row.actor_role}` : ""}
              {row.target_type ? ` · ${c.targetTypes[row.target_type] ?? row.target_type}` : ""}
              {row.impersonation_id ? ` · ${c.viaSupport}` : ""}
            </p>
            {row.reason && <p className="mt-1 text-[13px] text-[var(--text-primary)]">“{row.reason}”</p>}
            {changes.length > 0 && (
              <details className="mt-2 group">
                <summary className="cursor-pointer select-none rounded text-[12px] font-medium text-[var(--accent-text)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]">
                  {c.showDetails}
                </summary>
                <dl className="mt-2 grid gap-1 rounded-[var(--radius)] bg-[var(--bg-secondary)] p-3 text-[12px]">
                  {changes.map((ch) => (
                    <div key={ch.field} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
                      <dt className="truncate font-medium text-[var(--text-secondary)]">{ch.field}</dt>
                      <dd className="break-all text-[var(--text-primary)]">
                        {ch.before ? (
                          <>
                            <span className="text-[var(--text-muted)] line-through">{ch.before}</span>
                            <span aria-hidden className="mx-1">
                              →
                            </span>
                          </>
                        ) : null}
                        {ch.after}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
