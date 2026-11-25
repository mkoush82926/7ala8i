"use client";

import { useId, useState } from "react";
import { AlertCircle, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatJOD } from "@/lib/format";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { errorTextClasses, focusRing, inputClasses, labelClasses, selectClasses } from "@/components/ui/recipes";
import { DURATION_OPTIONS, MAX_SERVICES, normalizePrice } from "@/lib/templates/barbershop";
import { rowId, type WizardService } from "../_lib/wizard";
import type { StepProps } from "./step-shop";
import { StepHeader, cardClass } from "./ui";

export function StepServices({ draft, update, errors }: StepProps) {
  const { t, locale, formatLocalDuration: formatDuration } = useTranslation();
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
      <p className="mb-3 text-sm font-medium text-ink-soft" aria-live="polite">
        {interpolate(s.services.selectedCount, { count: total })}
      </p>
      {listError && (
        <p className={cn(errorTextClasses, "mb-3 mt-0")} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{listError}</span>
        </p>
      )}
      <ul className="flex flex-col gap-3">
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
      <Button variant="secondary" fullWidth onClick={addCustom} className="mt-4 border-dashed" icon={<Plus aria-hidden />}>
        {s.services.addCustom}
      </Button>
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
      className={cn(
        cardClass,
        "transition-[border-color,background-color,box-shadow] duration-150 ease-standard motion-reduce:transition-none",
        error
          ? "border-danger"
          : row.selected
            ? "border-brand bg-brand-soft/40 ring-1 ring-brand"
            : "hover:border-ink-soft",
      )}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.selected}
          aria-label={interpolate(s.services.include, { name: primary })}
          onClick={() => onPatch({ selected: !row.selected })}
          className={cn(
            "grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors duration-150",
            row.selected ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-card text-transparent",
            focusRing,
          )}
        >
          <Check size={14} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-start", focusRing)}
        >
          <span className="min-w-0 flex-1">
            <span className="text-title block truncate text-ink">{primary}</span>
            <span className="text-meta block truncate tabular-nums">
              {[secondary, formatDuration(row.duration), formatJOD(row.price, { locale, trimZeros: true })]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken">
            <ChevronDown
              size={18}
              className={cn("transition-transform duration-200 ease-standard motion-reduce:transition-none", open && "rotate-180")}
            />
          </span>
        </button>
      </div>
      {error && !open && (
        <p className={cn(errorTextClasses, "mt-0 px-4 pb-3")} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {open && (
        <div id={`${uid}-panel`} className="grid grid-cols-2 gap-4 border-t border-line p-3 sm:p-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClasses} htmlFor={`${uid}-ar`}>
              {s.services.nameArLabel}
            </label>
            <input
              id={`${uid}-ar`}
              className={inputClasses()}
              dir="rtl"
              lang="ar"
              maxLength={100}
              value={row.nameAr}
              onChange={(e) => onPatch({ nameAr: e.target.value })}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClasses} htmlFor={`${uid}-en`}>
              {s.services.nameEnLabel}
            </label>
            <input
              id={`${uid}-en`}
              className={inputClasses()}
              dir="ltr"
              lang="en"
              maxLength={100}
              value={row.nameEn}
              onChange={(e) => onPatch({ nameEn: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClasses} htmlFor={`${uid}-price`}>
              {s.services.priceLabel}
            </label>
            <input
              id={`${uid}-price`}
              className={inputClasses({ className: "tabular-nums" })}
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
            <label className={labelClasses} htmlFor={`${uid}-dur`}>
              {s.services.durationLabel}
            </label>
            <div className="relative">
              <select
                id={`${uid}-dur`}
                className={selectClasses()}
                value={row.duration}
                onChange={(e) => onPatch({ duration: Number(e.target.value) })}
              >
                {durations.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                aria-hidden
                className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-ink-muted"
              />
            </div>
          </div>
          {error && (
            <p className={cn(errorTextClasses, "col-span-2 mt-0")} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <div className="col-span-2 flex justify-end">
            <Button variant="destructive-soft" size="sm" onClick={onRemove} icon={<Trash2 aria-hidden />}>
              {s.services.remove}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
