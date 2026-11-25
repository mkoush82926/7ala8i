import Link from "next/link";
import { Search, Store } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatCount, formatDate, formatRating } from "@/lib/admin/format";
import {
  PAGE_SIZE,
  SHOP_STATUS_FILTERS,
  buildHref,
  offsetFor,
  parseShopFilters,
  type RawSearchParams,
} from "@/lib/admin/params";
import { adminQuery, getAdminSession } from "@/lib/admin/server";
import { asPaged, num, type AdminShopRow } from "@/lib/admin/types";
import { ErrorPanel, FilterTabs, PageHeader, Pagination } from "../../_components/ui";
import { VerifyToggle } from "../../_components/verify-toggle";
import { ShopStatePills } from "../../_components/shop-state-pills";

export const metadata = { title: ADMIN_COPY.shops.title };

async function loadCities(): Promise<Array<{ id: string; name_en: string }>> {
  try {
    const supabase = await createClient();
    const { data } = await (supabase as unknown as {
      from(t: string): {
        select(c: string): { order(c: string): PromiseLike<{ data: Array<{ id: string; name_en: string }> | null }> };
      };
    })
      .from("cities")
      .select("id, name_en")
      .order("sort");
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function AdminShopsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const f = parseShopFilters(sp);
  const c = ADMIN_COPY.shops;
  const base = { q: f.q, status: f.status, city: f.city };
  const defaults = { status: "all" };

  const [session, res, cities] = await Promise.all([
    getAdminSession(),
    adminQuery<unknown>("admin_list_shops", {
      p_q: f.q || null,
      p_status: f.status,
      p_city_id: f.city,
      p_limit: PAGE_SIZE,
      p_offset: offsetFor(f.page, PAGE_SIZE),
    }),
    loadCities(),
  ]);
  const page = res.ok ? asPaged<AdminShopRow>(res.data) : null;
  const canVerify = session?.role === "admin";
  const verifyCell = (shop: AdminShopRow) =>
    canVerify ? (
      <VerifyToggle shopId={shop.id} shopName={shop.name} verified={shop.is_verified} />
    ) : (
      <span className="text-[13px]">{shop.is_verified ? ADMIN_COPY.common.yes : ADMIN_COPY.common.no}</span>
    );
  const filtered = !!(f.q || f.city || f.status !== "all");

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />

      <div className="mb-4 flex flex-col gap-3">
        <form role="search" action="/admin/shops" method="get" className="flex flex-col gap-2 sm:flex-row">
          {f.status !== "all" && <input type="hidden" name="status" value={f.status} />}
          <label htmlFor="shop-q" className="sr-only">
            {c.searchLabel}
          </label>
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              id="shop-q"
              name="q"
              type="search"
              defaultValue={f.q}
              maxLength={100}
              placeholder={c.searchPlaceholder}
              autoComplete="off"
              className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] ps-9 pe-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            />
          </div>
          <label htmlFor="shop-city" className="sr-only">
            {c.cityLabel}
          </label>
          <select
            id="shop-city"
            name="city"
            defaultValue={f.city ?? ""}
            className="h-11 rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-[15px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] sm:w-48"
          >
            <option value="">{c.allCities}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name_en}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            {ADMIN_COPY.common.search}
          </button>
        </form>
        <FilterTabs
          label={c.statusLabel}
          value={f.status}
          options={SHOP_STATUS_FILTERS.map((s) => ({ value: s, label: c.statuses[s] }))}
          hrefFor={(s) => buildHref("/admin/shops", { ...base, status: s }, defaults)}
        />
      </div>

      {!page || !res.ok ? (
        <ErrorPanel code={res.ok ? "UNKNOWN" : res.code} retryHref={buildHref("/admin/shops", { ...base, page: f.page }, defaults)} />
      ) : page.rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Search}
            title={ADMIN_COPY.common.emptyFiltered}
            action={{ label: ADMIN_COPY.common.clearFilters, href: "/admin/shops" }}
            headingLevel={2}
          />
        ) : (
          <EmptyState icon={Store} title={c.emptyTitle} description={c.emptyBody} headingLevel={2} />
        )
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((shop) => (
              <li
                key={shop.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/shops/${shop.id}`}
                      className="block truncate rounded text-[15px] font-semibold text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                    >
                      {shop.name}
                    </Link>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                      {[shop.city_name, `/${shop.slug}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {verifyCell(shop)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-secondary)]">
                  <ShopStatePills shop={shop} />
                  <span>
                    {c.columns.bookings}: {formatCount(num(shop.bookings_30d))}
                  </span>
                  <span>
                    {c.columns.rating}: {formatRating(shop.rating_avg)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] md:block">
            <table className="w-full text-[14px]">
              <caption className="sr-only">{c.title}</caption>
              <thead className="bg-[var(--bg-secondary)] text-start text-[12px] text-[var(--text-secondary)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">{c.columns.shop}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{c.columns.state}</th>
                  <th scope="col" className="px-3 py-2.5 text-end font-medium">{c.columns.staff}</th>
                  <th scope="col" className="px-3 py-2.5 text-end font-medium">{c.columns.bookings}</th>
                  <th scope="col" className="px-3 py-2.5 text-end font-medium">{c.columns.rating}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{c.columns.plan}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{c.columns.created}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">{c.columns.verified}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {page.rows.map((shop) => (
                  <tr key={shop.id} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="max-w-[16rem] px-4 py-3">
                      <Link
                        href={`/admin/shops/${shop.id}`}
                        className="block truncate rounded font-semibold text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                      >
                        {shop.name}
                      </Link>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {[shop.city_name, `/${shop.slug}`].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ShopStatePills shop={shop} />
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatCount(num(shop.staff_count))}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatCount(num(shop.bookings_30d))}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatRating(shop.rating_avg)}</td>
                    <td className="px-3 py-3 text-[13px]">
                      {shop.plan_code ? ADMIN_COPY.plan.codes[shop.plan_code] : ADMIN_COPY.common.dash}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[var(--text-secondary)]">{formatDate(shop.created_at)}</td>
                    <td className="px-4 py-3 text-end">
                      {verifyCell(shop)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination path="/admin/shops" params={base} page={f.page} size={PAGE_SIZE} total={page.total} />
        </>
      )}
    </>
  );
}
