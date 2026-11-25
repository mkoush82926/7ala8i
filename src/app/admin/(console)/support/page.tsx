import Link from "next/link";
import { LifeBuoy, TimerOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatCount, formatDateTime, formatJodPlain } from "@/lib/admin/format";
import { adminQuery, getAdminSession } from "@/lib/admin/server";
import { num, type ImpersonationSnapshot } from "@/lib/admin/types";
import { SupportProfileForm, SupportServiceToggle } from "../../_components/support-editor";
import { ErrorPanel, PageHeader, Section, StatTile } from "../../_components/ui";

export const metadata = { title: ADMIN_COPY.support.title };

const STAT_KEYS = ["bookings_30d", "completed_30d", "no_shows_30d", "revenue_30d"] as const;

export default async function AdminSupportPage() {
  const c = ADMIN_COPY.support;
  const session = await getAdminSession();
  const live = session?.impersonation ?? null;

  if (!live) {
    return (
      <>
        <PageHeader title={c.title} subtitle={c.subtitle} />
        <EmptyState
          icon={LifeBuoy}
          title={c.noneTitle}
          description={c.noneBody}
          action={{ label: c.findShop, href: "/admin/shops" }}
          headingLevel={2}
        />
      </>
    );
  }

  const res = await adminQuery<ImpersonationSnapshot>("admin_impersonation_snapshot", { p_session_id: live.id });
  if (!res.ok) {
    return (
      <>
        <PageHeader title={c.title} subtitle={c.subtitle} />
        {res.code === "IMPERSONATION_INACTIVE" ? (
          <EmptyState
            icon={TimerOff}
            title={c.expiredTitle}
            description={c.expiredBody}
            action={{ label: c.findShop, href: "/admin/shops" }}
            headingLevel={2}
          />
        ) : (
          <ErrorPanel code={res.code} retryHref="/admin/support" />
        )}
      </>
    );
  }

  const snap = res.data;
  const write = snap.session.mode === "write";

  return (
    <>
      <PageHeader
        title={snap.shop.name}
        subtitle={
          <>
            <Pill tone={write ? "danger" : "ink"} size="sm">
              {write ? c.modeWrite : c.modeRead}
            </Pill>
            {snap.session.reason ? <span className="ms-2">{c.sessionReason(snap.session.reason)}</span> : null}
          </>
        }
        back={{ href: `/admin/shops/${snap.shop.id}`, label: ADMIN_COPY.shop.back }}
      />

      {!write && (
        <p role="note" className="mb-5 rounded-lg bg-sunken p-3 text-[13px] text-ink-soft">
          {c.readOnlyNote}
        </p>
      )}

      <div className="flex flex-col gap-5">
        <section aria-labelledby="support-stats">
          <h2 id="support-stats" className="mb-3 text-[16px] font-semibold">
            {c.statsTitle}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAT_KEYS.map((k) => (
              <StatTile
                key={k}
                label={c.stats[k]}
                value={k === "revenue_30d" ? formatJodPlain(snap.stats[k]) : formatCount(num(snap.stats[k]))}
              />
            ))}
          </div>
        </section>

        {snap.publish_missing.length > 0 && (
          <Section id="missing" title={c.missingTitle}>
            <ul className="flex flex-wrap gap-2">
              {snap.publish_missing.map((m) => (
                <li key={m}>
                  <Pill tone="warning" size="sm">
                    {c.missing[m] ?? m}
                  </Pill>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section id="profile" title={c.profileTitle}>
          <SupportProfileForm sessionId={snap.session.id} shop={snap.shop} canEdit={write} />
        </Section>

        <Section id="services" title={c.servicesTitle}>
          {snap.services.length === 0 ? (
            <p className="text-[14px] text-ink-soft">{c.servicesEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {snap.services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{s.name}</p>
                    <p className="text-[12px] text-ink-muted">
                      {s.name_ar ? <span dir="rtl">{s.name_ar} · </span> : null}
                      {formatJodPlain(s.price)} · {c.minutes(num(s.duration))}
                      {!s.online_bookable ? ` · ${c.notBookable}` : ""}
                    </p>
                  </div>
                  <SupportServiceToggle
                    sessionId={snap.session.id}
                    serviceId={s.id}
                    name={s.name}
                    active={s.is_active}
                    canEdit={write}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section id="team" title={c.teamTitle}>
            {snap.team.length === 0 ? (
              <p className="text-[14px] text-ink-soft">{ADMIN_COPY.shop.staffEmpty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {snap.team.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-[14px] font-medium">{m.full_name}</span>
                    <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                      {ADMIN_COPY.abuse.roleLabels[m.role] ?? m.role}
                      {!m.online_bookable && (
                        <Pill tone="neutral" size="sm">
                          {c.notBookable}
                        </Pill>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="upcoming" title={c.upcomingTitle}>
            {snap.upcoming.length === 0 ? (
              <p className="text-[14px] text-ink-soft">{c.upcomingEmpty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {snap.upcoming.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <time dateTime={a.start_time} className="text-[14px] font-medium tabular-nums">
                        {a.local_start || formatDateTime(a.start_time)}
                      </time>
                      <Pill tone="neutral" size="sm">
                        {a.status}
                      </Pill>
                    </div>
                    <p className="text-[12px] text-ink-muted">
                      {[a.service_name, a.barber_name, a.client_first_name].filter(Boolean).join(" · ")}
                      {a.client_phone_masked ? (
                        <>
                          {" · "}
                          <span dir="ltr">{a.client_phone_masked}</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <p className="text-[13px] text-ink-soft">
          <Link
            href={`/admin/audit?target=${snap.shop.id}`}
            className="rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {ADMIN_COPY.overview.seeAll}
          </Link>
        </p>
      </div>
    </>
  );
}
