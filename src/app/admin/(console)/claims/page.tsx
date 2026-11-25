import Link from "next/link";
import { Gavel } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import {
  PAGE_SIZE,
  buildHref,
  first,
  isUuid,
  offsetFor,
  parseClaimStatus,
  parsePage,
  type RawSearchParams,
} from "@/lib/admin/params";
import { adminQuery, getAdminSession } from "@/lib/admin/server";
import { CLAIM_STATUSES, asPaged, type ClaimRow } from "@/lib/admin/types";
import { NewClaimButton, ResolveClaimButton } from "../../_components/claim-actions";
import { ErrorPanel, FilterTabs, PageHeader, Pagination } from "../../_components/ui";

export const metadata = { title: ADMIN_COPY.claims.title };

export default async function AdminClaimsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const status = parseClaimStatus(sp);
  const page = parsePage(sp);
  const shopParam = first(sp, "shop");
  const c = ADMIN_COPY.claims;
  const [session, res] = await Promise.all([
    getAdminSession(),
    adminQuery<unknown>("admin_list_claims", {
      p_status: status,
      p_limit: PAGE_SIZE,
      p_offset: offsetFor(page, PAGE_SIZE),
    }),
  ]);
  const data = res.ok ? asPaged<ClaimRow>(res.data) : null;
  const isAdmin = session?.role === "admin";

  return (
    <>
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        actions={<NewClaimButton defaultShopId={isUuid(shopParam) ? shopParam : ""} />}
      />
      <div className="mb-4">
        <FilterTabs
          label={c.title}
          value={status}
          options={CLAIM_STATUSES.map((s) => ({ value: s, label: c.statuses[s] }))}
          hrefFor={(s) => buildHref("/admin/claims", { status: s }, { status: "open" })}
        />
      </div>

      {!res.ok || !data ? (
        <ErrorPanel code={res.ok ? "UNKNOWN" : res.code} retryHref={buildHref("/admin/claims", { status, page })} />
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={status === "open" ? c.emptyOpenTitle : c.emptyTitle}
          description={status === "open" ? c.emptyOpenBody : undefined}
          headingLevel={2}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.rows.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-line bg-card p-4 transition-shadow duration-200 hover:shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={d.status === "open" ? "warning" : d.status === "upheld" ? "success" : "neutral"} size="sm">
                    {c.statuses[d.status]}
                  </Pill>
                  <Link
                    href={`/admin/shops/${d.shop.id}`}
                    className="rounded text-[14px] font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {d.shop.name}
                  </Link>
                  <time
                    dateTime={d.created_at}
                    title={formatDateTime(d.created_at)}
                    className="ms-auto text-[12px] text-ink-muted"
                  >
                    {formatRelative(d.created_at)}
                  </time>
                </div>
                <p className="mt-2 text-[13px] text-ink-soft">
                  {c.claimant}: <span className="font-medium text-ink">{d.claimant_name}</span>
                  {d.claimant_phone_masked ? (
                    <>
                      {" · "}
                      <span dir="ltr">{d.claimant_phone_masked}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-[14px]">{d.details}</p>
                {d.resolution_note && (
                  <p className="mt-2 text-[13px] text-ink-soft">
                    {ADMIN_COPY.reviews.resolution(d.resolution_note)}
                  </p>
                )}
                {d.status === "open" && isAdmin && (
                  <div className="mt-3">
                    <ResolveClaimButton claimId={d.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination path="/admin/claims" params={{ status }} page={page} size={PAGE_SIZE} total={data.total} />
        </>
      )}
    </>
  );
}
