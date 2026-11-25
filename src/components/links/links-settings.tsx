"use client";

import React, { useId, useState } from "react";
import {
  AlertCircle, BarChart3, ExternalLink, Globe, Link2, Loader2, MessageCircle, Palette, QrCode, Share2,
} from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { dbErrorMessage } from "@/components/team/shifts";
import { cn } from "@/lib/utils";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CopyButton, CopyField } from "./copy-field";
import { QrPoster } from "./qr-poster";
import {
  LINK_ACCENTS, WELCOME_MAX, brandedLink, buildFunnel, buttonSnippet, embedSnippet, fillTemplate, parseLinkTheme,
  serializeLinkTheme, whatsappShareUrl, type BookingLinkTheme, type LinkChannel, type LinkSource,
} from "./link-utils";
import { STATS_PERIODS, channelLinks, linkSiteOrigin, type StatsPeriod } from "./links-settings-logic";

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-5";
const h2 = "m-0 flex items-center gap-2 text-base font-bold text-[var(--text-primary)]";
const muted = "m-0 text-sm text-[var(--text-secondary)]";

interface LinkShopRow {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string | null;
  slug_ar: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  theme: BookingLinkTheme;
}

function Section({ icon: Icon, title, description, children, id }: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className={card}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className={h2}>
          <Icon size={18} aria-hidden="true" />
          {title}
        </h2>
        {description && <p className={muted}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** /settings/links: branded link, channel links, QR posters, snippets, theme and funnel. */
export function LinksSettings() {
  const { t, locale } = useTranslation();
  const tl = t.links;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  // Rendered only after the workspace hydrates (client side), never on the server.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : linkSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, window.location.origin),
  );
  const [linkLocale, setLinkLocale] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const ids = { link: useId(), channels: useId(), qr: useId(), web: useId(), social: useId(), theme: useId(), funnel: useId() };

  const query = useSupabaseQuery<LinkShopRow>(
    async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, name_ar, slug, slug_ar, is_published, marketplace_visible, booking_link_theme")
        .eq("id", shopId)
        .maybeSingle();
      if (error) return { data: null, error: { message: error.message } };
      if (!data) return { data: null, error: { message: "NOT_FOUND" } };
      const r = data as unknown as Record<string, unknown>;
      return {
        data: {
          id: String(r.id),
          name: String(r.name ?? ""),
          name_ar: (r.name_ar as string | null) ?? null,
          slug: (r.slug as string | null) ?? null,
          slug_ar: (r.slug_ar as string | null) ?? null,
          is_published: r.is_published === true,
          marketplace_visible: r.marketplace_visible !== false,
          theme: parseLinkTheme(r.booking_link_theme),
        },
        error: null,
      };
    },
    [supabase, shopId],
    { enabled: !!shopId, retryCount: 0 },
  );

  if (query.initialLoading || (!query.data && !query.error)) return <ListSkeleton rows={5} />;
  if (query.error || !query.data) {
    return (
      <EmptyState
        tone="error" icon={AlertCircle} title={tl.settings.loadError} description={t.error.message}
        action={{ label: t.error.tryAgain, onClick: query.refetch }}
      />
    );
  }

  const shop = query.data;
  const name = (linkLocale === "ar" && shop.name_ar) || shop.name || shop.name_ar || "";
  const link = (src?: LinkSource) => brandedLink({ origin, locale: linkLocale, shop, src });
  const mainLink = link("link");
  const qrLink = brandedLink({ origin, locale: linkLocale, shop, src: "qr" });

  return (
    <div className="flex flex-col gap-5">
      {/* ── Your link ── */}
      <Section id={ids.link} icon={Link2} title={tl.settings.linkTitle} description={tl.settings.linkDescription}>
        <div className="flex flex-wrap items-center gap-2">
          {!shop.marketplace_visible && <Pill tone="neutral" size="sm">{tl.settings.linkOnly}</Pill>}
          {!shop.is_published && <Pill tone="brass" size="sm">{tl.settings.notPublished}</Pill>}
        </div>
        <LinkLocaleToggle value={linkLocale} onChange={setLinkLocale} />
        <CopyField label={tl.settings.yourLink} value={mainLink} hint={tl.settings.linkHint} copyLabel={tl.settings.copyLink} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={mainLink} target="_blank" rel="noopener noreferrer" className={BUTTON_SECONDARY}>
            <ExternalLink size={16} aria-hidden="true" className="rtl:-scale-x-100" />
            <span>{tl.settings.openLink}</span>
          </a>
          <a
            href={whatsappShareUrl(fillTemplate(tl.share.whatsappMessage, { name, link: link("wa") }))}
            target="_blank" rel="noopener noreferrer" className={BUTTON_SECONDARY}
          >
            <Share2 size={16} aria-hidden="true" />
            <span>{tl.settings.shareWhatsapp}</span>
          </a>
        </div>
      </Section>

      {/* ── Per-channel links ── */}
      <Section id={ids.channels} icon={BarChart3} title={tl.channelsSection.title} description={tl.channelsSection.description}>
        <ul role="list" className="m-0 flex list-none flex-col divide-y divide-[var(--border-subtle)] p-0">
          {channelLinks(origin, linkLocale, shop).map((row) => (
            <li key={row.src} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{tl.channels[row.src]}</p>
                <p dir="ltr" className="m-0 truncate text-start text-xs text-[var(--text-muted)]">{row.url}</p>
              </div>
              <CopyButton value={row.url} label={interpolate(tl.channelsSection.copyFor, { channel: tl.channels[row.src] })}
                className="shrink-0 self-start sm:self-auto" />
            </li>
          ))}
        </ul>
      </Section>

      {/* ── QR posters ── */}
      <Section id={ids.qr} icon={QrCode} title={tl.poster.title} description={tl.poster.description}>
        <QrPoster url={qrLink} shopName={shop.name} shopNameAr={shop.name_ar} slug={shop.slug || shop.id} />
      </Section>

      {/* ── Website ── */}
      <Section id={ids.web} icon={Globe} title={tl.website.title} description={tl.website.description}>
        <WebsiteSnippets link={link("web")} embedLink={brandedLink({ origin, locale: linkLocale, shop, src: "web", embed: true })}
          name={name} dir={linkLocale === "ar" ? "rtl" : "ltr"} labelLocale={linkLocale} accent={shop.theme.accent} />
      </Section>

      {/* ── WhatsApp Business & social ── */}
      <Section id={ids.social} icon={MessageCircle} title={tl.social.title} description={tl.social.description}>
        <SocialGuides name={name} link={link} />
      </Section>

      {/* ── Theme ── */}
      <Section id={ids.theme} icon={Palette} title={tl.theme.title} description={tl.theme.description}>
        <ThemeEditor key={JSON.stringify(shop.theme)} shopId={shop.id} initial={shop.theme} onSaved={query.refetch} previewHref={mainLink} />
      </Section>

      {/* ── Funnel ── */}
      <Section id={ids.funnel} icon={BarChart3} title={tl.funnel.title} description={tl.funnel.description}>
        <LinkFunnel />
      </Section>
    </div>
  );
}

