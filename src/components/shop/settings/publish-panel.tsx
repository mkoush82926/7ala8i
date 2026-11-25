"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { CHECKLIST, parseIncompleteDetail, summarizeChecklist, type ChecklistKey, type ChecklistState } from "../lib/checklist";
import { shopPath } from "../lib/slug";
import type { AnyClient } from "./types";
import { SettingsSection, Switch } from "./ui";

export interface PublishState {
  items: ChecklistState;
  is_published: boolean;
  marketplace_visible: boolean;
  slug: string | null;
}

/** Completeness score, checklist, Publish toggle and marketplace visibility. */
export function PublishPanel({
  supabase,
  shopId,
  slugAr,
  state,
  onChanged,
  canEdit,
}: {
  supabase: AnyClient;
  shopId: string;
  slugAr: string | null;
  state: PublishState;
  onChanged: () => void;
  canEdit: boolean;
}) {
  const { t, locale, href, formatNumber } = useTranslation();
  const pp = t.publicProfile;
  const summary = summarizeChecklist(state.items);
  const [busy, setBusy] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const label = (k: ChecklistKey) => pp.checklist[k];
  const publicHref = shopPath({ id: shopId, slug: state.slug, slug_ar: slugAr }, locale);

  const setPublished = async (next: boolean) => {
    setBusy(true);
    const { error } = await supabase.from("shops").update({ is_published: next }).eq("id", shopId);
    setBusy(false);
    if (error) {
      if ((error.message ?? "").includes("SHOP_INCOMPLETE")) {
        const missing = parseIncompleteDetail((error as { details?: string }).details);
        toast.error(interpolate(pp.publishBlocked, { items: missing.map(label).join(locale === "ar" ? "، " : ", ") || "-" }));
      } else {
        toast.error(pp.saveFailed);
      }
      throw error;
    }
    toast.success(next ? pp.publishedToast : pp.unpublishedToast);
    onChanged();
  };

  const setVisible = async (next: boolean) => {
    setBusy(true);
    const { error } = await supabase.from("shops").update({ marketplace_visible: next }).eq("id", shopId);
    setBusy(false);
    if (error) {
      toast.error(pp.saveFailed);
      return;
    }
    toast.success(next ? pp.listedToast : pp.linkOnlyToast);
    onChanged();
  };

  return (
    <SettingsSection
      id="publish"
      title={pp.publishTitle}
      description={pp.publishDesc}
      aside={
        <Pill tone={state.is_published ? "success" : "neutral"} size="md">
          {state.is_published ? pp.statusPublished : pp.statusDraft}
        </Pill>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-bold">{pp.completeness}</p>
            <p className="text-stat tabular-nums">{formatNumber(summary.score)}%</p>
          </div>
          <div
            className="mt-2 h-2 rounded-full bg-sunken overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.score}
            aria-label={pp.completeness}
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-enter motion-reduce:transition-none" style={{ width: `${summary.score}%` }} />
          </div>
          <ul className="mt-4 space-y-2">
            {CHECKLIST.map((item) => {
              const done = state.items[item.key] === true;
              const target = item.target.startsWith("#") ? item.target : href(item.target);
              return (
                <li key={item.key} className="flex items-center gap-2.5 text-sm">
                  {done ? (
                    <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-success" />
                  ) : (
                    <Circle size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
                  )}
                  <span className={cn("flex-1 min-w-0", done ? "text-ink-muted" : "text-ink font-semibold")}>
                    {label(item.key)}
                    <span className="sr-only"> — {done ? pp.itemDone : pp.itemMissing}</span>
                  </span>
                  {item.required && !done && (
                    <Pill tone="danger" size="sm">
                      {pp.required}
                    </Pill>
                  )}
                  {!done && (
                    <a href={target} className="focus-ring text-xs font-bold text-brand-text underline underline-offset-2">
                      {pp.fix}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-5">
          <Switch
            checked={state.is_published}
            disabled={!canEdit || busy || (!state.is_published && !summary.canPublish)}
            onChange={(next) => (next ? setPublished(true).catch(() => undefined) : setConfirmUnpublish(true))}
            label={pp.publishToggle}
            description={summary.canPublish || state.is_published ? pp.publishToggleDesc : pp.publishNeedsRequired}
          />
          <Switch
            checked={state.marketplace_visible}
            disabled={!canEdit || busy}
            onChange={setVisible}
            label={pp.marketplaceToggle}
            description={state.marketplace_visible ? pp.marketplaceListedDesc : pp.marketplaceLinkOnlyDesc}
          />
          <Link href={publicHref} target="_blank" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-brand-text underline underline-offset-2">
            {state.is_published ? pp.viewPublicPage : pp.previewPage}
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
          {summary.next && (
            <p className="text-sm text-ink-muted">
              {interpolate(pp.nextStep, { item: label(summary.next.key) })}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        onConfirm={() => setPublished(false)}
        title={pp.unpublishTitle}
        description={pp.unpublishDesc}
        confirmLabel={pp.unpublishConfirm}
        destructive
      />
    </SettingsSection>
  );
}

export default PublishPanel;
