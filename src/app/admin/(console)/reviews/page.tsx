import Link from "next/link";
import { Flag, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { PAGE_SIZE, buildHref, offsetFor, parsePage, parseReportStatus, type RawSearchParams } from "@/lib/admin/params";
import { adminQuery } from "@/lib/admin/server";
import { REPORT_STATUSES, asPaged, num, type ReviewReportRow } from "@/lib/admin/types";
import { ReportActions } from "../../_components/report-actions";
import { ErrorPanel, FilterTabs, PageHeader, Pagination } from "../../_components/ui";

export const metadata = { title: ADMIN_COPY.reviews.title };

function Stars({ rating }: { rating: number }) {
  const c = ADMIN_COPY.reviews;
  return (
    <span role="img" aria-label={c.stars(rating)} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          aria-hidden
          className={i <= rating ? "fill-[var(--accent-brass)] text-[var(--accent-brass)]" : "text-[var(--border-primary)]"}
        />
      ))}
    </span>
  );
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const status = parseReportStatus(sp);
  const page = parsePage(sp);
  const c = ADMIN_COPY.reviews;
  const res = await adminQuery<unknown>("admin_list_review_reports", {
    p_status: status,
    p_limit: PAGE_SIZE,
    p_offset: offsetFor(page, PAGE_SIZE),
  });
  const data = res.ok ? asPaged<ReviewReportRow>(res.data) : null;

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      <div className="mb-4">
        <FilterTabs
          label={c.title}
          value={status}
          options={REPORT_STATUSES.map((s) => ({ value: s, label: c.statuses[s] }))}
          hrefFor={(s) => buildHref("/admin/reviews", { status: s }, { status: "open" })}
        />
      </div>

      {!res.ok || !data ? (
        <ErrorPanel code={res.ok ? "UNKNOWN" : res.code} retryHref={buildHref("/admin/reviews", { status, page })} />
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={status === "open" ? c.emptyOpenTitle : c.emptyTitle}
          description={status === "open" ? c.emptyOpenBody : undefined}
          headingLevel={2}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.rows.map((r) => {
              const reporter = r.reporter_name ?? c.anonymousReporter;
              const kind = c.reporterKinds[r.reporter_kind] ?? r.reporter_kind;
              const others = num(r.open_on_review);
              return (
                <li
                  key={r.id}
                  className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={r.status === "open" ? "brass" : r.status === "upheld" ? "danger" : "neutral"} size="sm">
                      {c.statuses[r.status]}
                    </Pill>
                    <Pill tone="ink" size="sm">
                      {c.reasons[r.reason] ?? r.reason}
                    </Pill>
                    <Link
                      href={`/admin/shops/${r.shop.id}`}
                      className="rounded text-[13px] font-medium text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                    >
                      {r.shop.name}
                    </Link>
                    <time
                      dateTime={r.created_at}
                      title={formatDateTime(r.created_at)}
                      className="ms-auto text-[12px] text-[var(--text-muted)]"
                    >
                      {formatRelative(r.created_at)}
                    </time>
                  </div>

                  <blockquote className="mt-3 rounded-[var(--radius)] bg-[var(--bg-secondary)] p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <Stars rating={num(r.review.rating)} />
                      <span className="font-medium">{r.review.reviewer_name ?? ADMIN_COPY.common.dash}</span>
                      <span className="text-[var(--text-muted)]">{formatDateTime(r.review.created_at)}</span>
                      {r.review.hidden_at && (
                        <Pill tone="danger" size="sm">
                          {c.hiddenSince(formatRelative(r.review.hidden_at))}
                        </Pill>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-line break-words text-[14px] text-[var(--text-primary)]">
                      {r.review.comment?.trim() ? r.review.comment : <span className="italic text-[var(--text-muted)]">{c.noComment}</span>}
                    </p>
                  </blockquote>

                  <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{c.reportedBy(reporter, kind)}</p>
                  {r.details && <p className="mt-1 whitespace-pre-line break-words text-[14px]">“{r.details}”</p>}
                  {r.status === "open" && others > 1 && (
                    <p className="mt-1 text-[12px] font-medium text-[var(--accent-text)]">{c.otherReports(others)}</p>
                  )}
                  {r.resolution_note && (
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{c.resolution(r.resolution_note)}</p>
                  )}

                  <div className="mt-3">
                    <ReportActions
                      reportId={r.id}
                      reviewId={r.review.id}
                      open={r.status === "open"}
                      reviewHidden={!!r.review.hidden_at}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination path="/admin/reviews" params={{ status }} page={page} size={PAGE_SIZE} total={data.total} />
        </>
      )}
    </>
  );
}
