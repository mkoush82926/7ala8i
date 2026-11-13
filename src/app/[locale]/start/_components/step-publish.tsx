"use client";

import { Clock, Globe2, Link2, MapPin, Scissors, Store, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatJOD } from "@/lib/format";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { normalizePhone, type WizardDraft, type WizardStep } from "../_lib/wizard";
import type { AreaOption, CityOption } from "./start-wizard";
import { StepHeader, cardClass, cardStyle } from "./ui";

export function StepPublish({
  draft,
  update,
  cities,
  areas,
  onEdit,
  publishError,
}: {
  draft: WizardDraft;
  update: (fn: (d: WizardDraft) => WizardDraft) => void;
  cities: CityOption[];
  areas: AreaOption[];
  onEdit: (step: WizardStep) => void;
  publishError: string | null;
}) {
  const { t, locale, formatTime } = useTranslation();
  const s = t.start;
  const name = (locale === "ar" ? draft.shop.nameAr || draft.shop.nameEn : draft.shop.nameEn || draft.shop.nameAr) || "";
  const city = cities.find((c) => c.id === draft.location.cityId);
  const area = areas.find((a) => a.id === draft.location.areaId);
  const label = (x?: { name_en: string; name_ar: string }) => (x ? (locale === "ar" ? x.name_ar : x.name_en) : null);
  const services = draft.services.filter((x) => x.selected);
  const minPrice = services.length ? Math.min(...services.map((x) => x.price)) : 0;
  const team = draft.team.barbers.filter((b) => b.fullName.trim()).length + (draft.team.ownerIsBarber ? 1 : 0);
  const openDays = draft.hours.filter((h) => h.open);
  const firstOpen = openDays[0];

  const rows: { step: WizardStep; icon: LucideIcon; title: string; detail: React.ReactNode }[] = [
    {
      step: "shop",
      icon: Store,
      title: name,
      detail: <bdi dir="ltr">{normalizePhone(draft.shop.phone) ?? draft.shop.phone}</bdi>,
    },
    {
      step: "location",
      icon: MapPin,
      title: [label(area), label(city)].filter(Boolean).join(locale === "ar" ? "، " : ", ") || s.publish.noLocation,
      detail: draft.location.landmark || (draft.location.lat !== null ? s.publish.pinSet : s.publish.pinMissing),
    },
    {
      step: "services",
      icon: Scissors,
      title: interpolate(s.publish.servicesCount, { count: services.length }),
      detail: services.length ? interpolate(s.publish.fromPrice, { price: formatJOD(minPrice, { locale, trimZeros: true }) }) : null,
    },
    {
      step: "team",
      icon: Users,
      title: interpolate(s.publish.teamCount, { count: team }),
      detail: draft.team.barbers.map((b) => b.fullName.trim()).filter(Boolean).join(locale === "ar" ? "، " : ", ") || null,
    },
    {
      step: "hours",
      icon: Clock,
      title: interpolate(s.publish.openDays, { count: openDays.length }),
      detail: firstOpen ? (
        <MetaLine
          locale={locale}
          items={[`${formatTime(firstOpen.start)} – ${formatTime(firstOpen.end)}`, draft.hours.some((h) => h.breakStart) ? s.publish.withBreaks : null].filter(
            (x): x is string => !!x,
          )}
        />
      ) : null,
    },
  ];

  const visible = draft.publish.marketplaceVisible;
  const setVisible = (v: boolean) => update((d) => ({ ...d, publish: { marketplaceVisible: v } }));

  return (
    <div>
      <StepHeader title={s.publish.title} subtitle={s.publish.subtitle} />
      {publishError && (
        <div
          role="alert"
          className="mb-4 rounded-[var(--radius-lg)] border px-4 py-3 text-[14px]"
          style={{ borderColor: "var(--accent-rose)", color: "var(--accent-rose)", background: "var(--accent-rose-muted)" }}
        >
          {publishError}
        </div>
      )}
      <ul className={cn(cardClass, "divide-y")} style={{ ...cardStyle }}>
        {rows.map(({ step, icon: Icon, title, detail }) => (
          <li key={step} className="flex items-start gap-3 p-3.5" style={{ borderColor: "var(--border-subtle)" }}>
            <Icon size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                {title}
              </p>
              {detail && (
                <div className="truncate text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {detail}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(step)}
              className="shrink-0 text-[14px] font-medium underline underline-offset-2"
              style={{ color: "var(--accent-text)" }}
              aria-label={`${s.publish.edit} · ${s.steps[step]}`}
            >
              {s.publish.edit}
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="mt-6">
        <legend className="mb-2 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {s.publish.visibilityTitle}
        </legend>
        <div className="flex flex-col gap-2.5">
          {[
            { v: true, icon: Globe2, title: s.publish.marketplaceTitle, body: s.publish.marketplaceBody },
            { v: false, icon: Link2, title: s.publish.linkOnlyTitle, body: s.publish.linkOnlyBody },
          ].map(({ v, icon: Icon, title, body }) => (
            <label
              key={String(v)}
              className={cn(cardClass, "flex cursor-pointer items-start gap-3 p-3.5 focus-within:ring-2")}
              style={{ ...cardStyle, borderColor: visible === v ? "var(--text-primary)" : "var(--border-subtle)" }}
            >
              <input
                type="radio"
                name="visibility"
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--cta-bg)]"
                checked={visible === v}
                onChange={() => setVisible(v)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                  <Icon size={16} aria-hidden />
                  {title}
                </span>
                <span className="mt-0.5 block text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {body}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
