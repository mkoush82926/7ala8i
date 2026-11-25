"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { impersonationSetServiceActive, impersonationUpdateShop } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import type { ImpersonationSnapshot } from "@/lib/admin/types";
import {
  diffShopForm,
  shopFormFromSnapshot,
  type ShopFieldError,
  type ShopFormValues,
} from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-[15px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:bg-[var(--bg-secondary)] disabled:text-[var(--text-secondary)] aria-[invalid=true]:border-[var(--accent-rose)]";
const labelCls = "mb-1 block text-[12px] font-medium text-[var(--text-secondary)]";

const TEXT_FIELDS: Array<{ key: "name" | "name_ar" | "address"; dir?: "rtl"; max: number }> = [
  { key: "name", max: 120 },
  { key: "name_ar", dir: "rtl", max: 120 },
  { key: "address", max: 300 },
];
const AREA_FIELDS: Array<{ key: "description" | "description_ar"; dir?: "rtl" }> = [
  { key: "description" },
  { key: "description_ar", dir: "rtl" },
];
const NUM_FIELDS = ["min_notice_minutes", "booking_window_days"] as const;
const BOOL_FIELDS = ["is_published", "marketplace_visible"] as const;

/**
 * Shop profile as the owner sees it. In a read-only session every field is
 * disabled; in an editing session only the changed fields are sent, so the
 * audit diff is exact.
 */
export function SupportProfileForm({
  sessionId,
  shop,
  canEdit,
}: {
  sessionId: string;
  shop: ImpersonationSnapshot["shop"];
  canEdit: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const c = ADMIN_COPY.support;
  const [original, setOriginal] = useState<ShopFormValues>(() => shopFormFromSnapshot(shop));
  const [values, setValues] = useState<ShopFormValues>(original);
  const [errors, setErrors] = useState<ShopFieldError[]>([]);
  const [pending, startTransition] = useTransition();

  // Fresh server data (after router.refresh) resets the baseline.
  const [seenShop, setSeenShop] = useState(shop);
  if (seenShop !== shop) {
    const next = shopFormFromSnapshot(shop);
    setSeenShop(shop);
    setOriginal(next);
    setValues(next);
  }

  const set = <K extends keyof ShopFormValues>(key: K, value: ShopFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => e.filter((x) => x !== key));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const diff = diffShopForm(original, values);
    if (!diff.ok) {
      setErrors(diff.errors);
      return;
    }
    if (Object.keys(diff.patch).length === 0) {
      toast.info(c.noChanges);
      return;
    }
    startTransition(async () => {
      const res = await impersonationUpdateShop(sessionId, diff.patch);
      if (res.ok) {
        toast.success(c.savedToast);
        setOriginal(values);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const invalid = (k: string) => errors.includes(k as ShopFieldError);
  const disabled = !canEdit || pending;

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="grid gap-4 sm:grid-cols-2">
      {TEXT_FIELDS.map((f) => (
        <div key={f.key} className={f.key === "address" ? "sm:col-span-2" : undefined}>
          <label htmlFor={`${id}-${f.key}`} className={labelCls}>
            {c.fields[f.key]}
          </label>
          <input
            id={`${id}-${f.key}`}
            dir={f.dir}
            value={values[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            maxLength={f.max}
            disabled={disabled}
            aria-invalid={invalid(f.key)}
            aria-describedby={invalid(f.key) ? `${id}-${f.key}-err` : undefined}
            className={cn(inputCls, "h-11")}
          />
          {invalid(f.key) && (
            <p id={`${id}-${f.key}-err`} className="mt-1 text-[12px] text-[var(--accent-rose)]">
              {ADMIN_COPY.errors.INVALID_INPUT}
            </p>
          )}
        </div>
      ))}
      {AREA_FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`${id}-${f.key}`} className={labelCls}>
            {c.fields[f.key]}
          </label>
          <textarea
            id={`${id}-${f.key}`}
            dir={f.dir}
            rows={4}
            value={values[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            maxLength={2000}
            disabled={disabled}
            className={cn(inputCls, "py-2")}
          />
        </div>
      ))}
      {NUM_FIELDS.map((k) => (
        <div key={k}>
          <label htmlFor={`${id}-${k}`} className={labelCls}>
            {c.fields[k]}
          </label>
          <input
            id={`${id}-${k}`}
            inputMode="numeric"
            dir="ltr"
            value={values[k]}
            onChange={(e) => set(k, e.target.value.replace(/[^\d]/g, ""))}
            maxLength={5}
            disabled={disabled}
            aria-invalid={invalid(k)}
            aria-describedby={invalid(k) ? `${id}-${k}-err` : undefined}
            className={cn(inputCls, "h-11 tabular-nums")}
          />
          {invalid(k) && (
            <p id={`${id}-${k}-err`} className="mt-1 text-[12px] text-[var(--accent-rose)]">
              {ADMIN_COPY.errors.INVALID_INPUT}
            </p>
          )}
        </div>
      ))}
      <fieldset className="flex flex-wrap gap-x-6 gap-y-3 sm:col-span-2">
        {BOOL_FIELDS.map((k) => (
          <label key={k} className="inline-flex min-h-11 items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={values[k]}
              onChange={(e) => set(k, e.target.checked)}
              disabled={disabled}
              className="h-5 w-5 accent-[var(--accent-brass)]"
            />
            {c.fields[k]}
          </label>
        ))}
      </fieldset>
      {canEdit && (
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? ADMIN_COPY.common.saving : c.saveProfile}
          </button>
        </div>
      )}
    </form>
  );
}

/** Active switch for one service; disabled outside an editing session. */
export function SupportServiceToggle({
  sessionId,
  serviceId,
  name,
  active,
  canEdit,
}: {
  sessionId: string;
  serviceId: string;
  name: string;
  active: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<{ value: boolean; from: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const value = optimistic && optimistic.from === active ? optimistic.value : active;

  const toggle = () =>
    startTransition(async () => {
      const next = !value;
      setOptimistic({ value: next, from: active });
      const res = await impersonationSetServiceActive(sessionId, serviceId, next);
      if (res.ok || res.code === "NO_CHANGE") {
        toast.success(ADMIN_COPY.support.serviceToggled);
        router.refresh();
      } else {
        setOptimistic(null);
        toast.error(res.message);
      }
    });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ADMIN_COPY.support.serviceActive(name)}
      onClick={toggle}
      disabled={!canEdit || pending}
      className="inline-flex shrink-0 items-center rounded-full p-1 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
          value ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]" : "border-[var(--border-primary)] bg-[var(--bg-secondary)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-[var(--bg-primary)] shadow transition-transform",
            value ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
          )}
        />
      </span>
    </button>
  );
}
