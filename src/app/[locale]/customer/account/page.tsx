"use client";

// WS-1J · Customer account hub: profile, language + digits, notifications,
// shops linked to this identity, and PDPL controls (consent history, data
// export as JSON/CSV, account deletion).

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe,
  Loader2,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
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
import { CustomerBottomNav } from "./account-nav";

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> };

function writeDigitCookie(pref: DigitPreference) {
  try {
    document.cookie = `${DIGIT_PREFERENCE_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function Section({ id, icon: Icon, title, description, children }: {
  id: string;
  icon: typeof UserRound;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--accent-brass)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="m-0 text-[16px] font-extrabold text-[var(--text-primary)]">
            {title}
          </h2>
          {description && <p className="m-0 mt-0.5 text-[13px] text-[var(--text-secondary)]">{description}</p>}
        </div>
      </div>
      {children}
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
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-bold text-[var(--text-primary)]">
          {label}
        </label>
        {hint && <p id={`${id}-hint`} className="m-0 mt-0.5 text-[12px] text-[var(--text-secondary)]">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{ background: checked ? "var(--accent-brass)" : "var(--border-primary)" }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 h-5 w-5 rounded-full bg-[var(--bg-primary)] shadow transition-[inset-inline-start]"
          style={{ insetInlineStart: checked ? 24 : 4 }}
        />
      </button>
    </div>
  );
}

export default function CustomerAccountPage() {
  const router = useRouter();
  const { t, dir, isRTL, FF, FFD, href, locale, switchLocale, formatDate, formatNumber } = useTranslation();
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
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const digitsSample = (pref: DigitPreference) => localizeDigits("12:30 · 7.500", locale, pref);
  const channelLabel = (c: NotifyChannel) => a.channels[c];
  const purposeLabel = (p: string) => (a.purposes as Record<string, string>)[p] ?? p;

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: FF }} dir={dir}>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 sm:px-6">
        <Link href={href("/customer")} className="btn btn-ghost text-[13px]" style={{ minHeight: 40, paddingInline: 10 }}>
          <BackIcon size={16} aria-hidden="true" />
          {t.customer.myAppointments}
        </Link>
        <Link href={href("/landing")} dir="ltr" className="rounded-sm text-[17px] font-black" style={{ fontFamily: FFD }}>
          Halaqy<span className="text-[var(--accent-brass)]">.</span>
        </Link>
      </header>

      <main id="main" className="mx-auto max-w-[720px] px-4 pb-32 pt-8 sm:px-5 lg:pb-16">
        <p className="mb-1 text-[11px] font-bold text-[var(--text-secondary)]" style={{ letterSpacing: headingTracking(isRTL, "0.08em") }}>
          {a.eyebrow}
        </p>
        <h1 className="m-0 mb-6 font-black" style={{ fontSize: "clamp(24px, 4vw, 34px)", fontFamily: FFD }}>
          {a.title}
        </h1>

        {status === "loading" ? (
          <SkeletonGroup className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[12px] border border-[var(--border-subtle)] p-6 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-2/3" />
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
          <div className="flex flex-col gap-4">
            {welcome && (
              <div role="status" className="flex items-start gap-3 rounded-[12px] bg-[var(--bg-secondary)] p-4 sm:p-5">
                <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-brass)]" />
                <div>
                  <p className="m-0 text-[14px] font-extrabold">{a.welcomeTitle}</p>
                  <p className="m-0 mt-0.5 text-[13px] text-[var(--text-secondary)]">{a.welcomeBody}</p>
                </div>
              </div>
            )}

            {/* ── Profile ── */}
            <Section id="acc-profile" icon={UserRound} title={a.profileTitle} description={a.profileDesc}>
              <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
                <div>
                  <label htmlFor={ids.name} className="field-label">
                    {t.customer.fullName}
                  </label>
                  <input
                    id={ids.name}
                    type="text"
                    autoComplete="name"
                    className="field-input w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoFocus={welcome}
                    aria-invalid={!!profileErrors.name}
                    aria-describedby={profileErrors.name ? `${ids.name}-err` : undefined}
                  />
                  {profileErrors.name && (
                    <p id={`${ids.name}-err`} className="field-error" role="alert">
                      {profileErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={ids.phone} className="field-label">
                    {a.contactPhone}
                  </label>
                  <input
                    id={ids.phone}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    className="field-input w-full text-start"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                    aria-invalid={!!profileErrors.phone}
                    aria-describedby={`${ids.phone}-hint`}
                  />
                  <p id={`${ids.phone}-hint`} className={profileErrors.phone ? "field-error" : "m-0 mt-1.5 text-xs text-[var(--text-muted)]"} role={profileErrors.phone ? "alert" : undefined}>
                    {profileErrors.phone ?? a.contactPhoneHint}
                  </p>
                </div>
                {account.email && (
                  <div>
                    <label htmlFor={ids.email} className="field-label">
                      {t.customer.email}
                    </label>
                    <input id={ids.email} type="email" dir="ltr" className="field-input w-full" value={account.email} readOnly aria-readonly="true" style={{ opacity: 0.75 }} />
                  </div>
                )}
                <div>
                  <p className="field-label m-0">{a.verifiedPhones}</p>
                  {account.verifiedPhones.length === 0 ? (
                    <p className="m-0 text-[13px] text-[var(--text-secondary)]">
                      {a.noVerifiedPhone}{" "}
                      <Link href={href("/customer/login")} className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                        {a.verifyPhoneCta}
                      </Link>
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {account.verifiedPhones.map((p) => (
                        <li key={p.phone}>
                          <Pill tone="success" icon={<ShieldCheck size={13} aria-hidden="true" />}>
                            <span dir="ltr">{maskForDisplay(p.phone)}</span>
                          </Pill>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary" disabled={savingProfile} aria-busy={savingProfile} style={{ minHeight: 44 }}>
                    {savingProfile && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    {savingProfile ? t.customer.saving : t.common.save}
                  </button>
                </div>
              </form>
            </Section>

            {/* ── Language & digits ── */}
            <Section id="acc-lang" icon={Globe} title={a.languageTitle} description={a.languageDesc}>
              <fieldset className="m-0 mb-5 border-0 p-0">
                <legend className="field-label">{a.language}</legend>
                <div className="grid grid-cols-2 gap-2">
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
                        className="min-h-[44px] rounded-[8px] border text-[14px] font-bold transition-colors disabled:opacity-60"
                        style={{
                          borderColor: selected ? "var(--accent-brass)" : "var(--border-subtle)",
                          background: selected ? "var(--bg-secondary)" : "transparent",
                        }}
                      >
                        {lang === "ar" ? "العربية" : "English"}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="m-0 border-0 p-0">
                <legend className="field-label">{a.digits}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DIGIT_PREFERENCES.map((pref) => {
                    const selected = account.digitPreference === pref;
                    return (
                      <button
                        key={pref}
                        type="button"
                        aria-pressed={selected}
                        disabled={savingPref !== null}
                        onClick={() => changeDigits(pref)}
                        className="flex min-h-[52px] flex-col items-start justify-center rounded-[8px] border px-3 py-2 text-start transition-colors disabled:opacity-60"
                        style={{
                          borderColor: selected ? "var(--accent-brass)" : "var(--border-subtle)",
                          background: selected ? "var(--bg-secondary)" : "transparent",
                        }}
                      >
                        <span className="text-[13px] font-bold">{a.digitOptions[pref]}</span>
                        <span className="text-[12px] text-[var(--text-secondary)] tabular-nums" dir="ltr">
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
              <div className="divide-y divide-[var(--border-subtle)]">
                <Toggle
                  id={ids.rem}
                  label={a.reminders}
                  hint={a.remindersHint}
                  checked={account.notifyReminders}
                  disabled={savingPref !== null}
                  onChange={(v) => savePreference("reminders", { notify_reminders: v })}
                />
                <fieldset className="m-0 border-0 px-0 py-3">
                  <legend className="mb-2 text-[14px] font-bold">{a.channel}</legend>
                  <div className="flex flex-wrap gap-2">
                    {NOTIFY_CHANNELS.map((c) => {
                      const selected = account.notifyChannel === c;
                      const unavailable = c === "email" && !account.email;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={selected}
                          disabled={savingPref !== null || unavailable}
                          title={unavailable ? a.emailUnavailable : undefined}
                          onClick={() => savePreference("channel", { notify_channel: c })}
                          className="min-h-[40px] rounded-full border px-4 text-[13px] font-bold transition-colors disabled:opacity-50"
                          style={{
                            borderColor: selected ? "var(--accent-brass)" : "var(--border-subtle)",
                            background: selected ? "var(--bg-secondary)" : "transparent",
                          }}
                        >
                          {channelLabel(c)}
                        </button>
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
                <ul className="m-0 flex list-none flex-col divide-y divide-[var(--border-subtle)] p-0">
                  {account.linkedShops.map((s) => (
                    <li key={s.shopId} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[14px] font-bold">{(locale === "ar" && s.shopNameAr) || s.shopName}</p>
                        <p className="m-0 text-[12px] text-[var(--text-secondary)]">
                          {interpolate(a.visits, { count: formatNumber(s.visits) })}
                        </p>
                      </div>
                      <Link href={href(`/book/${s.slug || s.shopId}?entry=rebook&src=account`)} className="btn btn-secondary shrink-0 text-[12px]" style={{ minHeight: 36, paddingInline: 14 }}>
                        {t.customer.bookAgain}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ── Privacy & data (PDPL) ── */}
            <Section id="acc-privacy" icon={ShieldCheck} title={a.privacyTitle} description={a.privacyDesc}>
              <h3 className="m-0 mb-2 text-[14px] font-bold">{a.consentsTitle}</h3>
              {consents.length === 0 ? (
                <p className="m-0 mb-5 text-[13px] text-[var(--text-secondary)]">{a.consentsEmpty}</p>
              ) : (
                <ul className="m-0 mb-5 flex list-none flex-col gap-1.5 p-0">
                  {consents.map((c) => (
                    <li key={`${c.purpose}-${c.channel ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold">
                        {purposeLabel(c.purpose)}
                        {c.channel && (c.purpose === "reminders" || c.purpose === "marketing") ? ` · ${channelLabel(c.channel)}` : ""}
                      </span>
                      <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Pill tone={c.granted ? "success" : "neutral"} size="sm">
                          {c.granted ? a.granted : a.withdrawn}
                        </Pill>
                        {c.createdAt && <time dateTime={c.createdAt}>{formatDate(c.createdAt, "medium")}</time>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="m-0 mb-1 text-[14px] font-bold">{a.exportTitle}</h3>
              <p className="m-0 mb-3 text-[13px] text-[var(--text-secondary)]">{a.exportDesc}</p>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn btn-secondary flex-1" style={{ minHeight: 44 }} disabled={!!exporting} aria-busy={exporting === "json"} onClick={() => exportData("json")}>
                  {exporting === "json" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileJson size={16} aria-hidden="true" />}
                  {a.exportJson}
                </button>
                <button type="button" className="btn btn-secondary flex-1" style={{ minHeight: 44 }} disabled={!!exporting} aria-busy={exporting === "csv"} onClick={() => exportData("csv")}>
                  {exporting === "csv" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
                  {a.exportCsv}
                </button>
              </div>
              {lastExport && (
                <p role="status" className="m-0 mb-2 flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                  <Download size={13} aria-hidden="true" />
                  {interpolate(a.exportSummary, { rows: formatNumber(lastExport.rows), sections: formatNumber(lastExport.sections) })}
                </p>
              )}

              <div className="mt-6 rounded-[12px] border p-4" style={{ borderColor: "var(--accent-rose-muted)" }}>
                <h3 className="m-0 mb-1 text-[14px] font-bold text-[var(--accent-rose)]">{a.deleteTitle}</h3>
                <p className="m-0 mb-3 text-[13px] text-[var(--text-secondary)]">{a.deleteDesc}</p>
                <button
                  type="button"
                  className="btn text-[13px]"
                  style={{ minHeight: 40, background: "var(--accent-rose-muted)", color: "var(--accent-rose)" }}
                  onClick={() => {
                    setDeleteWord("");
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {a.deleteCta}
                </button>
              </div>

              <p className="m-0 mt-5 text-[13px] text-[var(--text-secondary)]">
                <Link href={href("/privacy")} className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
                  {a.readPolicy}
                </Link>
              </p>
            </Section>
          </div>
        )}
      </main>

      <CustomerBottomNav active="account" />

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
          <ul className="m-0 mb-4 list-disc ps-5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            <li>{a.deleteEffectBookings}</li>
            <li>{a.deleteEffectHistory}</li>
            <li>{a.deleteEffectSales}</li>
          </ul>
          <label htmlFor={ids.del} className="field-label">
            {interpolate(a.deleteTypeLabel, { word: DELETE_CONFIRM_WORD })}
          </label>
          <input
            id={ids.del}
            type="text"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            className="field-input w-full"
            value={deleteWord}
            onChange={(e) => setDeleteWord(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
