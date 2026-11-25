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
    "inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="flex flex-wrap gap-2">
      {open && (
        <>
          <button
            type="button"
            onClick={() => setDialog("hide")}
            className={`${btn} border-danger text-danger-text hover:bg-danger-soft`}
          >
            {c.hide}
          </button>
          <button
            type="button"
            onClick={() => setDialog("dismiss")}
            className={`${btn} border-line text-ink hover:border-ink-soft`}
          >
            {c.dismiss}
          </button>
        </>
      )}
      {!open && reviewHidden && (
        <button
          type="button"
          onClick={() => setDialog("restore")}
          className={`${btn} border-line text-ink hover:border-ink-soft`}
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
