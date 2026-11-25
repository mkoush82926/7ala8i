"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  setPlanOverride,
  setProfileBanned,
  setShopSuspended,
  startImpersonation,
} from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatDate } from "@/lib/admin/format";
import { PLAN_CODES, type PlanCode, type PlanOverride } from "@/lib/admin/types";
import {
  PLAN_DEFAULTS,
  WRITE_REASON_MIN,
  buildPlanPayload,
  isoDateInAmman,
  type PlanFieldError,
  type PlanFormValues,
} from "@/lib/admin/validation";
import { ReasonDialog } from "./reason-dialog";

const inputCls =
  "h-11 w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] aria-[invalid=true]:border-[var(--accent-rose)]";
const labelCls = "mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]";

// ─── Suspension ────────────────────────────────────────────────────────────
export function SuspendControl({ shopId, suspended }: { shopId: string; suspended: boolean }) {
  const [open, setOpen] = useState(false);
  const c = ADMIN_COPY.shop;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={suspended ? "btn btn-secondary" : "btn btn-destructive"}
      >
        {suspended ? c.unsuspend : c.suspend}
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={suspended ? c.unsuspendTitle : c.suspendTitle}
        description={suspended ? c.unsuspendBody : c.suspendBody}
        confirmLabel={suspended ? c.unsuspend : c.suspend}
        destructive={!suspended}
        successMessage={suspended ? c.unsuspendedToast : c.suspendedToast}
        onSubmit={(reason) => setShopSuspended(shopId, !suspended, reason)}
      />
    </>
  );
}

// ─── Profile ban (team list, abuse page) ───────────────────────────────────
export function ProfileBanButton({
  profileId,
  name,
  banned,
  disabled = false,
}: {
  profileId: string;
  name: string;
  banned: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const c = ADMIN_COPY.abuse;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex h-9 items-center rounded-[var(--radius)] border border-[var(--border-subtle)] px-3 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {banned ? c.unbanProfile : c.banProfile}
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={banned ? c.unbanProfileTitle(name) : c.banProfileTitle(name)}
        description={banned ? undefined : c.banProfileBody}
        confirmLabel={banned ? c.unbanProfile : c.banProfile}
        destructive={!banned}
        successMessage={banned ? c.profileUnbanned : c.profileBanned}
        onSubmit={(reason) => setProfileBanned(profileId, !banned, reason)}
      />
    </>
  );
}