function LinkLocaleToggle({ value, onChange }: { value: "ar" | "en"; onChange: (v: "ar" | "en") => void }) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-semibold text-[var(--text-primary)]">{t.links.settings.linkLanguage}</legend>
      <div className="flex w-max gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
        {(["ar", "en"] as const).map((l) => (
          <label key={l} className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent-brass)]",
            value === l ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
          )}>
            <input type="radio" name={name} className="sr-only" checked={value === l} onChange={() => onChange(l)} />
            {l === "ar" ? t.links.poster.langAr : t.links.poster.langEn}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function WebsiteSnippets({ link, embedLink, name, dir, labelLocale, accent }: {
  link: string;
  embedLink: string;
  name: string;
  dir: "ltr" | "rtl";
  labelLocale: "ar" | "en";
  accent: BookingLinkTheme["accent"];
}) {
  const { t } = useTranslation();
  const tw = t.links.website;
  const label = labelLocale === "ar" ? tw.buttonLabelAr : tw.buttonLabelEn;
  const button = buttonSnippet(link, label, accent, dir);
  const embed = embedSnippet(embedLink, interpolate(t.links.page.bookAt, { name }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{tw.buttonPreview}</p>
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          {/* Same markup the snippet produces (rendered by the browser, not injected). */}
          <a href={link} target="_blank" rel="noopener noreferrer" dir={dir}
            className={cn("focus-ring inline-block rounded-lg border-2 px-7 py-3.5 text-base font-bold no-underline",
              accent === "brass" ? "border-[#7c5a26] bg-[#7c5a26] text-white"
                : accent === "paper" ? "border-[#1c1611] bg-white text-[#1c1611]"
                  : "border-[#1c1611] bg-[#1c1611] text-white")}>
            {label}
          </a>
        </div>
      </div>
      <CopyField label={tw.buttonCode} value={button} multiline hint={tw.buttonHint} />
      <CopyField label={tw.embedCode} value={embed} multiline hint={tw.embedHint} />
    </div>
  );
}

function SocialGuides({ name, link }: { name: string; link: (src?: LinkSource) => string }) {
  const { t } = useTranslation();
  const ts = t.links.social;
  const guides: { src: LinkSource; title: string; steps: string[] }[] = [
    { src: "wa", title: ts.whatsappTitle, steps: [ts.whatsappStep1, ts.whatsappStep2, ts.whatsappStep3] },
    { src: "ig", title: ts.instagramTitle, steps: [ts.instagramStep1, ts.instagramStep2, ts.instagramStep3] },
    { src: "fb", title: ts.facebookTitle, steps: [ts.facebookStep1, ts.facebookStep2, ts.facebookStep3] },
    { src: "google", title: ts.googleTitle, steps: [ts.googleStep1, ts.googleStep2] },
  ];
  const waMessage = fillTemplate(t.links.share.whatsappMessage, { name, link: link("wa") });
  return (
    <div className="flex flex-col gap-4">
      <CopyField label={ts.quickReply} value={waMessage} multiline hint={ts.quickReplyHint} />
      <div className="grid gap-3 md:grid-cols-2">
        {guides.map((g) => (
          <div key={g.src} className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-4">
            <h3 className="m-0 text-sm font-bold text-[var(--text-primary)]">{g.title}</h3>
            <ol className="m-0 flex list-decimal flex-col gap-1 ps-5 text-sm text-[var(--text-secondary)]">
              {g.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <CopyButton value={link(g.src)} label={interpolate(t.links.channelsSection.copyFor, { channel: t.links.channels[g.src] })}
              className="self-start" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeEditor({ shopId, initial, onSaved, previewHref }: {
  shopId: string;
  initial: BookingLinkTheme;
  onSaved: () => void;
  previewHref: string;
}) {
  const { t } = useTranslation();
  const tt = t.links.theme;
  const supabase = useSupabase();
  const [draft, setDraft] = useState<BookingLinkTheme>(initial);
  const [saving, setSaving] = useState(false);
  const accentName = useId();
  const enId = useId();
  const arId = useId();
  const dirty = JSON.stringify(serializeLinkTheme(draft)) !== JSON.stringify(serializeLinkTheme(initial));

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({ booking_link_theme: serializeLinkTheme(draft) } as never)
      .eq("id", shopId);
    setSaving(false);
    if (error) {
      toast.error(dbErrorMessage(t, error, tt.saveFailed));
      return;
    }
    toast.success(tt.saved);
    onSaved();
  }

  const accentLabel = { ink: tt.accentInk, brass: tt.accentBrass, paper: tt.accentPaper };
  const swatch = { ink: "bg-[#1c1611]", brass: "bg-[#7c5a26]", paper: "bg-white border border-[#ede3cd]" };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm font-semibold text-[var(--text-primary)]">{tt.accent}</legend>
        <div className="flex flex-wrap gap-2">
          {LINK_ACCENTS.map((a) => (
            <label key={a} className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent-brass)]",
              draft.accent === a ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)]" : "border-[var(--border-subtle)]",
            )}>
              <input type="radio" name={accentName} className="sr-only" checked={draft.accent === a}
                onChange={() => setDraft({ ...draft, accent: a })} />
              <span aria-hidden="true" className={cn("size-5 rounded-full", swatch[a])} />
              {accentLabel[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        {([["show_cover", tt.showCover], ["show_logo", tt.showLogo]] as const).map(([key, label]) => (
          <label key={key} className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="focus-ring size-5 accent-[var(--cta-bg)]" checked={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
      {([["welcome_ar", arId, tt.welcomeAr, "rtl"], ["welcome_en", enId, tt.welcomeEn, "ltr"]] as const).map(([key, id, label, dir]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm font-semibold text-[var(--text-primary)]">{label}</label>
          <textarea
            id={id}
            dir={dir}
            rows={2}
            maxLength={WELCOME_MAX}
            value={draft[key] ?? ""}
            placeholder={tt.welcomePlaceholder}
            aria-describedby={`${id}-count`}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            className="focus-ring w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <p id={`${id}-count`} className="m-0 text-end text-xs text-[var(--text-muted)]">
            {interpolate(tt.charCount, { count: String((draft[key] ?? "").length), max: String(WELCOME_MAX) })}
          </p>
        </div>
      ))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={BUTTON_PRIMARY} disabled={!dirty || saving} aria-busy={saving}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          <span>{tt.save}</span>
        </button>
        <a href={previewHref} target="_blank" rel="noopener noreferrer" className={BUTTON_SECONDARY}>
          <ExternalLink size={16} aria-hidden="true" className="rtl:-scale-x-100" />
          <span>{tt.preview}</span>
        </a>
      </div>
    </form>
  );
}

function LinkFunnel() {
  const { t, formatNumber, formatPercent } = useTranslation();
  const tf = t.links.funnel;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const [days, setDays] = useState<StatsPeriod>(30);
  const periodId = useId();
  const query = useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc("get_link_stats" as never, { p_days: days } as never);
      if (error) return { data: null, error: { message: error.message } };
      return { data: buildFunnel(data), error: null };
    },
    [supabase, shopId, days],
    { enabled: !!shopId, retryCount: 0 },
  );
  const funnel = query.data;
  const channelLabel = (c: LinkChannel) => t.links.channels[c];
  const pct = (v: number | null) => (v === null ? "—" : formatPercent(v, 0));

  const renderBody = () => {
    if (query.initialLoading || (!funnel && !query.error)) return <ListSkeleton rows={3} />;
    if (query.error || !funnel) {
      return <EmptyState size="sm" tone="error" icon={AlertCircle} title={tf.loadError}
        action={{ label: t.error.tryAgain, onClick: query.refetch }} />;
    }
    if (funnel.rows.length === 0) {
      return <EmptyState size="sm" icon={BarChart3} title={tf.emptyTitle} description={tf.emptyDescription} />;
    }
    return (
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <caption className="sr-only">{interpolate(tf.caption, { days: formatNumber(days) })}</caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
              <th scope="col" className="py-2 pe-3 text-start font-semibold">{tf.channel}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{tf.visits}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{tf.bookings}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{tf.conversion}</th>
              <th scope="col" className="py-2 ps-3 text-end font-semibold">{tf.completed}</th>
            </tr>
          </thead>
          <tbody>
            {funnel.rows.map((r) => (
              <tr key={r.channel} className="border-b border-[var(--border-subtle)]">
                <th scope="row" className="py-2.5 pe-3 text-start font-medium text-[var(--text-primary)]">{channelLabel(r.channel)}</th>
                <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(r.visits)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(r.bookings)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{pct(r.conversion)}</td>
                <td className="py-2.5 ps-3 text-end tabular-nums">{formatNumber(r.completed)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold text-[var(--text-primary)]">
              <th scope="row" className="py-2.5 pe-3 text-start">{tf.total}</th>
              <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(funnel.totals.visits)}</td>
              <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(funnel.totals.bookings)}</td>
              <td className="px-3 py-2.5 text-end tabular-nums">{pct(funnel.totals.conversion)}</td>
              <td className="py-2.5 ps-3 text-end tabular-nums">{formatNumber(funnel.totals.completed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor={periodId} className="text-sm font-semibold text-[var(--text-primary)]">{tf.period}</label>
        <select
          id={periodId}
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as StatsPeriod)}
          className="focus-ring min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)]"
        >
          {STATS_PERIODS.map((d) => (
            <option key={d} value={d}>{interpolate(tf.lastDays, { days: formatNumber(d) })}</option>
          ))}
        </select>
        {query.refreshing && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label={t.common.loading} />}
      </div>
      {renderBody()}
      <p className="m-0 text-xs text-[var(--text-muted)]">{tf.note}</p>
    </div>
  );
}

