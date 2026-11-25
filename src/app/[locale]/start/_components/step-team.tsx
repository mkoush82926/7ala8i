"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, Camera, Plus, Trash2, UserRound } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { buttonClasses, errorTextClasses, focusRing, inputClasses } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { MAX_BARBERS } from "@/lib/templates/barbershop";
import { rowId, type WizardBarber } from "../_lib/wizard";
import { AvatarError, fileToAvatar } from "../_lib/image";
import type { StepProps } from "./step-shop";
import { StepHeader, Switch, cardClass } from "./ui";

export function StepTeam({ draft, update, errors, ownerName }: StepProps & { ownerName: string | null }) {
  const { t } = useTranslation();
  const s = t.start;
  const listRef = useRef<HTMLUListElement>(null);
  const barbers = draft.team.barbers;
  const teamError = errors.team ? s.errors[errors.team as keyof typeof s.errors] : null;

  function setBarbers(fn: (b: WizardBarber[]) => WizardBarber[]) {
    update((d) => ({ ...d, team: { ...d.team, barbers: fn(d.team.barbers) } }));
  }

  function add() {
    if (barbers.length >= MAX_BARBERS) {
      toast.error(s.errors.teamTooMany);
      return;
    }
    const id = rowId("b");
    setBarbers((b) => [...b, { id, fullName: "", avatarUrl: null }]);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>(`[data-barber="${id}"]`)?.focus());
  }

  function remove(row: WizardBarber) {
    const index = barbers.findIndex((b) => b.id === row.id);
    setBarbers((b) => b.filter((x) => x.id !== row.id));
    toast.info(interpolate(s.team.removed, { name: row.fullName || s.team.barberFallback }), {
      action: {
        label: t.common.undo,
        onClick: () =>
          setBarbers((b) => {
            if (b.some((x) => x.id === row.id)) return b;
            const next = [...b];
            next.splice(Math.min(index, next.length), 0, row);
            return next;
          }),
      },
    });
  }

  return (
    <div>
      <StepHeader title={s.team.title} subtitle={s.team.subtitle} />
      <div className={cn(cardClass, "p-4 shadow-xs sm:p-5")}>
        <Switch
          checked={draft.team.ownerIsBarber}
          onChange={(v) => update((d) => ({ ...d, team: { ...d.team, ownerIsBarber: v } }))}
          label={interpolate(s.team.ownerCuts, { name: ownerName || s.team.you })}
          description={s.team.ownerCutsHint}
        />
      </div>

      <h2 className="text-h3 mb-3 mt-8 text-ink">{s.team.barbersTitle}</h2>
      {teamError && (
        <p className={cn(errorTextClasses, "mb-3 mt-0")} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{teamError}</span>
        </p>
      )}
      {barbers.length === 0 ? (
        <p className="mb-2 rounded-xl border border-dashed border-line bg-card px-4 py-5 text-center text-sm text-ink-muted">
          {s.team.empty}
        </p>
      ) : (
        <ul ref={listRef} className="flex flex-col gap-3">
          {barbers.map((b) => (
            <BarberRow
              key={b.id}
              row={b}
              error={errors[`barber.${b.id}`] ? s.errors[errors[`barber.${b.id}`] as keyof typeof s.errors] : null}
              onChange={(p) => setBarbers((list) => list.map((x) => (x.id === b.id ? { ...x, ...p } : x)))}
              onRemove={() => remove(b)}
            />
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        fullWidth
        onClick={add}
        className="mt-4 border-dashed"
        disabled={barbers.length >= MAX_BARBERS}
        icon={<Plus aria-hidden />}
      >
        {s.team.add}
      </Button>
      <p className="mt-3 text-[13px] text-ink-muted">{s.team.inviteLater}</p>
    </div>
  );
}

function BarberRow({
  row,
  error,
  onChange,
  onRemove,
}: {
  row: WizardBarber;
  error: string | null;
  onChange: (p: Partial<WizardBarber>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const s = t.start;
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = row.fullName.trim() || s.team.barberFallback;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange({ avatarUrl: await fileToAvatar(file) });
    } catch (e) {
      const code = e instanceof AvatarError ? e.code : "decode";
      toast.error(code === "notImage" ? s.team.photoNotImage : code === "tooLarge" ? s.team.photoTooLarge : s.team.photoFailed);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li className={cn(cardClass, "flex items-center gap-3 p-3", error && "border-danger")}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={interpolate(row.avatarUrl ? s.team.changePhoto : s.team.addPhoto, { name })}
        aria-busy={busy || undefined}
        className={cn(
          "relative grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-brand-soft text-brand-text ring-1 ring-line",
          focusRing,
        )}
      >
        <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-full">
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={row.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <UserRound size={24} aria-hidden />
          )}
        </span>
        <span
          aria-hidden
          className="absolute -bottom-0.5 -end-0.5 grid size-6 place-items-center rounded-full bg-brand text-on-brand ring-2 ring-card"
        >
          <Camera size={12} />
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`${uid}-name`} className="sr-only">
          {s.team.nameLabel}
        </label>
        <input
          id={`${uid}-name`}
          data-barber={row.id}
          className={inputClasses()}
          placeholder={s.team.namePlaceholder}
          autoComplete="off"
          maxLength={100}
          value={row.fullName}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
          onChange={(e) => onChange({ fullName: e.target.value })}
        />
        {error && (
          <p id={`${uid}-err`} className={errorTextClasses} role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={interpolate(s.team.remove, { name })}
        className={buttonClasses({ variant: "ghost", size: "icon", className: "hover:bg-danger-soft hover:text-danger-text" })}
      >
        <Trash2 aria-hidden />
      </button>
    </li>
  );
}
