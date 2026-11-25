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
    return <p className="py-6 text-center text-[14px] text-ink-soft">{empty}</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {rows.map((row) => {
        const href = auditTargetHref(row);
        const changes = compact ? [] : summarizeDiff(row.diff ?? null);
        const who = row.actor_name ?? ADMIN_COPY.common.system;
        return (
          <li key={row.id} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[14px] font-medium text-ink">
                {href ? (
                  <Link
                    href={href}
                    className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                className="text-[12px] tabular-nums text-ink-muted"
              >
                {compact ? formatRelative(row.created_at) : formatDateTime(row.created_at)}
              </time>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {ADMIN_COPY.common.by} {who}
              {row.actor_role ? ` · ${ADMIN_COPY.shell.roles[row.actor_role] ?? row.actor_role}` : ""}
              {row.target_type ? ` · ${c.targetTypes[row.target_type] ?? row.target_type}` : ""}
              {row.impersonation_id ? ` · ${c.viaSupport}` : ""}
            </p>
            {row.reason && <p className="mt-1.5 border-s-2 border-line ps-3 text-[13px] text-ink">“{row.reason}”</p>}
            {changes.length > 0 && (
              <details className="mt-2 group">
                <summary className="cursor-pointer select-none rounded text-[12px] font-medium text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {c.showDetails}
                </summary>
                <dl className="mt-2 grid gap-1 rounded-lg bg-sunken p-3 text-[12px]">
                  {changes.map((ch) => (
                    <div key={ch.field} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
                      <dt className="truncate font-medium text-ink-soft">{ch.field}</dt>
                      <dd className="break-all font-mono text-ink">
                        {ch.before ? (
                          <>
                            <span className="text-ink-muted line-through">{ch.before}</span>
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
