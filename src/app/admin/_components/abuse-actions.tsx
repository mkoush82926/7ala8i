"use client";

import { useId, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { searchProfiles, setPhoneBanned } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatDate } from "@/lib/admin/format";
import type { ProfileSearchRow } from "@/lib/admin/types";
import { phoneDigits } from "@/lib/admin/validation";
import { ReasonDialog } from "./reason-dialog";
import { ProfileBanButton } from "./shop-actions";

const inputCls =
  "h-11 w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] aria-[invalid=true]:border-[var(--accent-rose)]";

export function BanPhoneForm() {
  const [phone, setPhone] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const id = useId();
  const c = ADMIN_COPY.abuse;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneDigits(phone)) {
      setInvalid(true);
      return;
    }
    setOpen(true);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor={`${id}-phone`} className="sr-only">
          {c.phoneLabel}
        </label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setInvalid(false);
          }}
          placeholder={c.phonePlaceholder}
          maxLength={32}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          className={inputCls}
        />
        {invalid && (
          <p id={`${id}-err`} className="mt-1 text-[12px] text-[var(--accent-rose)]">
            {c.phoneInvalid}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-destructive">
        {c.banPhone}
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={c.banPhoneTitle}
        description={<span dir="ltr">{phone}</span>}
        confirmLabel={c.banPhone}
        destructive
        successMessage={c.phoneBanned}
        onSubmit={(reason) => setPhoneBanned(phone, true, reason)}
        onDone={() => setPhone("")}
      />
    </form>
  );
}

export function UnbanPhoneButton({ phoneKey, hint }: { phoneKey: string; hint: string }) {
  const [open, setOpen] = useState(false);
  const c = ADMIN_COPY.abuse;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-[var(--radius)] border border-[var(--border-subtle)] px-3 text-[13px] font-medium hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
      >
        {c.unbanPhone}
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={c.unbanPhoneTitle}
        description={<span dir="ltr">{hint}</span>}
        confirmLabel={c.unbanPhone}
        successMessage={c.phoneUnbanned}
        onSubmit={(reason) => setPhoneBanned(phoneKey, false, reason)}
      />
    </>
  );
}

export function ProfileSearch({ canBan }: { canBan: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileSearchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const c = ADMIN_COPY.abuse;

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      setError(c.profileSearchHint);
      return;
    }
    startTransition(async () => {
      const res = await searchProfiles(q);
      if (res.ok) {
        setRows(res.data as ProfileSearchRow[]);
        setError(null);
      } else {
        setRows(null);
        setError(res.message);
      }
    });
  };

  return (
    <div>
      <form role="search" onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-q`} className="sr-only">
          {c.profileSearchLabel}
        </label>
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={c.profileSearchPlaceholder}
            maxLength={100}
            autoComplete="off"
            aria-describedby={error ? `${id}-err` : undefined}
            className={`${inputCls} ps-9`}
          />
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-secondary">
          {pending ? ADMIN_COPY.common.loading : ADMIN_COPY.common.search}
        </button>
      </form>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-[13px] text-[var(--accent-rose)]">
          {error}
        </p>
      )}
      <div aria-live="polite" aria-busy={pending}>
        {rows && rows.length === 0 && (
          <p className="mt-4 text-[14px] text-[var(--text-secondary)]">{c.profileSearchEmpty}</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    {p.full_name}
                    {p.platform_role && (
                      <Pill tone="ink" size="sm">
                        {c.platformStaff}
                      </Pill>
                    )}
                    {p.banned_at && (
                      <Pill tone="danger" size="sm">
                        {ADMIN_COPY.shop.banned}
                      </Pill>
                    )}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {[c.roleLabels[p.role] ?? p.role, p.shop_name, formatDate(p.created_at)].filter(Boolean).join(" · ")}
                    {p.phone_masked ? (
                      <>
                        {" · "}
                        <span dir="ltr">{p.phone_masked}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {canBan && (
                  <ProfileBanButton
                    profileId={p.id}
                    name={p.full_name}
                    banned={!!p.banned_at}
                    disabled={!!p.platform_role && !p.banned_at}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
