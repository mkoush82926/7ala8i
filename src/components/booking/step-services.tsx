"use client";

// Step 1 — services: category tabs, price types, variant picker.

import React, { useMemo, useState } from "react";
import { Check, Home, Plus, Scissors } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/recipes";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { getServiceCategory, type ServiceCategory } from "@/lib/service-icon";
import type { BookingCategory } from "./use-booking-data";
import type { Line, ServiceRow } from "./booking-state";
import { money, serviceDurationLabel, servicePriceLabel } from "./booking-format";
import { joinMeta } from "@/lib/format";

type Tab = { key: string; label: string; match: (s: ServiceRow) => boolean };

const HEURISTIC_ORDER: ServiceCategory[] = ["hair", "beard", "color", "kids", "spa", "packages"];

export function StepServices({
  services, categories, lines, currency, onToggle, shopHref,
}: {
  services: ServiceRow[];
  categories: BookingCategory[];
  lines: Line[];
  currency: string | null;
  onToggle: (serviceId: string, variantId?: string | null) => void;
  shopHref: string;
}) {
  const { t, locale, isRTL, formatLocalNumber } = useTranslation();
  const f = t.bookingFlow;
  const [tab, setTab] = useState("all");
  const [variantFor, setVariantFor] = useState<ServiceRow | null>(null);
  const [variantChoice, setVariantChoice] = useState<string | null>(null);

  const localName = (s: ServiceRow) => (isRTL && s.name_ar ? s.name_ar : s.name);
  const localDesc = (s: ServiceRow) => (isRTL ? s.description_ar || s.description_en : s.description_en || s.description_ar);
  const priceLabels = { free: f.free, fromPrice: f.fromPrice };

  // Tabs: owner-assigned marketplace categories when present, else the
  // name heuristic the shop page uses. Only categories that have services.
  const tabs: Tab[] = useMemo(() => {
    const all: Tab = { key: "all", label: f.allServices, match: () => true };
    const withCategory = services.filter((s) => s.category_id);
    if (withCategory.length) {
      const present = categories.filter((c) => services.some((s) => s.category_id === c.id));
      const out: Tab[] = present.map((c) => ({
        key: c.id,
        label: isRTL ? c.name_ar : c.name_en,
        match: (s) => s.category_id === c.id,
      }));
      if (withCategory.length < services.length && out.length) {
        out.push({ key: "other", label: f.otherServices, match: (s) => !s.category_id });
      }
      return out.length > 1 ? [all, ...out] : [];
    }
    const labels: Record<ServiceCategory, string> = {
      hair: t.booking.categoryHair, beard: t.booking.categoryBeard, color: t.booking.categoryColor,
      kids: t.booking.categoryKids, spa: t.booking.categorySpa, packages: t.booking.categoryPackages,
    };
    const present = HEURISTIC_ORDER.filter((cat) => services.some((s) => getServiceCategory(s.name, s.name_ar) === cat));
    if (present.length < 2) return [];
    return [all, ...present.map((cat) => ({
      key: cat, label: labels[cat], match: (s: ServiceRow) => getServiceCategory(s.name, s.name_ar) === cat,
    }))];
  }, [services, categories, isRTL, f, t.booking]);

  const activeTab = tabs.find((x) => x.key === tab) ?? null;
  const visible = activeTab ? services.filter(activeTab.match) : services;
  const selected = new Map(lines.map((l) => [l.serviceId, l]));

  const tapService = (s: ServiceRow) => {
    if (s.variants.length) {
      setVariantFor(s);
      setVariantChoice(selected.get(s.id)?.variantId ?? s.variants[0]?.id ?? null);
      return;
    }
    onToggle(s.id);
  };

  if (services.length === 0) {
    return <EmptyState size="sm" icon={Scissors} title={t.booking.noServices} action={{ label: t.booking.backToShop, href: shopHref }} />;
  }

  return (
    <>
      {tabs.length > 0 && (
        <div className="bk-tabs" role="group" aria-label={f.categories}>
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={tab === x.key}
              onClick={() => setTab(x.key)}
              className={`bk-pill${tab === x.key ? " is-selected" : ""}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}

      <ul className="bk-list" aria-label={t.booking.services}>
        {visible.map((s) => {
          const line = selected.get(s.id);
          const isSelected = !!line;
          const variant = line?.variantId ? s.variants.find((v) => v.id === line.variantId) : null;
          const variantName = variant ? (isRTL && variant.name_ar ? variant.name_ar : variant.name_en) : null;
          const desc = localDesc(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-haspopup={s.variants.length ? "dialog" : undefined}
                onClick={() => tapService(s)}
                className={`bk-row${isSelected ? " is-selected" : ""}`}
              >
                <span className="bk-row-main">
                  <span className="bk-row-title">{localName(s)}</span>
                  <span className="bk-row-meta">
                    {joinMeta([
                      variant ? serviceDurationLabel({ duration: variant.duration, variants: [] }, locale) : serviceDurationLabel(s, locale),
                      variantName,
                      s.variants.length && !variant ? interpolate(f.optionsCount, { count: formatLocalNumber(s.variants.length) }) : null,
                    ])}
                  </span>
                  {desc && <span className="bk-row-desc">{desc}</span>}
                  {s.location_type === "home" && (
                    <span className="bk-row-meta" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, color: "var(--color-brand-text)", fontWeight: 600 }}>
                      <Home size={12} aria-hidden="true" /> {f.homeService}
                    </span>
                  )}
                </span>
                <span className="bk-row-price">
                  {variant ? money(variant.price, currency, locale) : servicePriceLabel(s, currency, locale, priceLabels)}
                </span>
                <span className="bk-add" aria-hidden="true">
                  {isSelected ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!variantFor}
        onClose={() => setVariantFor(null)}
        title={variantFor ? localName(variantFor) : ""}
        description={f.chooseOption}
        size="sm"
        footer={
          <DialogFooter>
            {variantFor && selected.has(variantFor.id) && (
              <button
                type="button"
                className={buttonClasses({ variant: "secondary" })}
                onClick={() => { onToggle(variantFor.id); setVariantFor(null); }}
              >
                {f.removeService}
              </button>
            )}
            <button
              type="button"
              className={buttonClasses({ variant: "primary" })}
              disabled={!variantChoice}
              onClick={() => {
                if (variantFor && variantChoice) onToggle(variantFor.id, variantChoice);
                setVariantFor(null);
              }}
            >
              {variantFor && selected.has(variantFor.id) ? f.updateService : f.addService}
            </button>
          </DialogFooter>
        }
      >
        {variantFor && (
          <div role="radiogroup" aria-label={f.chooseOption} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {variantFor.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={variantChoice === v.id}
                onClick={() => setVariantChoice(v.id)}
                className="bk-variant"
              >
                <span className="bk-radio" aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{isRTL && v.name_ar ? v.name_ar : v.name_en}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--color-ink-muted)" }}>
                    {serviceDurationLabel({ duration: v.duration, variants: [] }, locale)}
                  </span>
                </span>
                <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {variantFor.price_type === "free" ? f.free : money(v.price, currency, locale)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}
