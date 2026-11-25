"use client";

import { useState } from "react";
import { resolveReviewReport, setReviewHidden } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { ReasonDialog } from "./reason-dialog";

type Pending = "hide" | "dismiss" | "restore" | null;

/** Moderation buttons for one report: hide (uphold), keep (dismiss) or restore. */
export function ReportActions({
  reportId,
  reviewId,
  open,
  reviewHidden,
}: {
  reportId: string;
  reviewId: string;
  open: boolean;
  reviewHidden: boolean;
}) {
  const [dialog, setDialog] = useState<Pending>(null);
  const c = ADMIN_COPY.reviews;
  const btn =
    "inline-flex h-10 items-center rounded-[var(--radius)] border px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]";

  return (
    <div className="flex flex-wrap gap-2">
      {open && (
        <>
          <button
            type="button"
            onClick={() => setDialog("hide")}
            className={`${btn} border-[var(--accent-rose)] text-[var(--accent-rose)] hover:bg-[var(--accent-rose-muted)]`}
          >
            {c.hide}
          </button>
          <button
            type="button"
            onClick={() => setDialog("dismiss")}
            className={`${btn} border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-hover)]`}
          >
            {c.dismiss}
          </button>
        </>
      )}
      {!open && reviewHidden && (
        <button
          type="button"
          onClick={() => setDialog("restore")}
          className={`${btn} border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-hover)]`}
        >
          {c.restore}
        </button>
      )}

      <ReasonDialog
        open={dialog === "hide"}
        onClose={() => setDialog(null)}
        title={c.hideTitle}
        description={c.hideBody}
        confirmLabel={c.hide}
        destructive
        successMessage={c.hiddenToast}
        onSubmit={(reason) => resolveReviewReport(reportId, "hide", reason)}
      />
      <ReasonDialog
        open={dialog === "dismiss"}
        onClose={() => setDialog(null)}
        title={c.dismissTitle}
        description={c.dismissBody}
        confirmLabel={c.dismiss}
        required={false}
        successMessage={c.dismissedToast}
        onSubmit={(reason) => resolveReviewReport(reportId, "dismiss", reason)}
      />
      <ReasonDialog
        open={dialog === "restore"}
        onClose={() => setDialog(null)}
        title={c.restoreTitle}
        description={c.restoreBody}
        confirmLabel={c.restore}
        required={false}
        successMessage={c.restoredToast}
        onSubmit={(reason) => setReviewHidden(reviewId, false, reason)}
      />
    </div>
  );
}
