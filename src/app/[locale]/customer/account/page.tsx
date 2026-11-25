"use client";

// WS-1J · Customer account hub: profile, language + digits, notifications,
// shops linked to this identity, and PDPL controls (consent history, data
// export as JSON/CSV, account deletion).

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { FilterChip, Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { PhotoFrame } from "@/components/ui/photo-frame";
import {
  buttonClasses,
  errorTextClasses,
  focusRing,
  helperClasses,
  inputClasses,
  labelClasses,
  textLinkClasses,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { DIGIT_PREFERENCES, DIGIT_PREFERENCE_COOKIE, localizeDigits, type DigitPreference } from "@/lib/format";
import { maskForDisplay } from "@/lib/otp/phone";
import {
  DELETE_CONFIRM_WORD,
  NOTIFY_CHANNELS,
  diffAccount,
  downloadExport,
  isMissingRpc,
  latestConsents,
  parseAccount,
  privacyErrorCode,
  summarizeExport,
  type AccountPatch,
  type ExportFormat,
  type MyAccount,
  type NotifyChannel,
  type PreferredLanguage,
} from "@/lib/privacy";
import { isValidOptionalPhone, normalizeOptionalPhone } from "../customer-utils";
import { PortalShell } from "../_components/portal-shell";

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> };

function writeDigitCookie(pref: DigitPreference) {
  try {
    document.cookie = `${DIGIT_PREFERENCE_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function Section({ id, icon: Icon, title, description, children, tone = "neutral" }: {
  id: string;
  icon: typeof UserRound;
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <section
      id={`${id}-section`}
      aria-labelledby={id}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-card shadow-card"
    >
      <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            tone === "danger" ? "bg-danger-soft text-danger-text" : "bg-brand-soft text-brand-text",
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-h3 m-0 text-ink">
            {title}
          </h2>
          {description && <p className="m-0 mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function Toggle({ id, checked, onChange, disabled, label, hint }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold text-ink">
          {label}
        </label>
        {hint && <p id={`${id}-hint`} className="m-0 mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-state={checked ? "on" : "off"}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ease-standard motion-reduce:transition-none",
          "bg-line-strong data-[state=on]:bg-brand disabled:cursor-not-allowed disabled:opacity-45",
          focusRing,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform duration-150 ease-standard motion-reduce:transition-none",
            checked && "translate-x-5 rtl:-translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/** Selectable option (language, digits, channel): v2 selectable-row look. */
const choiceClasses = cn(
  "cursor-pointer rounded-xl border border-line bg-card text-ink transition-[border-color,background-color,box-shadow] duration-150 ease-standard",
  "hover:border-ink-soft aria-pressed:border-brand aria-pressed:bg-brand-soft/50 aria-pressed:ring-1 aria-pressed:ring-brand",
  "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
  focusRing,
);

export default function CustomerAccountPage() {
  const router = useRouter();
  const { t, href, locale, switchLocale, formatDate, formatNumber } = useTranslation();
  const a = t.customerAccount;
  const [supabase] = useState(() => createClient());
  const db = supabase as unknown as Db;
  const ids = { name: useId(), phone: useId(), email: useId(), rem: useId(), mkt: useId(), del: useId() };

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [welcome, setWelcome] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileErrors, setProfileErrors] = useState<{ name?: string; phone?: string }>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [lastExport, setLastExport] = useState<{ rows: number; sections: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");

  const errorText = useCallback(
    (error: { message?: string } | null | undefined) => {
      const code = privacyErrorCode(error);
      const codes = (t.error as { codes?: Record<string, string> }).codes ?? {};
      return (code && (a.errors as Record<string, string>)[code]) || (code && codes[code]) || t.error.message;
    },
    [a.errors, t.error],
  );

  const applyAccount = useCallback((next: MyAccount) => {
    setAccount(next);
    // Phone-login accounts start with a masked number as their name.
    setName(next.fullName.includes("\u2022") ? "" : next.fullName);
    setPhone(next.phone ?? "");
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace(href(`/customer/login?next=${encodeURIComponent(`/${locale}/customer/account`)}`));
        return;
      }
      // Attach any guest bookings made with a verified phone/email (all shops).
      const claim = await db.rpc("claim_customer_identity");
      if (claim.error && isMissingRpc(claim.error)) await db.rpc("link_customer_client");

      const { data, error } = await db.rpc("get_my_account");
      const parsed = error ? null : parseAccount(data);
      if (!parsed) {
        setStatus("error");
        return;
      }
      if (parsed.role !== "customer") {
        router.replace(href("/"));
        return;
      }
      applyAccount(parsed);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [supabase, db, router, href, locale, applyAccount]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("welcome") === "1") {
        setWelcome(true);
        params.delete("welcome");
        const qs = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function save(patch: AccountPatch): Promise<MyAccount | null> {
    const { data, error } = await db.rpc("update_my_account", { p_patch: patch, p_source: "account" });
    if (error) {
      toast.error(errorText(error));
      return null;
    }
    const next = parseAccount(data);
    if (next) applyAccount(next);
    return next;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    const errors: { name?: string; phone?: string } = {};
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 80) errors.name = t.customer.nameRequired;
    if (!isValidOptionalPhone(phone)) errors.phone = t.customer.phoneInvalid;
    setProfileErrors(errors);
    if (errors.name || errors.phone) return;
    const patch = diffAccount(account, { fullName: clean, phone: normalizeOptionalPhone(phone) });
    if (Object.keys(patch).length === 0) {
      toast.success(t.customer.profileSaved);
      return;
    }
    setSavingProfile(true);
    const next = await save(patch);
    setSavingProfile(false);
    if (next) {
      toast.success(t.customer.profileSaved);
      setWelcome(false);
    }
  }

  async function savePreference(key: string, patch: AccountPatch, after?: (next: MyAccount) => void) {
    if (!account || savingPref) return;
    setSavingPref(key);
    const next = await save(patch);
    setSavingPref(null);
    if (next) {
      toast.success(a.saved);
      after?.(next);
    }
  }

  function changeLanguage(lang: PreferredLanguage) {
    savePreference("language", { preferred_language: lang }, () => {
      if (lang !== locale) router.replace(switchLocale(window.location.pathname, lang));
    });
  }

  function changeDigits(pref: DigitPreference) {
    savePreference("digits", { digit_preference: pref }, () => {
      writeDigitCookie(pref);
      router.refresh();
    });
  }

  async function exportData(format: ExportFormat) {
    if (exporting) return;
    setExporting(format);
    try {
      const { data, error } = await db.rpc("export_my_data");
      if (error || !data) {
        toast.error(errorText(error));
        return;
      }
      downloadExport(data, format);
      const summary = summarizeExport(data);
      const rows = summary.reduce((n, s) => n + s.rows, 0);
      setLastExport({ rows, sections: summary.filter((s) => s.rows > 0).length });
      toast.success(a.exportReady);
    } finally {
      setExporting(null);
    }
  }

  async function deleteAccount() {
    if (deleteWord.trim().toUpperCase() !== DELETE_CONFIRM_WORD) throw new Error(interpolate(a.deleteTypeError, { word: DELETE_CONFIRM_WORD }));
    const { error } = await db.rpc("delete_my_account", { p_confirm: DELETE_CONFIRM_WORD });
    if (error) throw new Error(errorText(error));
    await supabase.auth.signOut().catch(() => undefined);
    toast.success(a.deleted);
    router.replace(href("/landing"));
  }

  const consents = useMemo(() => (account ? latestConsents(account.consents) : []), [account]);
  const digitsSample = (pref: DigitPreference) => localizeDigits("12:30 · 7.500", locale, pref);
  const channelLabel = (c: NotifyChannel) => a.channels[c];
  const purposeLabel = (p: string) => (a.purposes as Record<string, string>)[p] ?? p;

  const sectionLinks =
    status === "ok" && account
      ? [
          { href: "#acc-profile-section", label: a.profileTitle },
          { href: "#acc-lang-section", label: a.languageTitle },
          { href: "#acc-notify-section", label: a.notificationsTitle },
          { href: "#acc-shops-section", label: a.shopsTitle },
          { href: "#acc-privacy-section", label: a.privacyTitle },
        ]
      : undefined;
  const profileName = account && !account.fullName.includes("\u2022") ? account.fullName : null;
  const profileDetail = account?.email || (account?.phone ? maskForDisplay(account.phone) : null);

  return (
    <>
      <PortalShell
        active="account"
        profile={{ name: profileName, detail: profileDetail, loading: status === "loading" }}
        sectionLinks={sectionLinks}
      >
        <div className="mb-6 flex flex-col gap-1">
          <p className="m-0 text-sm font-medium text-ink-muted">{a.eyebrow}</p>
          <h1 className="text-h1 m-0 text-ink">{a.title}</h1>
        </div>

        {status === "loading" ? (
          <SkeletonGroup className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4 rounded-xl border border-line bg-card p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-2/3" />
              </div>
            ))}
          </SkeletonGroup>
        ) : status === "error" || !account ? (
          <EmptyState
            icon={UserRound}
            tone="error"
            title={a.loadErrorTitle}
            description={a.loadErrorDesc}
            action={{ label: t.common.retry, onClick: load }}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {welcome && (
              <div role="status" className="flex items-start gap-3 rounded-xl bg-success-soft p-4 sm:p-5">
                <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success-text" />
                <div>
                  <p className="m-0 text-[15px] font-semibold text-success-text">{a.welcomeTitle}</p>
                  <p className="m-0 mt-0.5 text-sm text-ink-soft">{a.welcomeBody}</p>
                </div>
              </div>
            )}

            {/* ── Profile ── */}
            <Section id="acc-profile" icon={UserRound} title={a.profileTitle} description={a.profileDesc}>
              <form onSubmit={saveProfile} noValidate className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor={ids.name} className={labelClasses}>
                      {t.customer.fullName}
                    </label>
                    <input
                      id={ids.name}
                      type="text"
                      autoComplete="name"
                      className={inputClasses()}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      autoFocus={welcome}
                      aria-invalid={!!profileErrors.name}
                      aria-describedby={profileErrors.name ? `${ids.name}-err` : undefined}
                    />
                    {profileErrors.name && (
                      <p id={`${ids.name}-err`} className={errorTextClasses} role="alert">
                        {profileErrors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={ids.phone} className={labelClasses}>
                      {a.contactPhone}
                    </label>
                    <input
                      id={ids.phone}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      className={inputClasses({ className: "text-start tabular-nums" })}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={20}
                      aria-invalid={!!profileErrors.phone}
                      aria-describedby={`${ids.phone}-hint`}
                    />
                    <p
                      id={`${ids.phone}-hint`}
                      className={profileErrors.phone ? errorTextClasses : cn(helperClasses, "m-0 mt-1.5")}
                      role={profileErrors.phone ? "alert" : undefined}
                    >
                      {profileErrors.phone ?? a.contactPhoneHint}
                    </p>
                  </div>
                </div>
                {account.email && (
                  <div>
                    <label htmlFor={ids.email} className={labelClasses}>
                      {t.customer.email}
                    </label>
                    <input
                      id={ids.email}
                      type="email"
                      dir="ltr"
                      className={inputClasses({ className: "bg-sunken text-ink-soft hover:border-line-strong focus:ring-0" })}
                      value={account.email}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                )}
                <div>
                  <p className={cn(labelClasses, "m-0 mb-2")}>{a.verifiedPhones}</p>
                  {account.verifiedPhones.length === 0 ? (
                    <p className="m-0 text-sm text-ink-muted">
                      {a.noVerifiedPhone}{" "}
                      <Link href={href("/customer/login")} className={cn("rounded-sm", textLinkClasses, focusRing)}>
                        {a.verifyPhoneCta}
                      </Link>
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {account.verifiedPhones.map((p) => (
                        <li key={p.phone}>
                          <Pill tone="success" icon={<ShieldCheck aria-hidden="true" />}>
                            <span dir="ltr" className="tabular-nums">{maskForDisplay(p.phone)}</span>
                          </Pill>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end border-t border-line pt-4">
                  <Button type="submit" loading={savingProfile} className="w-full sm:w-auto">
                    {savingProfile ? t.customer.saving : t.common.save}
                  </Button>
                </div>
              </form>
            </Section>

            {/* ── Language & digits ── */}
            <Section id="acc-lang" icon={Globe} title={a.languageTitle} description={a.languageDesc}>
              <fieldset className="m-0 mb-6 border-0 p-0">
                <legend className={labelClasses}>{a.language}</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(["ar", "en"] as const).map((lang) => {
                    const selected = (account.preferredLanguage ?? locale) === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        aria-pressed={selected}
                        disabled={savingPref !== null}
                        onClick={() => changeLanguage(lang)}
                        lang={lang}
                        className={cn(choiceClasses, "flex min-h-12 items-center justify-between gap-2 px-4 text-[15px] font-semibold")}
                      >
                        {lang === "ar" ? "العربية" : "English"}
                        {selected && <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-brand-text" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="m-0 border-0 p-0">
                <legend className={labelClasses}>{a.digits}</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {DIGIT_PREFERENCES.map((pref) => {
                    const selected = account.digitPreference === pref;
                    return (
                      <button
                        key={pref}
                        type="button"
                        aria-pressed={selected}
                        disabled={savingPref !== null}
                        onClick={() => changeDigits(pref)}
                        className={cn(choiceClasses, "flex min-h-14 flex-col items-start justify-center px-4 py-2.5 text-start")}
                      >
                        <span className="text-sm font-semibold">{a.digitOptions[pref]}</span>
                        <span className="text-[13px] tabular-nums text-ink-muted" dir="ltr">
                          {digitsSample(pref)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Section>

            {/* ── Notifications ── */}
            <Section id="acc-notify" icon={Bell} title={a.notificationsTitle} description={a.notificationsDesc}>
              <div className="divide-y divide-line">
                <Toggle
                  id={ids.rem}
                  label={a.reminders}
                  hint={a.remindersHint}
                  checked={account.notifyReminders}
                  disabled={savingPref !== null}
                  onChange={(v) => savePreference("reminders", { notify_reminders: v })}
                />
                <fieldset className="m-0 border-0 px-0 py-4">
                  <legend className="mb-2.5 text-[15px] font-semibold text-ink">{a.channel}</legend>
                  <div className="flex flex-wrap gap-2">
                    {NOTIFY_CHANNELS.map((c) => {
                      const selected = account.notifyChannel === c;
                      const unavailable = c === "email" && !account.email;
                      return (
                        <FilterChip
                          key={c}
                          pressed={selected}
                          disabled={savingPref !== null || unavailable}
                          title={unavailable ? a.emailUnavailable : undefined}
                          onClick={() => savePreference("channel", { notify_channel: c })}
                          className="h-10 px-4"
                        >
                          {channelLabel(c)}
                        </FilterChip>
                      );
                    })}
                  </div>
                </fieldset>
                <Toggle
                  id={ids.mkt}
                  label={a.marketing}
                  hint={a.marketingHint}
                  checked={account.marketingOptIn}
                  disabled={savingPref !== null}
                  onChange={(v) => savePreference("marketing", { marketing_opt_in: v })}
                />
              </div>
            </Section>

            {/* ── Linked shops ── */}
            <Section id="acc-shops" icon={Store} title={a.shopsTitle} description={a.shopsDesc}>
              {account.linkedShops.length === 0 ? (
                <EmptyState
                  size="sm"
                  bare
                  icon={Store}
                  title={a.shopsEmpty}
                  description={a.shopsEmptyDesc}
                  action={{ label: t.customer.exploreShops, href: href("/explore") }}
                />
              ) : (
                <ul className="-my-3 m-0 flex list-none flex-col divide-y divide-line p-0">
                  {account.linkedShops.map((s) => {
                    const shopName = (locale === "ar" && s.shopNameAr) || s.shopName;
                    return (
                      <li key={s.shopId} className="flex items-center gap-3 py-3">
                        <PhotoFrame
                          alt=""
                          ratio="1/1"
                          seed={s.shopId}
                          fallbackName={shopName}
                          rounded="lg"
                          className="size-11 shrink-0"
                          initialsClassName="text-sm md:text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[15px] font-semibold text-ink">{shopName}</p>
                          <p className="text-meta m-0 tabular-nums">{interpolate(a.visits, { count: formatNumber(s.visits) })}</p>
                        </div>
                        <Link
                          href={href(`/book/${s.slug || s.shopId}?entry=rebook&src=account`)}
                          className={buttonClasses({ variant: "soft", size: "sm", className: "shrink-0" })}
                        >
                          {t.customer.bookAgain}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* ── Privacy & data (PDPL) ── */}
            <Section id="acc-privacy" icon={ShieldCheck} title={a.privacyTitle} description={a.privacyDesc}>
              <h3 className="m-0 mb-3 text-[15px] font-semibold text-ink">{a.consentsTitle}</h3>
              {consents.length === 0 ? (
                <p className="m-0 mb-6 text-sm text-ink-muted">{a.consentsEmpty}</p>
              ) : (
                <ul className="m-0 mb-6 flex list-none flex-col divide-y divide-line rounded-lg border border-line p-0">
                  {consents.map((c) => (
                    <li key={`${c.purpose}-${c.channel ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                      <span className="font-medium text-ink">
                        {purposeLabel(c.purpose)}
                        {c.channel && (c.purpose === "reminders" || c.purpose === "marketing") ? ` · ${channelLabel(c.channel)}` : ""}
                      </span>
                      <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <Pill tone={c.granted ? "success" : "neutral"} size="sm">
                          {c.granted ? a.granted : a.withdrawn}
                        </Pill>
                        {c.createdAt && <time dateTime={c.createdAt} className="tabular-nums">{formatDate(c.createdAt, "medium")}</time>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="m-0 mb-1 text-[15px] font-semibold text-ink">{a.exportTitle}</h3>
              <p className="m-0 mb-3 text-sm text-ink-muted">{a.exportDesc}</p>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!!exporting}
                  loading={exporting === "json"}
                  icon={<FileJson aria-hidden="true" />}
                  onClick={() => exportData("json")}
                >
                  {a.exportJson}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!!exporting}
                  loading={exporting === "csv"}
                  icon={<FileSpreadsheet aria-hidden="true" />}
                  onClick={() => exportData("csv")}
                >
                  {a.exportCsv}
                </Button>
              </div>
              {lastExport && (
                <p role="status" className="m-0 mb-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <Download size={14} aria-hidden="true" />
                  {interpolate(a.exportSummary, { rows: formatNumber(lastExport.rows), sections: formatNumber(lastExport.sections) })}
                </p>
              )}

              <div className="mt-6 rounded-xl border border-danger/30 bg-danger-soft/40 p-4 sm:p-5">
                <h3 className="m-0 mb-1 text-[15px] font-semibold text-danger-text">{a.deleteTitle}</h3>
                <p className="m-0 mb-4 text-sm text-ink-soft">{a.deleteDesc}</p>
                <Button
                  variant="destructive-soft"
                  size="sm"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => {
                    setDeleteWord("");
                    setDeleteOpen(true);
                  }}
                >
                  {a.deleteCta}
                </Button>
              </div>

              <p className="m-0 mt-5 text-sm">
                <Link href={href("/privacy")} className={cn("rounded-sm", textLinkClasses, focusRing)}>
                  {a.readPolicy}
                </Link>
              </p>
            </Section>
          </div>
        )}
      </PortalShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteAccount}
        destructive
        title={a.deleteConfirmTitle}
        description={a.deleteConfirmDesc}
        confirmLabel={a.deleteConfirm}
        cancelLabel={a.keepAccount}
      >
        <div className="text-start">
          <ul className="m-0 mb-4 list-disc space-y-1 ps-5 text-sm leading-[22px] text-ink-soft">
            <li>{a.deleteEffectBookings}</li>
            <li>{a.deleteEffectHistory}</li>
            <li>{a.deleteEffectSales}</li>
          </ul>
          <label htmlFor={ids.del} className={labelClasses}>
            {interpolate(a.deleteTypeLabel, { word: DELETE_CONFIRM_WORD })}
          </label>
          <input
            id={ids.del}
            type="text"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            className={inputClasses()}
            value={deleteWord}
            onChange={(e) => setDeleteWord(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
