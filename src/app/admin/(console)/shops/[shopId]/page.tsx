import { Store } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatCount, formatDate, formatDateTime, formatRating } from "@/lib/admin/format";
import { isUuid } from "@/lib/admin/params";
import { adminQuery, getAdminSession } from "@/lib/admin/server";
import { num, type AdminShopDetail } from "@/lib/admin/types";
import { AuditList } from "../../../_components/audit-list";
import { CopyIdButton } from "../../../_components/copy-id-button";
import { PlanPanel, ProfileBanButton, StartSupportSession, SuspendControl } from "../../../_components/shop-actions";
import { ShopStatePills } from "../../../_components/shop-state-pills";
import { ErrorPanel, Field, PageHeader, Section } from "../../../_components/ui";
import { VerifyToggle } from "../../../_components/verify-toggle";

export const metadata = { title: ADMIN_COPY.nav.shops };

const STAT_KEYS = [
  "bookings_30d",
  "no_shows_30d",
  "services_active",
  "reviews",
  "reviews_hidden",
  "rating_avg",
  "open_reports",
] as const;

export default async function AdminShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const c = ADMIN_COPY.shop;
  const back = { href: "/admin/shops", label: c.back };

  const notFoundState = (
    <>
      <PageHeader title={c.notFoundTitle} back={back} />
      <EmptyState icon={Store} title={c.notFoundTitle} description={c.notFoundBody} headingLevel={2} />
    </>
  );
  if (!isUuid(shopId)) return notFoundState;

  const [session, res] = await Promise.all([
    getAdminSession(),
    adminQuery<AdminShopDetail>("admin_get_shop", { p_shop_id: shopId }),
  ]);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return notFoundState;
    return (
      <>
        <PageHeader title={ADMIN_COPY.nav.shops} back={back} />
        <ErrorPanel code={res.code} retryHref={`/admin/shops/${shopId}`} />
      </>
    );
  }

  const { shop, staff, stats, plan, audit } = res.data;
  const isAdmin = session?.role === "admin";
  const suspended = !!shop.suspended_at;

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {shop.name}
            {shop.is_verified && (
              <Pill tone="brass" size="sm">
                {ADMIN_COPY.shops.verified}
              </Pill>
            )}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ShopStatePills shop={{ ...shop, open_reports: stats.open_reports }} />
            {shop.name_ar && (
              <span dir="rtl" lang="ar">
                {shop.name_ar}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <CopyIdButton value={shop.id} />
            <a
              href={`/en/shop/${shop.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              {c.publicPage}
            </a>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Section id="details">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={c.slug}>/{shop.slug}{shop.slug_ar ? ` · /${shop.slug_ar}` : ""}</Field>
              <Field label={c.location}>
                {[shop.area_name, shop.city_name].filter(Boolean).join(", ") || ADMIN_COPY.common.dash}
              </Field>
              <Field label={c.phone}>
                <span dir="ltr">{shop.phone_masked ?? ADMIN_COPY.common.dash}</span>
              </Field>
              <Field label={c.whatsapp}>
                <span dir="ltr">{shop.whatsapp_masked ?? ADMIN_COPY.common.dash}</span>
              </Field>
              <Field label={c.address}>{shop.address || ADMIN_COPY.common.dash}</Field>
              <Field label={c.timezone}>{shop.timezone || ADMIN_COPY.common.dash}</Field>
              <Field label={c.created}>{formatDateTime(shop.created_at)}</Field>
              <Field label={c.published}>{shop.published_at ? formatDateTime(shop.published_at) : c.neverPublished}</Field>
            </dl>
          </Section>

          <Section title={c.statsTitle} id="stats">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STAT_KEYS.map((key) => (
                <div key={key} className="rounded-[var(--radius)] bg-[var(--bg-secondary)] p-3">
                  <dt className="text-[12px] text-[var(--text-secondary)]">{c.stats[key]}</dt>
                  <dd className="mt-0.5 text-[18px] font-semibold tabular-nums">
                    {key === "rating_avg" ? formatRating(stats.rating_avg) : formatCount(num(stats[key]))}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title={ADMIN_COPY.plan.title} description={ADMIN_COPY.plan.body} id="plan">
            <PlanPanel shopId={shop.id} plan={plan} canEdit={isAdmin} />
          </Section>

          <Section title={c.staffTitle} id="team">
            {staff.length === 0 ? (
              <p className="text-[14px] text-[var(--text-secondary)]">{c.staffEmpty}</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {staff.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">
                        {p.full_name}
                        {p.banned_at && (
                          <Pill tone="danger" size="sm" className="ms-2 align-middle">
                            {c.banned}
                          </Pill>
                        )}
                      </p>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {ADMIN_COPY.abuse.roleLabels[p.role] ?? p.role}
                        {p.phone_masked ? (
                          <>
                            {" · "}
                            <span dir="ltr">{p.phone_masked}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {isAdmin && <ProfileBanButton profileId={p.id} name={p.full_name} banned={!!p.banned_at} />}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={c.auditTitle} id="history">
            <AuditList rows={audit} empty={c.auditEmpty} />
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title={c.verificationTitle} description={c.verificationBody} id="verification">
            {isAdmin ? (
              <VerifyToggle shopId={shop.id} shopName={shop.name} verified={shop.is_verified} showLabel />
            ) : (
              <p className="text-[14px]">{shop.is_verified ? ADMIN_COPY.common.yes : ADMIN_COPY.common.no}</p>
            )}
          </Section>

          <Section title={c.suspensionTitle} description={c.suspensionBody} id="suspension">
            {suspended && (
              <p className="mb-3 text-[14px] font-medium text-[var(--accent-rose)]">
                {c.suspendedSince(formatDate(shop.suspended_at))}
              </p>
            )}
            {isAdmin && <SuspendControl shopId={shop.id} suspended={suspended} />}
          </Section>

          <Section title={c.supportTitle} description={c.supportBody} id="support">
            <StartSupportSession shopId={shop.id} />
          </Section>
        </div>
      </div>
    </>
  );
}
