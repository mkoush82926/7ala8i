"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { createClaimDispute, resolveClaimDispute } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { CLAIM_DECISIONS, type ClaimDecision } from "@/lib/admin/types";
import { checkClaimForm, type ClaimFieldError, type ClaimFormValues } from "@/lib/admin/validation";
import { ReasonDialog } from "./reason-dialog";

const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] aria-[invalid=true]:border-[var(--accent-rose)]";
const labelCls = "mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]";

const EMPTY: ClaimFormValues = { shop_id: "", claimant_name: "", claimant_phone: "", details: "" };

export function NewClaimButton({ defaultShopId = "" }: { defaultShopId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ClaimFormValues>({ ...EMPTY, shop_id: defaultShopId });
  const [errors, setErrors] = useState<ClaimFieldError[]>([]);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const id = useId();
  const c = ADMIN_COPY.claims;

  const set = (key: keyof ClaimFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((errs) => errs.filter((x) => x !== key));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const errs = checkClaimForm(values);
    setErrors(errs);
    if (errs.length) {
      document.getElementById(`${id}-${errs[0]}`)?.focus();
      return;
    }
    setPending(true);
    setServerError(null);
    const res = await createClaimDispute(values);
    setPending(false);
    if (res.ok) {
      toast.success(c.createdToast);
      setOpen(false);
      setValues({ ...EMPTY, shop_id: defaultShopId });
      router.refresh();
    } else {
      setServerError(res.message);
      toast.error(res.message);
    }
  };

  const fieldError = (key: ClaimFieldError, message: string) =>
    errors.includes(key) ? (
      <p id={`${id}-${key}-err`} className="mt-1 text-[12px] text-[var(--accent-rose)]">
        {message}
      </p>
    ) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus size={16} aria-hidden />
        {c.create}
      </button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title={c.createTitle} size="md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor={`${id}-shop_id`} className={labelCls}>
              {c.shopIdLabel}
            </label>
            <input
              id={`${id}-shop_id`}
              value={values.shop_id}
              onChange={set("shop_id")}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              aria-invalid={errors.includes("shop_id")}
              aria-describedby={`${id}-shop-hint`}
              className={`${inputCls} h-11 font-mono text-[13px]`}
            />
            <p id={`${id}-shop-hint`} className="mt-1 text-[12px] text-[var(--text-muted)]">
              {c.shopIdHint}
            </p>
            {fieldError("shop_id", c.errors.shopId)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-claimant_name`} className={labelCls}>
                {c.claimantLabel}
              </label>
              <input
                id={`${id}-claimant_name`}
                value={values.claimant_name}
                onChange={set("claimant_name")}
                maxLength={120}
                aria-invalid={errors.includes("claimant_name")}
                className={`${inputCls} h-11`}
              />
              {fieldError("claimant_name", c.errors.name)}
            </div>
            <div>
              <label htmlFor={`${id}-claimant_phone`} className={labelCls}>
                {c.claimantPhoneLabel}
              </label>
              <input
                id={`${id}-claimant_phone`}
                value={values.claimant_phone}
                onChange={set("claimant_phone")}
                type="tel"
                inputMode="tel"
                dir="ltr"
                maxLength={32}
                aria-invalid={errors.includes("claimant_phone")}
                className={`${inputCls} h-11`}
              />
              {fieldError("claimant_phone", c.errors.phone)}
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-details`} className={labelCls}>
              {c.detailsLabel}
            </label>
            <textarea
              id={`${id}-details`}
              value={values.details}
              onChange={set("details")}
              rows={4}
              maxLength={2000}
              aria-invalid={errors.includes("details")}
              className={`${inputCls} py-2`}
            />
            {fieldError("details", c.errors.details)}
          </div>
          {serverError && (
            <p role="alert" className="text-[13px] font-medium text-[var(--accent-rose)]">
              {serverError}
            </p>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn btn-secondary">
              {ADMIN_COPY.common.cancel}
            </button>
            <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
              {pending ? ADMIN_COPY.common.saving : c.create}
            </button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export function ResolveClaimButton({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<ClaimDecision>("rejected");
  const id = useId();
  const c = ADMIN_COPY.claims;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        {c.decideTitle}
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={c.decideTitle}
        confirmLabel={c.decisions[decision]}
        destructive={decision === "upheld"}
        successMessage={c.decisionDone[decision]}
        onSubmit={(note) => resolveClaimDispute(claimId, decision, note)}
      >
        <fieldset>
          <legend className={labelCls}>{c.decisionLabel}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {CLAIM_DECISIONS.map((d) => (
              <label
                key={d}
                htmlFor={`${id}-${d}`}
                className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border-subtle)] px-3 text-[14px] has-[:checked]:border-[var(--accent-brass)] has-[:focus-visible]:shadow-[var(--shadow-focus)]"
              >
                <input
                  id={`${id}-${d}`}
                  type="radio"
                  name={`${id}-decision`}
                  value={d}
                  checked={decision === d}
                  onChange={() => setDecision(d)}
                  className="accent-[var(--accent-brass)]"
                />
                {c.decisions[d]}
              </label>
            ))}
          </div>
        </fieldset>
      </ReasonDialog>
    </>
  );
}