// ─── Support session start ─────────────────────────────────────────────────
export function StartSupportSession({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [writeOpen, setWriteOpen] = useState(false);
  const c = ADMIN_COPY.support;

  const startRead = () =>
    startTransition(async () => {
      const res = await startImpersonation(shopId, "read");
      if (res.ok) {
        toast.success(c.startedReadToast);
        router.push("/admin/support");
      } else {
        toast.error(res.message);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={startRead} disabled={pending} aria-busy={pending} className="btn btn-primary">
        <Eye size={16} aria-hidden />
        {ADMIN_COPY.shop.viewReadOnly}
      </button>
      <button type="button" onClick={() => setWriteOpen(true)} disabled={pending} className="btn btn-secondary">
        <PencilLine size={16} aria-hidden />
        {ADMIN_COPY.shop.viewWithEdit}
      </button>
      <ReasonDialog
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        title={c.startWriteTitle}
        description={c.startWriteBody}
        confirmLabel={c.modeWrite}
        destructive
        minLength={WRITE_REASON_MIN}
        successMessage={c.startedWriteToast}
        onSubmit={(reason) => startImpersonation(shopId, "write", reason)}
        onDone={() => router.push("/admin/support")}
      />
    </div>
  );
}

// ─── Plan override ─────────────────────────────────────────────────────────
function initialPlanValues(plan: PlanOverride | null): PlanFormValues {
  if (!plan) {
    return {
      plan_code: "trial",
      trial_ends_at: isoDateInAmman(new Date(), PLAN_DEFAULTS.trial.trialDays ?? 30),
      max_barbers: "",
      monthly_message_allowance: "",
      note: "",
    };
  }
  return {
    plan_code: plan.plan_code,
    trial_ends_at: plan.trial_ends_at ? isoDateInAmman(new Date(plan.trial_ends_at)) : "",
    max_barbers: plan.max_barbers === null ? "" : String(plan.max_barbers),
    monthly_message_allowance: plan.monthly_message_allowance === null ? "" : String(plan.monthly_message_allowance),
    note: plan.note ?? "",
  };
}

export function PlanPanel({ shopId, plan, canEdit }: { shopId: string; plan: PlanOverride | null; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [values, setValues] = useState<PlanFormValues>(() => initialPlanValues(plan));
  const [errors, setErrors] = useState<PlanFieldError[]>([]);
  const id = useId();
  const c = ADMIN_COPY.plan;

  const set = (key: keyof PlanFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((errs) => errs.filter((x) => x !== key));
  };

  const open = () => {
    setValues(initialPlanValues(plan));
    setErrors([]);
    setEditOpen(true);
  };

  const checked = buildPlanPayload(values);
  const err = (key: PlanFieldError) => errors.includes(key);
  const defaults = PLAN_DEFAULTS[(values.plan_code as PlanCode) ?? "custom"] ?? PLAN_DEFAULTS.custom;

  return (
    <div>
      {plan ? (
        <dl className="grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-4">
          <div>
            <dt className="text-[12px] text-[var(--text-muted)]">{c.planLabel}</dt>
            <dd className="font-medium">{c.codes[plan.plan_code] ?? plan.plan_code}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--text-muted)]">{c.trialEndsLabel}</dt>
            <dd>{plan.trial_ends_at ? formatDate(plan.trial_ends_at) : ADMIN_COPY.common.dash}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--text-muted)]">{c.maxBarbersLabel}</dt>
            <dd className="tabular-nums">{plan.max_barbers ?? ADMIN_COPY.common.dash}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--text-muted)]">{c.messagesLabel}</dt>
            <dd className="tabular-nums">{plan.monthly_message_allowance ?? ADMIN_COPY.common.dash}</dd>
          </div>
          {plan.note && (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[12px] text-[var(--text-muted)]">{c.noteLabel}</dt>
              <dd className="whitespace-pre-line">{plan.note}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-[14px] text-[var(--text-secondary)]">{c.none}</p>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={open} className="btn btn-secondary">
            {plan ? c.edit : c.set}
          </button>
          {plan && (
            <button type="button" onClick={() => setClearOpen(true)} className="btn btn-ghost">
              {c.clear}
            </button>
          )}
        </div>
      )}

      <ReasonDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={c.dialogTitle}
        description={c.body}
        confirmLabel={ADMIN_COPY.common.save}
        successMessage={c.savedToast}
        onSubmit={async (reason) => {
          const built = buildPlanPayload(values);
          if (!built.ok) {
            setErrors(built.errors);
            return { ok: false, code: "INVALID_INPUT", message: ADMIN_COPY.errors.INVALID_INPUT };
          }
          return setPlanOverride(shopId, values, reason);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-code`} className={labelCls}>
              {c.planLabel}
            </label>
            <select id={`${id}-code`} value={values.plan_code} onChange={set("plan_code")} className={inputCls}>
              {PLAN_CODES.map((code) => (
                <option key={code} value={code}>
                  {c.codes[code]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-trial`} className={labelCls}>
              {c.trialEndsLabel}
            </label>
            <input
              id={`${id}-trial`}
              type="date"
              value={values.trial_ends_at}
              onChange={set("trial_ends_at")}
              aria-invalid={err("trial_ends_at")}
              aria-describedby={err("trial_ends_at") ? `${id}-trial-err` : undefined}
              className={inputCls}
            />
            {err("trial_ends_at") && (
              <p id={`${id}-trial-err`} className="mt-1 text-[12px] text-[var(--accent-rose)]">
                {c.errors.trialRequired}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-barbers`} className={labelCls}>
              {c.maxBarbersLabel}
            </label>
            <input
              id={`${id}-barbers`}
              inputMode="numeric"
              value={values.max_barbers}
              onChange={set("max_barbers")}
              placeholder={defaults.maxBarbers === null ? "" : String(defaults.maxBarbers)}
              aria-invalid={err("max_barbers")}
              aria-describedby={`${id}-barbers-hint`}
              className={inputCls}
            />
            <p id={`${id}-barbers-hint`} className={`mt-1 text-[12px] ${err("max_barbers") ? "text-[var(--accent-rose)]" : "text-[var(--text-muted)]"}`}>
              {err("max_barbers") ? c.errors.barbers : c.blankMeansDefault}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-msgs`} className={labelCls}>
              {c.messagesLabel}
            </label>
            <input
              id={`${id}-msgs`}
              inputMode="numeric"
              value={values.monthly_message_allowance}
              onChange={set("monthly_message_allowance")}
              placeholder={defaults.messages === null ? "" : String(defaults.messages)}
              aria-invalid={err("monthly_message_allowance")}
              aria-describedby={`${id}-msgs-hint`}
              className={inputCls}
            />
            <p id={`${id}-msgs-hint`} className={`mt-1 text-[12px] ${err("monthly_message_allowance") ? "text-[var(--accent-rose)]" : "text-[var(--text-muted)]"}`}>
              {err("monthly_message_allowance") ? c.errors.messages : c.blankMeansDefault}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-note`} className={labelCls}>
              {c.noteLabel}
            </label>
            <textarea
              id={`${id}-note`}
              value={values.note}
              onChange={set("note")}
              rows={2}
              maxLength={500}
              aria-invalid={err("note")}
              className="w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            />
          </div>
        </div>
        {!checked.ok && errors.length === 0 && values.plan_code === "trial" && !values.trial_ends_at && (
          <p className="text-[12px] text-[var(--text-muted)]">{c.errors.trialRequired}</p>
        )}
      </ReasonDialog>

      <ReasonDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={c.clearTitle}
        description={c.clearBody}
        confirmLabel={c.clear}
        destructive
        successMessage={c.clearedToast}
        onSubmit={(reason) => setPlanOverride(shopId, null, reason)}
      />
    </div>
  );
}
