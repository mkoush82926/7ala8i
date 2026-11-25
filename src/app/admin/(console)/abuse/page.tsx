import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatDate, formatDateTime, formatRelative } from "@/lib/admin/format";
import { adminQuery, getAdminSession } from "@/lib/admin/server";
import type { BanLists } from "@/lib/admin/types";
import { BanPhoneForm, ProfileSearch, UnbanPhoneButton } from "../../_components/abuse-actions";
import { ProfileBanButton } from "../../_components/shop-actions";
import { ErrorPanel, PageHeader, Section } from "../../_components/ui";

export const metadata = { title: ADMIN_COPY.abuse.title };

function asBanLists(value: unknown): BanLists {
  const v = (value ?? {}) as Partial<BanLists>;
  return {
    phones: Array.isArray(v.phones) ? v.phones : [],
    profiles: Array.isArray(v.profiles) ? v.profiles : [],
    shops: Array.isArray(v.shops) ? v.shops : [],
  };
}

function When({ value }: { value: string }) {
  return (
    <time dateTime={value} title={formatDateTime(value)} className="text-[12px] text-ink-muted">
      {ADMIN_COPY.abuse.since(formatRelative(value))}
    </time>
  );
}

export default async function AdminAbusePage() {
  const c = ADMIN_COPY.abuse;
  const [session, res] = await Promise.all([getAdminSession(), adminQuery<unknown>("admin_list_bans", { p_limit: 100 })]);
  // Bans and suspensions are admin-only writes; support agents see the lists.
  const isAdmin = session?.role === "admin";

  if (!res.ok) {
    return (
      <>
        <PageHeader title={c.title} subtitle={c.subtitle} />
        <ErrorPanel code={res.code} retryHref="/admin/abuse" />
      </>
    );
  }
  const lists = asBanLists(res.data);

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      <div className="flex flex-col gap-5">
        <Section id="phones" title={c.phoneTitle} description={c.phoneBody}>
          {isAdmin && (
            <div className="mb-4">
              <BanPhoneForm />
            </div>
          )}
          {lists.phones.length === 0 ? (
            <p className="py-2 text-[14px] text-ink-soft">{c.phonesEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {lists.phones.map((p) => (
                <li key={p.phone_key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium tabular-nums" dir="ltr">
                      {p.phone_hint ?? p.phone_key}
                    </p>
                    <p className="mt-0.5 break-words text-[13px] text-ink-soft">“{p.reason}”</p>
                    <When value={p.created_at} />
                  </div>
                  {isAdmin && <UnbanPhoneButton phoneKey={p.phone_key} hint={p.phone_hint ?? p.phone_key} />}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="profiles" title={c.profilesTitle} description={c.profilesBody}>
          <ProfileSearch canBan={isAdmin} />
          <h3 className="mb-2 mt-6 text-[14px] font-semibold text-ink">{c.bannedProfiles}</h3>
          {lists.profiles.length === 0 ? (
            <p className="py-2 text-[14px] text-ink-soft">{c.bannedProfilesEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {lists.profiles.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                      {p.full_name}
                      <Pill tone="danger" size="sm">
                        {ADMIN_COPY.shop.banned}
                      </Pill>
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {c.roleLabels[p.role] ?? p.role}
                      {p.phone_masked ? (
                        <>
                          {" · "}
                          <span dir="ltr">{p.phone_masked}</span>
                        </>
                      ) : null}
                      {" · "}
                      {formatDate(p.banned_at)}
                    </p>
                  </div>
                  {isAdmin && <ProfileBanButton profileId={p.id} name={p.full_name} banned />}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="shops" title={c.shopsTitle}>
          {lists.shops.length === 0 ? (
            <p className="py-2 text-[14px] text-ink-soft">{c.shopsEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {lists.shops.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/shops/${s.id}`}
                      className="rounded text-[14px] font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {s.name}
                    </Link>
                    <p className="text-[12px] text-ink-muted" dir="ltr">
                      /{s.slug}
                    </p>
                  </div>
                  <When value={s.suspended_at} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
