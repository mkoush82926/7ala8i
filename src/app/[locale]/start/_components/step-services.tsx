"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatJOD } from "@/lib/format";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { DURATION_OPTIONS, MAX_SERVICES, normalizePrice } from "@/lib/templates/barbershop";
import { rowId, type WizardService } from "../_lib/wizard";
import type { StepProps } from "./step-shop";
import { StepHeader, cardClass, cardStyle } from "./ui";

export function StepServices({ draft, update, errors }: StepProps) {
  const { t, locale, formatDuration } = useTranslation();
  const s = t.start;
  const [open, setOpen] = useState<string | null>(null);
  const selected = draft.services.filter((x) => x.selected);
  const total = selected.length;

  function patch(id: string, p: Partial<WizardService>) {
    update((d) => ({ ...d, services: d.services.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  }

  function addCustom() {
    if (draft.services.length >= MAX_SERVICES + 20) return;
    const id = rowId("s");
    update((d) => ({
      ...d,
      services: [
        ...d.services,
        { id, key: null, nameAr: "", nameEn: "", duration: 30, price: 5, category: null, icon: "scissors", selected: true },
      ],
    }));
    setOpen(id);
  }

  function remove(row: WizardService) {
    const index = draft.services.findIndex((x) => x.id === row.id);
    update((d) => ({ ...d, services: d.services.filter((x) => x.id !== row.id) }));
    toast.info(s.services.removed, {
      action: {
        label: t.common.undo,
        onClick: () =>
          update((d) => {
            if (d.services.some((x) => x.id === row.id)) return d;
            const next = [...d.services];
            next.splice(Math.min(index, next.length), 0, row);
            return { ...d, services: next };
          }),
      },
    });
  }

  const listError = errors.services ? s.errors[errors.services as keyof typeof s.errors] : null;

  return (
    <div>
      <StepHeader title={s.services.title} subtitle={s.services.subtitle} />
      <p className="mb-3 text-[14px]" style={{ color: "var(--text-secondary)" }} aria-live="polite">
        {interpolate(s.services.selectedCount, { count: total })}
      </p>
      {listError && (
        <p className="field-error mb-3" role="alert">
          {listError}
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {draft.services.map((row) => (
          <ServiceRow
            key={row.id}
            row={row}
            open={open === row.id}
            onToggleOpen={() => setOpen((o) => (o === row.id ? null : row.id))}
            onPatch={(p) => patch(row.id, p)}
            onRemove={() => remove(row)}
            error={errors[`service.${row.id}`] ? s.errors[errors[`service.${row.id}`] as keyof typeof s.errors] : null}
            locale={locale}
            formatDuration={formatDuration}
          />
        ))}
      </ul>
      <button type="button" onClick={addCustom} className="btn btn-secondary mt-4 w-full">
        <Plus size={18} aria-hidden />
        {s.services.addCustom}
      </button>
    </div>
  );
}

function ServiceRow({
  row,
  open,
  onToggleOpen,
  onPatch,
  onRemove,
  error,
  locale,
  formatDuration,
}: {
  row: WizardService;
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (p: Partial<WizardService>) => void;
  onRemove: () => void;
  error: string | null;
  locale: "en" | "ar";
  formatDuration: (m: number) => string;
}) {
  const { t } = useTranslation();
  const s = t.start;
  const uid = useId();
  const primary = (locale === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || s.services.untitled;
  const secondary = locale === "ar" ? row.nameEn : row.nameAr;
  const [priceText, setPriceText] = useState(String(row.price));
  const durations = DURATION_OPTIONS.includes(row.duration)
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, row.duration].sort((a, b) => a - b);

  return (
    <li
      className={cn(cardClass, "transition-colors")}
      style={{
        ...cardStyle,
        borderColor: error ? "var(--accent-rose)" : row.selected ? "var(--border-primary)" : "var(--border-subtle)",
        opacity: row.selected ? 1 : 0.85,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.selected}
          aria-label={interpolate(s.services.include, { name: primary })}
          onClick={() => onPatch({ selected: !row.selected })}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2"
          style={{
            borderColor: row.selected ? "var(--cta-bg)" : "var(--border-primary)",
            background: row.selected ? "var(--cta-bg)" : "transparent",
            color: "var(--cta-fg)",
          }}
        >
          {row.selected && <Check size={16} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          className="flex min-w-0 flex-1 items-center gap-2 text-start focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
              {primary}
            </span>
            <span className="block truncate text-[13px]" style={{ color: "var(--text-muted)" }}>
              {[secondary, formatDuration(row.duration), formatJOD(row.price, { locale, trimZeros: true })]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
            style={{ color: "var(--text-muted)" }}
          />
        </button>
      </div>
      {error && !open && (
        <p className="field-error px-3 pb-3 !mt-0" role="alert">
          {error}
        </p>
      )}
      {open && (
        <div id={`${uid}-panel`} className="grid grid-cols-2 gap-3 border-t px-3 pb-3 pt-3" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label" htmlFor={`${uid}-ar`}>
              {s.services.nameArLabel}
            </label>
            <input
              id={`${uid}-ar`}
              className="field-input"
              dir="rtl"
              lang="ar"
              maxLength={100}
              value={row.nameAr}
              onChange={(e) => onPatch({ nameAr: e.target.value })}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label" htmlFor={`${uid}-en`}>
              {s.services.nameEnLabel}
            </label>
            <input
              id={`${uid}-en`}
              className="field-input"
              dir="ltr"
              lang="en"
              maxLength={100}
              value={row.nameEn}
              onChange={(e) => onPatch({ nameEn: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${uid}-price`}>
              {s.services.priceLabel}
            </label>
            <input
              id={`${uid}-price`}
              className="field-input"
              inputMode="decimal"
              dir="ltr"
              value={priceText}
              onChange={(e) => {
                const v = e.target.value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace("٫", ".");
                setPriceText(v);
                onPatch({ price: normalizePrice(v) });
              }}
              onBlur={() => setPriceText(String(normalizePrice(priceText)))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${uid}-dur`}>
              {s.services.durationLabel}
            </label>
            <select
              id={`${uid}-dur`}
              className="field-input"
              value={row.duration}
              onChange={(e) => onPatch({ duration: Number(e.target.value) })}
            >
              {durations.map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="field-error col-span-2 !mt-0" role="alert">
              {error}
            </p>
          )}
          <div className="col-span-2 flex justify-end">
            <button type="button" onClick={onRemove} className="btn btn-ghost !min-h-[40px] !px-3 text-[14px]">
              <Trash2 size={16} aria-hidden />
              {s.services.remove}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
