"use client";

import { useId, useRef, useState } from "react";
import { Camera, Plus, Trash2, UserRound } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { MAX_BARBERS } from "@/lib/templates/barbershop";
import { rowId, type WizardBarber } from "../_lib/wizard";
import { AvatarError, fileToAvatar } from "../_lib/image";
import type { StepProps } from "./step-shop";
import { StepHeader, Switch, cardClass, cardStyle } from "./ui";

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
      <div className={`${cardClass} p-4`} style={cardStyle}>
        <Switch
          checked={draft.team.ownerIsBarber}
          onChange={(v) => update((d) => ({ ...d, team: { ...d.team, ownerIsBarber: v } }))}
          label={interpolate(s.team.ownerCuts, { name: ownerName || s.team.you })}
          description={s.team.ownerCutsHint}
        />
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {s.team.barbersTitle}
      </h2>
      {teamError && (
        <p className="field-error mb-3" role="alert">
          {teamError}
        </p>
      )}
      {barbers.length === 0 ? (
        <p className="mb-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
          {s.team.empty}
        </p>
      ) : (
        <ul ref={listRef} className="flex flex-col gap-2.5">
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
      <button
        type="button"
        onClick={add}
        className="btn btn-secondary mt-4 w-full"
        disabled={barbers.length >= MAX_BARBERS}
      >
        <Plus size={18} aria-hidden />
        {s.team.add}
      </button>
      <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        {s.team.inviteLater}
      </p>
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
    <li className={`${cardClass} flex items-center gap-3 p-3`} style={{ ...cardStyle, borderColor: error ? "var(--accent-rose)" : cardStyle.borderColor }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={interpolate(row.avatarUrl ? s.team.changePhoto : s.team.addPhoto, { name })}
        aria-busy={busy || undefined}
        className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border focus-visible:outline-none focus-visible:ring-2"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-muted)" }}
      >
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound size={24} aria-hidden />
        )}
        <span
          aria-hidden
          className="absolute bottom-0 end-0 inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "var(--cta-bg)", color: "var(--cta-fg)" }}
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
          className="field-input"
          placeholder={s.team.namePlaceholder}
          autoComplete="off"
          maxLength={100}
          value={row.fullName}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
          onChange={(e) => onChange({ fullName: e.target.value })}
        />
        {error && (
          <p id={`${uid}-err`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={interpolate(s.team.remove, { name })}
        className="btn btn-ghost !min-h-[44px] !w-11 !px-0"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    </li>
  );
}
