import Link from "next/link";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_TARGET_TYPES,
  buildHref,
  offsetFor,
  parseAuditFilters,
  type RawSearchParams,
} from "@/lib/admin/params";
import { adminQuery } from "@/lib/admin/server";
import { asPaged, type AuditRow } from "@/lib/admin/types";
import { AuditList } from "../../_components/audit-list";
import { ErrorPanel, PageHeader, Pagination, Section } from "../../_components/ui";

export const metadata = { title: ADMIN_COPY.audit.title };

const controlCls =
  "h-11 w-full rounded-lg border border-line-strong bg-card px-4 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const labelCls = "mb-1 block text-[12px] font-medium text-ink-soft";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);
  const c = ADMIN_COPY.audit;
  const params = { action: filters.action, type: filters.type, target: filters.target };
  const filtered = !!(filters.action || filters.type || filters.target);

  const res = await adminQuery<unknown>("admin_list_audit", {
    p_action: filters.action || null,
    p_target_type: filters.type,
    p_target_id: filters.target || null,
    p_limit: AUDIT_PAGE_SIZE,
    p_offset: offsetFor(filters.page, AUDIT_PAGE_SIZE),
  });
  const data = res.ok ? asPaged<AuditRow>(res.data) : null;

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />

      {/* Plain GET form: filters live in the URL, so a view can be shared. */}
      <form
        method="get"
        action="/admin/audit"
        role="search"
        className="mb-4 grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor="audit-action" className={labelCls}>
            {c.actionLabel}
          </label>
          <select id="audit-action" name="action" defaultValue={filters.action} className={controlCls}>
            <option value="">{c.allActions}</option>
            {Object.entries(c.actionGroups).map(([prefix, label]) => (
              <optgroup key={prefix} label={label}>
                <option value={prefix}>{label}</option>
                {Object.entries(c.actions)
                  .filter(([code]) => code.split(".")[0] === prefix)
                  .map(([code, actionLabel]) => (
                    <option key={code} value={code}>
                      {actionLabel}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-type" className={labelCls}>
            {c.targetTypeLabel}
          </label>
          <select id="audit-type" name="type" defaultValue={filters.type ?? ""} className={controlCls}>
            <option value="">{c.allTargets}</option>
            {AUDIT_TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {c.targetTypes[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-target" className={labelCls}>
            {c.targetIdLabel}
          </label>
          <input
            id="audit-target"
            name="target"
            type="search"
            dir="ltr"
            defaultValue={filters.target}
            maxLength={64}
            autoComplete="off"
            className={controlCls}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            {ADMIN_COPY.common.apply}
          </button>
          {filtered && (
            <Link href="/admin/audit" className="btn btn-ghost">
              {ADMIN_COPY.common.clear}
            </Link>
          )}
        </div>
      </form>

      {!res.ok || !data ? (
        <ErrorPanel
          code={res.ok ? "UNKNOWN" : res.code}
          retryHref={buildHref("/admin/audit", { ...params, page: filters.page })}
        />
      ) : (
        <Section>
          <AuditList rows={data.rows} empty={filtered ? ADMIN_COPY.common.emptyFiltered : c.emptyBody} />
          <Pagination path="/admin/audit" params={params} page={filters.page} size={AUDIT_PAGE_SIZE} total={data.total} />
        </Section>
      )}
    </>
  );
}
